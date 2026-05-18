import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseCheatCameraOptions {
  enabled: boolean;
  interviewId: string | null;
  captureIntervalMs?: number;
  batchIntervalMs?: number;
}

// Convert Blob to base64 data URL
const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Proctoring helper that opens a low-res second camera stream and periodically
 * snapshots frames to the analyze-video edge function (phone / extra-person /
 * gaze detection).
 *
 * Note: the actual session video recording is handled by useLiveInterview's
 * chunked recorder for voice/video interviews, and by TextInterview's own
 * session recorder for text interviews. This hook deliberately does NOT
 * record video on its own — that previously produced a duplicate, low-res,
 * metadata-broken _cheat_cam.webm that confused the admin playback UI.
 */
export const useCheatCamera = ({
  enabled,
  interviewId,
  captureIntervalMs = 2000,
  batchIntervalMs = 10000,
}: UseCheatCameraOptions) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesBufferRef = useRef<Blob[]>([]);

  // Start camera
  useEffect(() => {
    if (!enabled || !interviewId) return;
    let cancelled = false;
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: false,
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
    return () => { cancelled = true; };
  }, [enabled, interviewId]);

  // Bind stream to local <video> for frame capture
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, interviewId]);

  // Capture frame as Blob (not base64)
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) framesBufferRef.current.push(blob);
      },
      "image/jpeg",
      0.6
    );
  }, []);

  // Send batch — convert Blobs to data URLs only at send time
  const sendBatch = useCallback(async () => {
    const frames = framesBufferRef.current;
    if (frames.length === 0 || !interviewId) return;

    const batch = [...frames];
    framesBufferRef.current = [];

    try {
      const dataUrls = await Promise.all(batch.map(blobToDataUrl));
      await supabase.functions.invoke("analyze-video", {
        body: {
          response_id: null,
          frames: dataUrls,
          answer_text: "",
          question_text: "",
          interview_id: interviewId,
        },
      });
    } catch (err) {
      console.error("Cheat camera batch analysis failed:", err);
    }
  }, [interviewId]);

  // Periodic capture & batch send
  useEffect(() => {
    if (!stream || !interviewId) return;
    captureIntervalRef.current = setInterval(captureFrame, captureIntervalMs);
    batchIntervalRef.current = setInterval(sendBatch, batchIntervalMs);
    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    };
  }, [stream, interviewId, captureIntervalMs, batchIntervalMs, captureFrame, sendBatch]);

  // Flush any pending frames before the interview ends.
  const stopAndUpload = useCallback(async () => {
    await sendBatch();
  }, [sendBatch]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (framesBufferRef.current.length > 0 && interviewId) sendBatch();
      stream?.getTracks().forEach((t) => t.stop());
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    };
  }, [stream, interviewId, sendBatch]);

  return { stream, videoRef, cameraError, stopAndUpload };
};
