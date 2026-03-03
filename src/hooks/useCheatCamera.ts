import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import fixWebmDuration from "fix-webm-duration";

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

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

  // Bind stream + start MediaRecorder
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
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

  // Stop and upload — await everything
  const stopAndUpload = useCallback(async () => {
    await sendBatch();

    if (mediaRecorderRef.current?.state === "recording") {
      await new Promise<void>((resolve) => {
        mediaRecorderRef.current!.onstop = () => resolve();
        mediaRecorderRef.current!.stop();
      });
    }
  }, [sendBatch]);

  // Upload recording blob
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
        if (error) console.error("Failed to upload cheat camera recording:", error);
        else console.log("Cheat camera recording uploaded:", fileName);
      } catch (err) {
        console.error("Error uploading cheat camera recording:", err);
      }
    };
    upload();
  }, [recordingBlob, interviewId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (framesBufferRef.current.length > 0 && interviewId) sendBatch();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      stream?.getTracks().forEach((t) => t.stop());
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    };
  }, [stream, interviewId, sendBatch]);

  return { stream, videoRef, cameraError, stopAndUpload };
};
