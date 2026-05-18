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
            "تعذّر تشغيل صوت المرشدة — اضغط مكاناً ما في الصفحة ثم 'ابدأ الجولة' مرّة أخرى.",
            { duration: 8000 },
          );
        } else if (!isAutoplayBlock) {
          console.error("audio.play() failed:", err);
        }
        cleanup();
      });
    });
  }, []);

  const speak = useCallback(
    async (text: string, voiceId: string = presenterVoiceId, cacheKey?: string): Promise<void> => {
      stop();
      setIsSpeaking(true);

      // Try pre-cached MP3 first (Phase F cost-saver).
      if (cacheKey) {
        try {
          const cacheResp = await fetch(`/demo-audio/${encodeURIComponent(cacheKey)}.mp3`);
          if (cacheResp.ok) {
            const blob = await cacheResp.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            return playAudioFromUrl(audio, [url]);
          }
        } catch {
          // Fall through to live TTS
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken =
        sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ text: cleanTextForTTS(text), voiceId }),
        }
      );

      if (!response.ok) {
        setIsSpeaking(false);
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      return playAudioFromUrl(audio, [audioUrl]);
    },
    [stop, playAudioFromUrl]
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
    isSpeaking,
    startRecording,
    stopRecording,
    isRecording,
    transcribe,
    primeAudio,
  };
}
