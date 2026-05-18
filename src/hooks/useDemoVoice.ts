import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { presenterVoiceId } from "@/demo/voices";
import { cleanTextForTTS } from "@/demo/clean-tts";

// 1×1px silent WAV used to unlock the autoplay policy under a user gesture.
// Once primed, subsequent audio.play() calls in the same tab succeed.
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function useDemoVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // Autoplay-policy state: true once the user has clicked something AND we've
  // played a silent audio to unlock subsequent programmatic plays.
  const audioPrimedRef = useRef(false);
  const autoplayWarnedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Call this from inside a click handler (e.g. the "Start tour" button)
   * BEFORE any async work. Plays a silent audio to unlock the autoplay
   * policy so subsequent TTS audio plays without being blocked.
   * Safe to call multiple times; only the first call does real work.
   */
  const primeAudio = useCallback(async (): Promise<boolean> => {
    if (audioPrimedRef.current) return true;
    try {
      const a = new Audio(SILENT_WAV_DATA_URI);
      a.volume = 0;
      // Some browsers require muted for autoplay unlock; setting both is safe.
      a.muted = true;
      await a.play();
      a.pause();
      audioPrimedRef.current = true;
      return true;
    } catch (e) {
      console.warn("primeAudio failed:", e);
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  /** Pause without releasing the audio element. Used during AI-vs-AI live
   *  interview cameos so the demo narrator yields the audio bus to the real
   *  interview pipeline, then resumes from the same script position. */
  const pause = useCallback(() => {
    if (currentAudioRef.current && !currentAudioRef.current.paused) {
      currentAudioRef.current.pause();
    }
  }, []);

  const resume = useCallback(async () => {
    if (currentAudioRef.current && currentAudioRef.current.paused) {
      try {
        await currentAudioRef.current.play();
      } catch (e) {
        console.warn("voice.resume failed:", e);
      }
    }
  }, []);

  const playAudioFromUrl = useCallback((audio: HTMLAudioElement, urlsToRevoke: string[]) => {
    currentAudioRef.current = audio;
    return new Promise<void>((resolve) => {
      const cleanup = () => {
        urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
        currentAudioRef.current = null;
        setIsSpeaking(false);
        resolve();
      };
      audio.onended = cleanup;
      audio.onerror = (err) => {
        console.warn("Audio element error:", err);
        cleanup();
      };
      audio.play().catch((err) => {
        // Don't silently swallow — most common case is autoplay block.
        const isAutoplayBlock =
          err?.name === "NotAllowedError" || /play\(\) failed/i.test(String(err?.message ?? ""));
        if (isAutoplayBlock && !autoplayWarnedRef.current) {
          autoplayWarnedRef.current = true;
          toast.error(
            "تعذّر تشغيل صوت المرشد — اضغط مكاناً ما في الصفحة ثم 'ابدأ الجولة' مرّة أخرى.",
            { duration: 8000 },
          );
        } else if (!isAutoplayBlock) {
          console.error("audio.play() failed:", err);
        }
        cleanup();
      });
    });
  }, []);

  /**
   * Low-level fetch used by both speak() and provider-side preload. Bounded
   * with a 12s timeout so a stalled upstream never wedges the tour. Returns
   * null on failure (caller decides what to do).
   */
  const fetchTtsBlob = useCallback(
    async (text: string, voiceId: string = presenterVoiceId): Promise<Blob | null> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-wakeb-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ text: cleanTextForTTS(text), voiceId }),
            signal: ctrl.signal,
          },
        );
        if (!response.ok) {
          console.warn(`demo-wakeb-tts failed: ${response.status}`);
          return null;
        }
        return await response.blob();
      } catch (e) {
        console.warn("demo-wakeb-tts fetch error:", e);
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    [],
  );

  const ttsFailureWarnedRef = useRef(false);
  const warnTtsFailureOnce = useCallback(() => {
    if (ttsFailureWarnedRef.current) return;
    ttsFailureWarnedRef.current = true;
    toast.error("تعذّر تشغيل الصوت — تكمل الجولة بدون نطق.", { duration: 6000 });
  }, []);

  const speak = useCallback(
    async (
      text: string,
      voiceId: string = presenterVoiceId,
      cacheKey?: string,
      preloadedBlob?: Blob | null,
    ): Promise<void> => {
      stop();
      setIsSpeaking(true);

      // 1. Preloaded blob (provider-side first-step preload) — fastest path.
      if (preloadedBlob && preloadedBlob.size > 0) {
        const url = URL.createObjectURL(preloadedBlob);
        const audio = new Audio(url);
        return playAudioFromUrl(audio, [url]);
      }

      // 2. Pre-cached MP3 shipped in /public/demo-audio (Phase F). Validate
      // Content-Type — in dev/preview, missing files are rewritten to the
      // SPA HTML shell with 200, which would otherwise be played as "audio".
      if (cacheKey) {
        try {
          const cacheResp = await fetch(`/demo-audio/${encodeURIComponent(cacheKey)}.mp3`);
          const ct = cacheResp.headers.get("content-type") ?? "";
          if (cacheResp.ok && /^audio\//i.test(ct)) {
            const blob = await cacheResp.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            return playAudioFromUrl(audio, [url]);
          }
        } catch {
          // Fall through to live TTS
        }
      }

      // 3. Live TTS — non-throwing. On failure, degrade gracefully to silent
      // narration so the tour keeps moving instead of freezing the engine.
      const audioBlob = await fetchTtsBlob(text, voiceId);
      if (!audioBlob) {
        warnTtsFailureOnce();
        setIsSpeaking(false);
        return;
      }
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      return playAudioFromUrl(audio, [audioUrl]);
    },
    [stop, playAudioFromUrl, fetchTtsBlob, warnTtsFailureOnce],
  );

  const startRecording = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      recordingResolveRef.current?.(blob);
      recordingResolveRef.current = null;
      setIsRecording(false);
    };
    recorder.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      recordingResolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const transcribe = useCallback(async (audioBlob: Blob): Promise<string> => {
    const form = new FormData();
    form.append("audio", audioBlob, "demo-question.webm");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-transcribe`,
      {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: form,
      }
    );
    if (!response.ok) throw new Error(`STT failed: ${response.status}`);
    const data = await response.json();
    return (data.transcription ?? "").trim();
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    startRecording,
    stopRecording,
    isRecording,
    transcribe,
    primeAudio,
  };
}
