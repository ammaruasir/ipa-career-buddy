import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { tourScript } from "@/demo/tour-script";
import { featureSpec } from "@/demo/feature-spec";
import type { CursorState, DemoRuntimeContext, TourAction, TourState, TourStatus, TourStep } from "@/demo/types";
import { useDemoVoice } from "@/hooks/useDemoVoice";
import { candidateVoiceId } from "@/demo/voices";
import { demoCandidate } from "@/demo/demo-candidate";
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

const DemoTourContext = createContext<DemoTourContextValue | null>(null);

export function DemoTourProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const voice = useDemoVoice();
  // Second voice instance for the AI candidate during ai-vs-ai turns. Distinct
  // hook → distinct audio element → can talk concurrently with the presenter
  // (in practice we pause the presenter first to avoid mic + double TTS chaos).
  const candidateVoice = useDemoVoice();

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

  const [cursor, setCursor] = useState<CursorState>({
    x: 0,
    y: 0,
    visible: false,
    clicking: false,
  });

  // Runtime context shared across action handlers. Held in a ref so callbacks
  // capture the live value instead of a stale closure snapshot.
  const runtimeCtxRef = useRef<DemoRuntimeContext>({ lastInterviewId: null });

  const cancelRef = useRef(false);
  // Map<stepId, Promise<Blob|null>> — provider-side preloads (currently just
  // step 0) so the first click feels instant instead of waiting on a TTS
  // round-trip while the page sits silent.
  const preloadedAudioRef = useRef<Map<string, Promise<Blob | null>>>(new Map());
  const currentStep: TourStep | null = tourScript[stepIndex] ?? null;

  // ── Cursor helpers ────────────────────────────────────────────────────────
  const moveCursorTo = useCallback(
    async (selector: string, opts?: { settleMs?: number }): Promise<HTMLElement | null> => {
      const el = await findElement(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      setCursor({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        visible: true,
        clicking: false,
      });
      await sleep(opts?.settleMs ?? 500);
      return el;
    },
    []
  );

  const flashClick = useCallback(async () => {
    setCursor((c) => ({ ...c, clicking: true }));
    await sleep(260);
    setCursor((c) => ({ ...c, clicking: false }));
  }, []);

  const hideCursor = useCallback(() => {
    setCursor((c) => ({ ...c, visible: false, clicking: false }));
  }, []);

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

  // ── Action runner (declared inside provider so it can use cursor helpers) ─
  const runAction = useCallback(
    async (action: TourAction): Promise<void> => {
      if (cancelRef.current) return;
      switch (action.kind) {
        case "navigate":
          hideCursor();
          navigate(action.to);
          await sleep(400);
          return;
        case "wait":
          await sleep(action.ms);
          return;
        case "click": {
          if (action.delayMs) await sleep(action.delayMs);
          if (cancelRef.current) return;
          const el = await moveCursorTo(action.selector);
          if (!el) return;
          await flashClick();
          el.click();
          return;
        }
        case "type": {
          const el = (await moveCursorTo(action.selector)) as
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
          hideCursor();
          await swapDemoSession(action.role);
          return;
        }
        case "pause-voice": {
          voice.pause();
          return;
        }
        case "resume-voice": {
          await voice.resume();
          return;
        }
        case "start-live-interview": {
          hideCursor();
          // The voice interview page exposes a "ابدأ المقابلة" / start button.
          // Click whichever start-like button is rendered.
          const startBtn =
            (await findElement(
              "button:not([disabled])[data-tour='start-interview']",
              1500,
            )) ??
            (await findElement(
              "main button:not([disabled])",
              3000,
            ));
          if (!startBtn) {
            console.warn("start-live-interview: no start button found");
            return;
          }
          await moveCursorTo("button:not([disabled])");
          await flashClick();
          startBtn.click();
          // Wait for the interview UI to flip into "active" state (transcript
          // entry, mic indicator). 12s gives the AI time to ask the first Q.
          await sleep(12_000);
          return;
        }
        case "ai-vs-ai-turn": {
          // Read the latest interviewer question from the on-screen transcript.
          // The voice interview page renders an [data-tour='interview-transcript']
          // container OR falls back to the last assistant bubble.
          const transcriptEl =
            document.querySelector("[data-tour='interview-transcript']") ??
            document.querySelector("main");
          const text = transcriptEl?.textContent ?? "";
          // Heuristic: take the last ~400 chars as the question context. The
          // bot prompt handles cases where it isn't a pure question.
          const question = text.slice(-400).trim() || "أخبرنا عن نفسك ولماذا أنت مرشّحة لهذا الدور.";

          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken =
              sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            const botResp = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-candidate-bot`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  question,
                  context: action.context,
                  questionIndex: action.questionIndex,
                  totalQuestions: action.totalQuestions,
                  persona: demoCandidate,
                  history: [],
                }),
              },
            );
            const botData = (await botResp.json()) as { answer?: string; error?: string };
            const answer = (botData.answer ?? "").trim();
            if (!answer) {
              console.warn("ai-vs-ai-turn: empty candidate answer", botData.error);
              return;
            }

            // Speak the answer in the candidate's voice, then inject as text
            // into the interview pipeline so the real evaluator scores it.
            await candidateVoice.speak(answer, candidateVoiceId);

            // Find the live interview hook's text-injection bridge. The page
            // exposes it via a global window hook installed in VoiceInterview.
            const submit = (window as any).__demoSubmitAnswerText as
              | ((t: string) => Promise<void>)
              | undefined;
            if (submit) {
              await submit(answer);
            } else {
              console.warn(
                "ai-vs-ai-turn: window.__demoSubmitAnswerText not installed — VoiceInterview must register it.",
              );
            }
            // Give the real interviewer pipeline time to emit the next Q + TTS.
            await sleep(8_000);
          } catch (e) {
            console.error("ai-vs-ai-turn failed:", e);
          }
          return;
        }
        case "end-live-interview": {
          // Try to find an end / "إنهاء" button; if not found, the AI may have
          // already emitted [END] and ended the interview itself.
          const endBtn =
            (await findElement("[data-tour='end-interview']", 1500)) ??
            Array.from(document.querySelectorAll("button"))
              .find((b) => /إنهاء|انهاء|end/i.test(b.textContent ?? "")) ??
            null;
          if (endBtn instanceof HTMLElement) {
            await moveCursorTo("button");
            await flashClick();
            endBtn.click();
          }
          // Capture the just-completed interview's id from the global bridge,
          // for downstream steps that navigate to /interview/:id/results.
          const lastId = (window as any).__demoLastInterviewId as string | null | undefined;
          if (lastId) runtimeCtxRef.current.lastInterviewId = lastId;
          await sleep(2_000);
          return;
        }
      }
    },
    [navigate, voice, candidateVoice, moveCursorTo, flashClick, hideCursor]
  );

  const runStep = useCallback(
    async (step: TourStep) => {
      const isSessionSwap = step.action?.kind === "swap-session";

      if (isSessionSwap) {
        await runAction(step.action!);
        if (cancelRef.current) return;
        // After swapping to the candidate session, pre-grant PDPL consents so
        // the ConsentBanner doesn't pop up mid-tour.
        if (step.action!.kind === "swap-session" && step.action!.role === "candidate") {
          await prefillDemoConsents();
        }
      }

      const resolvedRoute =
        typeof step.route === "function" ? step.route(runtimeCtxRef.current) : step.route;
      if (resolvedRoute) {
        navigate(resolvedRoute);
        await sleep(400);
      }
      if (cancelRef.current) return;

      appendTranscript({ role: "presenter", text: step.narration });
      const preloaded = preloadedAudioRef.current.get(step.id);
      // Consume the preload so re-runs (resume/next) refetch instead of reusing stale.
      if (preloaded) preloadedAudioRef.current.delete(step.id);
      const preloadedBlob = preloaded ? await preloaded.catch(() => null) : null;
      const speaking = voice
        .speak(step.narration, undefined, step.id, preloadedBlob)
        .catch((e) => {
          console.warn("voice.speak threw unexpectedly:", e);
          appendTranscript({ role: "presenter", text: "(تعذّر النطق لهذه الخطوة)" });
        });

      if (step.action && !isSessionSwap && !takeOverMode) {
        runAction(step.action).catch((e) =>
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
    [navigate, voice, appendTranscript, takeOverMode, runAction]
  );

  const start = useCallback(async () => {
    cancelRef.current = false;
    setStepIndex(0);
    setTranscript([]);
    setQaCount(0);
    runtimeCtxRef.current = { lastInterviewId: null };

    // CRITICAL: prime the audio context BEFORE any async work — this is the
    // last moment we're inside the user-gesture window for the click that
    // invoked start(). Without it, autoplay policy blocks the first TTS
    // audio.play() and the whole tour silently rushes through.
    await voice.primeAudio();
    await candidateVoice.primeAudio();

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
    hideCursor();
  }, [runStep, voice, candidateVoice, hideCursor]);

  const pause = useCallback(() => {
    cancelRef.current = true;
    voice.stop();
    candidateVoice.stop();
    setStatus("paused");
    hideCursor();
  }, [voice, candidateVoice, hideCursor]);

  const resume = useCallback(async () => {
    cancelRef.current = false;
    setStatus("running");
    for (let i = stepIndex; i < tourScript.length; i++) {
      if (cancelRef.current) return;
      setStepIndex(i);
      await runStep(tourScript[i]);
    }
    setStatus("finished");
    hideCursor();
  }, [runStep, stepIndex, hideCursor]);

  const next = useCallback(async () => {
    cancelRef.current = true;
    voice.stop();
    candidateVoice.stop();
    const ni = Math.min(stepIndex + 1, tourScript.length - 1);
    setStepIndex(ni);
    cancelRef.current = false;
    setStatus("running");
    await runStep(tourScript[ni]);
    if (ni === tourScript.length - 1) setStatus("finished");
  }, [runStep, stepIndex, voice, candidateVoice]);

  const exit = useCallback(() => {
    cancelRef.current = true;
    voice.stop();
    candidateVoice.stop();
    setStatus("idle");
    setStepIndex(0);
    setTranscript([]);
    setPendingAnswer(null);
    hideCursor();
  }, [voice, candidateVoice, hideCursor]);

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
      isSpeaking: voice.isSpeaking, takeOverMode, cursor,
      start, pause, resume, next, exit, setTakeOverMode,
      askText, beginVoiceQuestion, endVoiceQuestion,
      isRecording: voice.isRecording, transcript, pendingAnswer,
      micConsent: micConsentState, setMicConsent, qaCount, qaCap: QA_CAP,
      showActEndPrompt, actEndLabel, dismissActEndPrompt,
    }),
    [
      status, stepIndex, currentStep, voice.isSpeaking, voice.isRecording,
      takeOverMode, cursor, start, pause, resume, next, exit,
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
