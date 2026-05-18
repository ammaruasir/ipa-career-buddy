import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { tourScript } from "@/demo/tour-script";
import { featureSpec } from "@/demo/feature-spec";
import type { TourAction, TourState, TourStatus, TourStep } from "@/demo/types";
import { useDemoVoice } from "@/hooks/useDemoVoice";
import { supabase } from "@/integrations/supabase/client";

type TranscriptEntry = { role: "presenter" | "viewer"; text: string };

type DemoTourContextValue = TourState & {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  next: () => Promise<void>;
  exit: () => void;
  setTakeOverMode: (on: boolean) => void;

  askText: (text: string) => Promise<void>;
  beginVoiceQuestion: () => Promise<void>;
  endVoiceQuestion: () => Promise<void>;
  isRecording: boolean;
  transcript: TranscriptEntry[];
  pendingAnswer: string | null;

  micConsent: boolean;
  setMicConsent: (on: boolean) => void;
  qaCount: number;
  qaCap: number;

  showActEndPrompt: boolean;
  actEndLabel: string | null;
  dismissActEndPrompt: () => void;
};

const QA_CAP = 30;
const MIC_CONSENT_KEY = "ipa-demo-mic-consent-v1";

// Minimum time each step is shown, even if voice fails or finishes early.
// Gives the human viewer a chance to read the narration + see the UI change.
const MIN_STEP_DURATION_MS = 4500;

// Hard cap so a runaway step (e.g. very long narration) doesn't stall the tour.
const MAX_STEP_DURATION_MS = 60_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Used to suppress required PDPL consents during the demo (the demo-candidate
// account doesn't grant them server-side, so without this the ConsentBanner
// pops up over the dashboard mid-tour and blocks every interaction).
async function prefillDemoConsents(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;
  const rows = ["audio_third_party_ai", "video_third_party_ai", "cv_third_party_ai"].map(
    (consent_type) => ({ user_id: user.id, consent_type, granted: true, version: "v1" }),
  );
  try {
    await supabase.from("user_consents").upsert(rows as any, {
      onConflict: "user_id,consent_type,version",
    });
  } catch (e) {
    console.warn("prefillDemoConsents failed (non-fatal):", e);
  }
}

// Selectors of dialog/popup elements that block the tour. The auto-dismiss
// observer below clicks the "save/accept/skip" button inside any of these.
const DIALOG_ROOT_SELECTORS = [
  '[role="dialog"]',
  '[data-radix-dialog-content]',
  '[data-tour="consent-banner"]',
];

// Button-text patterns we treat as safe to auto-click inside a dialog.
const SAFE_ACCEPT_PATTERNS = [
  /حفظ/i, /اعتمد/i, /موافق/i, /قبول/i, /متابعة/i, /save/i, /accept/i, /continue/i, /skip/i, /تأكيد/, // تأكيد
];

function findClickableInDialog(root: HTMLElement): HTMLElement | null {
  const buttons = Array.from(root.querySelectorAll("button, [role='button']")) as HTMLElement[];
  // Prefer primary/save-like buttons; skip explicit cancel/close ones.
  for (const b of buttons) {
    const text = (b.textContent || "").trim();
    if (!text) continue;
    if (/إلغاء|cancel/i.test(text)) continue;
    if (SAFE_ACCEPT_PATTERNS.some((re) => re.test(text))) return b;
  }
  // Fallback: any submit-type button.
  const submit = root.querySelector("button[type='submit']") as HTMLElement | null;
  if (submit) return submit;
  return null;
}

async function findElement(selector: string, timeoutMs = 2000): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return el;
    await sleep(120);
  }
  return null;
}

function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function swapDemoSession(role: "candidate" | "admin" | "hr" | "instructor"): Promise<void> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ role }),
    },
  );
  if (!resp.ok) {
    console.warn(`demo-session swap to ${role} failed: ${resp.status}`);
    return;
  }
  const data = (await resp.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token || !data.refresh_token) return;
  await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
}

async function runAction(
  action: TourAction,
  navigate: (to: string) => void,
  cancelRef: { current: boolean },
): Promise<void> {
  if (cancelRef.current) return;
  switch (action.kind) {
    case "navigate":
      navigate(action.to);
      await sleep(400);
      return;
    case "wait":
      await sleep(action.ms);
      return;
    case "click": {
      if (action.delayMs) await sleep(action.delayMs);
      if (cancelRef.current) return;
      const el = await findElement(action.selector);
      el?.click();
      return;
    }
    case "type": {
      const el = (await findElement(action.selector)) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (!el) return;
      el.focus();
      const speed = action.speedMs ?? 40;
      let current = "";
      for (const ch of action.text) {
        if (cancelRef.current) return;
        current += ch;
        setNativeInputValue(el, current);
        await sleep(speed);
      }
      return;
    }
    case "swap-session": {
      await swapDemoSession(action.role);
      return;
    }
  }
}

const DemoTourContext = createContext<DemoTourContextValue | null>(null);

export function DemoTourProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const voice = useDemoVoice();

  const [status, setStatus] = useState<TourStatus>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [takeOverMode, setTakeOverMode] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [micConsentState, setMicConsentState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MIC_CONSENT_KEY) === "1";
  });
  const [qaCount, setQaCount] = useState(0);
  const [showActEndPrompt, setShowActEndPrompt] = useState(false);
  const [actEndLabel, setActEndLabel] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const currentStep: TourStep | null = tourScript[stepIndex] ?? null;

  // ── Auto-dismiss popups during the tour ──────────────────────────────────
  // When status is "running", any modal/dialog that appears (e.g. the PDPL
  // ConsentBanner that auto-opens on /dashboard/candidate) blocks the tour.
  // We watch the DOM and, after a short delay so the viewer sees it flash by,
  // click the safe accept/save button inside it.
  useEffect(() => {
    if (status !== "running") return;
    const handled = new WeakSet<Element>();
    const tryDismiss = (root: HTMLElement) => {
      if (handled.has(root)) return;
      const btn = findClickableInDialog(root);
      if (!btn) return;
      handled.add(root);
      // Brief flash so the viewer notices the popup, then auto-dismiss.
      setTimeout(() => btn.click(), 1200);
    };
    const scan = () => {
      for (const sel of DIALOG_ROOT_SELECTORS) {
        document.querySelectorAll(sel).forEach((node) => {
          if (node instanceof HTMLElement) tryDismiss(node);
        });
      }
    };
    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [status]);

  const setMicConsent = useCallback((on: boolean) => {
    setMicConsentState(on);
    if (typeof window !== "undefined") {
      if (on) window.localStorage.setItem(MIC_CONSENT_KEY, "1");
      else window.localStorage.removeItem(MIC_CONSENT_KEY);
    }
  }, []);

  const dismissActEndPrompt = useCallback(() => {
    setShowActEndPrompt(false);
    setActEndLabel(null);
  }, []);

  const appendTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev.slice(-19), entry]);
  }, []);

  const runStep = useCallback(
    async (step: TourStep) => {
      const isSessionSwap = step.action?.kind === "swap-session";

      if (isSessionSwap) {
        await runAction(step.action!, navigate, cancelRef);
        if (cancelRef.current) return;
        // After swapping to the candidate session, pre-grant PDPL consents so
        // the ConsentBanner doesn't pop up mid-tour.
        if (step.action!.kind === "swap-session" && step.action!.role === "candidate") {
          await prefillDemoConsents();
        }
      }

      if (step.route) {
        navigate(step.route);
        await sleep(400);
      }
      if (cancelRef.current) return;

      appendTranscript({ role: "presenter", text: step.narration });
      const speaking = voice.speak(step.narration, undefined, step.id);

      if (step.action && !isSessionSwap && !takeOverMode) {
        runAction(step.action, navigate, cancelRef).catch((e) =>
          console.warn("Tour action failed:", e)
        );
      }

      // Race voice against an estimated duration so the step never finishes
      // sooner than is readable for a human viewer. If voice fails (autoplay
      // block, network), durationEstimateMs or MIN_STEP_DURATION_MS holds.
      const desired = Math.min(
        MAX_STEP_DURATION_MS,
        Math.max(MIN_STEP_DURATION_MS, step.durationEstimateMs ?? MIN_STEP_DURATION_MS),
      );
      const minWait = new Promise<void>((r) => setTimeout(r, desired));

      // If voice still speaking when min duration ends, wait for voice;
      // if voice ended first, wait the remaining min duration.
      await Promise.all([speaking, minWait]);
    },
    [navigate, voice, appendTranscript, takeOverMode]
  );

  const start = useCallback(async () => {
    cancelRef.current = false;
    setStepIndex(0);
    setTranscript([]);
    setQaCount(0);

    // CRITICAL: prime the audio context BEFORE any async work — this is the
    // last moment we're inside the user-gesture window for the click that
    // invoked start(). Without it, autoplay policy blocks the first TTS
    // audio.play() and the whole tour silently rushes through.
    await voice.primeAudio();

    setStatus("running");
    for (let i = 0; i < tourScript.length; i++) {
      if (cancelRef.current) return;
      setStepIndex(i);
      await runStep(tourScript[i]);
      const nextStep = tourScript[i + 1];
      if (nextStep && nextStep.act !== tourScript[i].act) {
        setActEndLabel(tourScript[i].act);
        setShowActEndPrompt(true);
        await sleep(2200);
        setShowActEndPrompt(false);
        setActEndLabel(null);
        if (cancelRef.current) return;
      }
    }
    setStatus("finished");
  }, [runStep, voice]);

  const pause = useCallback(() => {
    cancelRef.current = true;
    voice.stop();
    setStatus("paused");
  }, [voice]);

  const resume = useCallback(async () => {
    cancelRef.current = false;
    setStatus("running");
    for (let i = stepIndex; i < tourScript.length; i++) {
      if (cancelRef.current) return;
      setStepIndex(i);
      await runStep(tourScript[i]);
    }
    setStatus("finished");
  }, [runStep, stepIndex]);

  const next = useCallback(async () => {
    cancelRef.current = true;
    voice.stop();
    const ni = Math.min(stepIndex + 1, tourScript.length - 1);
    setStepIndex(ni);
    cancelRef.current = false;
    setStatus("running");
    await runStep(tourScript[ni]);
    if (ni === tourScript.length - 1) setStatus("finished");
  }, [runStep, stepIndex, voice]);

  const exit = useCallback(() => {
    cancelRef.current = true;
    voice.stop();
    setStatus("idle");
    setStepIndex(0);
    setTranscript([]);
    setPendingAnswer(null);
  }, [voice]);

  const askText = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question) return;

      if (qaCount >= QA_CAP) {
        const capMessage =
          "وصلنا للحدّ الأقصى من الأسئلة في هذه الجلسة. تقدر تعيد تشغيل الجولة لتجربة جديدة.";
        appendTranscript({ role: "presenter", text: capMessage });
        await voice.speak(capMessage);
        return;
      }
      setQaCount((c) => c + 1);

      cancelRef.current = true;
      voice.stop();
      setStatus("qna");
      appendTranscript({ role: "viewer", text: question });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            question,
            currentStepId: currentStep?.id,
            recentTranscript: transcript.slice(-6),
            featureSpec,
            stepIds: tourScript.map((s) => s.id),
          }),
        }
      );

      if (!response.ok) {
        const fallback = "آسفة، صار خطأ مؤقّت. تقدر تعيد السؤال؟";
        setPendingAnswer(fallback);
        appendTranscript({ role: "presenter", text: fallback });
        await voice.speak(fallback);
        setPendingAnswer(null);
        setStatus("paused");
        return;
      }

      const data = (await response.json()) as {
        answer: string;
        resumeStrategy?: "continue" | "stay" | "jumpTo";
        jumpToStepId?: string | null;
      };
      const answer = data.answer || "ما عندي معلومة كافية عن هذي النقطة، تقدر تتواصل معنا عبر info@ipa-training.sa";
      setPendingAnswer(answer);
      appendTranscript({ role: "presenter", text: answer });
      await voice.speak(answer);
      setPendingAnswer(null);

      if (data.resumeStrategy === "jumpTo" && data.jumpToStepId) {
        const targetIndex = tourScript.findIndex((s) => s.id === data.jumpToStepId);
        if (targetIndex >= 0) {
          setStepIndex(targetIndex);
          cancelRef.current = false;
          setStatus("running");
          for (let i = targetIndex; i < tourScript.length; i++) {
            if (cancelRef.current) return;
            setStepIndex(i);
            await runStep(tourScript[i]);
          }
          setStatus("finished");
          return;
        }
      }

      if (data.resumeStrategy === "continue") {
        cancelRef.current = false;
        setStatus("running");
        const startFrom = stepIndex + 1;
        for (let i = startFrom; i < tourScript.length; i++) {
          if (cancelRef.current) return;
          setStepIndex(i);
          await runStep(tourScript[i]);
        }
        setStatus("finished");
      } else {
        setStatus("paused");
      }
    },
    [voice, currentStep, transcript, stepIndex, runStep, appendTranscript, qaCount]
  );

  const beginVoiceQuestion = useCallback(async () => {
    if (!micConsentState) {
      console.warn("Mic Q&A blocked — no consent.");
      return;
    }
    cancelRef.current = true;
    voice.stop();
    await voice.startRecording();
  }, [voice, micConsentState]);

  const endVoiceQuestion = useCallback(async () => {
    const blob = await voice.stopRecording();
    if (!blob || blob.size < 1000) return;
    try {
      const text = await voice.transcribe(blob);
      if (text) await askText(text);
    } catch (e) {
      console.error("Voice Q&A failed:", e);
    }
  }, [voice, askText]);

  const value = useMemo<DemoTourContextValue>(
    () => ({
      status, stepIndex, totalSteps: tourScript.length, currentStep,
      isSpeaking: voice.isSpeaking, takeOverMode,
      start, pause, resume, next, exit, setTakeOverMode,
      askText, beginVoiceQuestion, endVoiceQuestion,
      isRecording: voice.isRecording, transcript, pendingAnswer,
      micConsent: micConsentState, setMicConsent, qaCount, qaCap: QA_CAP,
      showActEndPrompt, actEndLabel, dismissActEndPrompt,
    }),
    [
      status, stepIndex, currentStep, voice.isSpeaking, voice.isRecording,
      takeOverMode, start, pause, resume, next, exit,
      askText, beginVoiceQuestion, endVoiceQuestion,
      transcript, pendingAnswer, micConsentState, setMicConsent, qaCount,
      showActEndPrompt, actEndLabel, dismissActEndPrompt,
    ]
  );

  return <DemoTourContext.Provider value={value}>{children}</DemoTourContext.Provider>;
}

export function useTourEngine() {
  const ctx = useContext(DemoTourContext);
  if (!ctx) throw new Error("useTourEngine must be used inside <DemoTourProvider>");
  return ctx;
}
