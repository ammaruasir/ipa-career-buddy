import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import fixWebmDuration from "fix-webm-duration";

interface UseCheatCameraOptions {
  enabled: boolean;
  interviewId: string | null;
  captureIntervalMs?: number; // local capture interval (default 1s)
  batchIntervalMs?: number;   // batch send interval (default 10s)
}

export const useCheatCamera = ({
  enabled,
  interviewId,
  captureIntervalMs = 1000,
  batchIntervalMs = 10000,
}: UseCheatCameraOptions) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesBufferRef = useRef<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  // Start camera when enabled and interviewId is set
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

    return () => {
      cancelled = true;
    };
  }, [enabled, interviewId]);

  // Bind stream to video element + start MediaRecorder for full session recording
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    // Start MediaRecorder for full session recording
    if (stream && interviewId) {
      try {
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          const rawBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          if (rawBlob.size > 0) {
            const duration = Date.now() - (recordingStartRef.current || Date.now());
            try {
              const fixedBlob = await fixWebmDuration(rawBlob, duration);
              setRecordingBlob(fixedBlob);
            } catch {
              setRecordingBlob(rawBlob);
            }
          }
        };
        recorder.start(5000);
        recordingStartRef.current = Date.now();
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.error("Failed to start cheat camera MediaRecorder:", err);
      }
    }
  }, [stream, interviewId]);

  // Capture single frame
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const frame = canvas.toDataURL("image/jpeg", 0.4);
    framesBufferRef.current.push(frame);
  }, []);

  // Send batch of frames for analysis
  const sendBatch = useCallback(() => {
    const frames = framesBufferRef.current;
    if (frames.length === 0 || !interviewId) return;

    // Take all buffered frames and clear
    const batch = [...frames];
    framesBufferRef.current = [];

    // Fire and forget
    supabase.functions
      .invoke("analyze-video", {
        body: {
          response_id: null,
          frames: batch,
          answer_text: "",
          question_text: "",
          interview_id: interviewId,
        },
      })
      .catch((err) => console.error("Cheat camera batch analysis failed:", err));
  }, [interviewId]);

  // Start periodic capture (every 1s) and batch send (every 10s)
  useEffect(() => {
    if (!stream || !interviewId) return;

    captureIntervalRef.current = setInterval(captureFrame, captureIntervalMs);
    batchIntervalRef.current = setInterval(sendBatch, batchIntervalMs);

    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    };
  }, [stream, interviewId, captureIntervalMs, batchIntervalMs, captureFrame, sendBatch]);

  // Stop recording and upload when interviewId becomes null or component unmounts
  const stopAndUpload = useCallback(async () => {
    // Send remaining frames
    sendBatch();

    // Stop MediaRecorder
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [sendBatch]);

  // Upload recording blob when available
  useEffect(() => {
    if (!recordingBlob || !interviewId) return;

    const upload = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fileName = `${user.id}/${interviewId}_cheat_cam.webm`;
        const { error } = await supabase.storage
          .from("interview-recordings")
          .upload(fileName, recordingBlob, { contentType: "video/webm", upsert: true });

        if (error) {
          console.error("Failed to upload cheat camera recording:", error);
        } else {
          console.log("Cheat camera recording uploaded:", fileName);
        }
      } catch (err) {
        console.error("Error uploading cheat camera recording:", err);
      }
    };

    upload();
  }, [recordingBlob, interviewId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Send remaining frames
      if (framesBufferRef.current.length > 0 && interviewId) {
        sendBatch();
      }
      // Stop recorder
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      stream?.getTracks().forEach((t) => t.stop());
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    };
  }, [stream, interviewId, sendBatch]);

  return { stream, videoRef, cameraError, stopAndUpload };
};
