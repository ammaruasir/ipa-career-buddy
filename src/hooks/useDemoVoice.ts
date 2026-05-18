import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { presenterVoiceId } from "@/demo/voices";

const cleanTextForTTS = (text: string): string => text.replace(/(.)\1{2,}/g, "$1");

export function useDemoVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
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

  return { speak, stop, isSpeaking, startRecording, stopRecording, isRecording, transcribe };
}
