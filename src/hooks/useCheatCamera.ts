import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseCheatCameraOptions {
  enabled: boolean;
  interviewId: string | null;
  captureIntervalMs?: number;
}

export const useCheatCamera = ({
  enabled,
  interviewId,
  captureIntervalMs = 30000,
}: UseCheatCameraOptions) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start camera when enabled and interviewId is set
  useEffect(() => {
    if (!enabled || !interviewId) return;

    let cancelled = false;
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(mediaStream);
      } catch {
        setCameraError(true);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
    };
  }, [enabled, interviewId]);

  // Bind stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Capture and analyze frames periodically
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || !interviewId) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const frame = canvas.toDataURL("image/jpeg", 0.5);

    // Fire and forget
    supabase.functions
      .invoke("analyze-video", {
        body: {
          response_id: null,
          frames: [frame],
          answer_text: "",
          question_text: "",
          interview_id: interviewId,
        },
      })
      .catch((err) => console.error("Cheat camera analysis failed:", err));
  }, [interviewId]);

  // Start periodic capture
  useEffect(() => {
    if (!stream || !interviewId) return;

    intervalRef.current = setInterval(captureFrame, captureIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stream, interviewId, captureIntervalMs, captureFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stream]);

  return { stream, videoRef, cameraError };
};
