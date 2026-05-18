import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChunkReadyEvent } from "@/hooks/useProctorChannel";

interface UseProctorViewerOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  mimeType: "video/webm" | "audio/webm";
}

interface ViewerState {
  bufferedChunks: number;
  totalDurationMs: number;
  lastChunkAt: Date | null;
  error: string | null;
}

/**
 * Admin-side live playback. Holds an open MediaSource and appends incoming
 * chunks as the trainee uploads them. Total latency ≈ chunk size (30s).
 */
export const useProctorViewer = ({ videoRef, enabled, mimeType }: UseProctorViewerOptions) => {
  const [state, setState] = useState<ViewerState>({
    bufferedChunks: 0,
    totalDurationMs: 0,
    lastChunkAt: null,
    error: null,
  });

  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const appendQueueRef = useRef<ArrayBuffer[]>([]);
  const initializedRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);

  const processQueue = useCallback(() => {
    const sb = sourceBufferRef.current;
    if (!sb || sb.updating) return;
    const next = appendQueueRef.current.shift();
    if (!next) return;
    try {
      sb.appendBuffer(next);
    } catch (e) {
      console.error("[Proctor] appendBuffer threw:", e);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !videoRef.current) return;

    const codec = mimeType.startsWith("video")
      ? 'video/webm;codecs="vp8,opus"'
      : 'audio/webm;codecs="opus"';

    if (!MediaSource.isTypeSupported(codec)) {
      setState((s) => ({ ...s, error: `Codec ${codec} not supported` }));
      return;
    }

    const ms = new MediaSource();
    mediaSourceRef.current = ms;
    objectUrlRef.current = URL.createObjectURL(ms);
    videoRef.current.src = objectUrlRef.current;

    const handleOpen = () => {
      try {
        const sb = ms.addSourceBuffer(codec);
        sb.mode = "sequence";
        sb.addEventListener("updateend", processQueue);
        sourceBufferRef.current = sb;
        initializedRef.current = true;
        processQueue();
      } catch (e) {
        console.error("[Proctor] addSourceBuffer failed:", e);
        setState((s) => ({ ...s, error: "MSE init failed" }));
      }
    };
    ms.addEventListener("sourceopen", handleOpen);

    return () => {
      ms.removeEventListener("sourceopen", handleOpen);
      sourceBufferRef.current?.removeEventListener("updateend", processQueue);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
      mediaSourceRef.current = null;
      sourceBufferRef.current = null;
      initializedRef.current = false;
      appendQueueRef.current = [];
    };
  }, [enabled, mimeType, processQueue, videoRef]);

  const enqueueChunk = useCallback(async (event: ChunkReadyEvent) => {
    try {
      const { data: signed } = await supabase.storage
        .from("interview-recordings")
        .createSignedUrl(event.path, 3600);
      if (!signed?.signedUrl) return;

      const resp = await fetch(signed.signedUrl);
      if (!resp.ok) return;
      const buf = await resp.arrayBuffer();

      appendQueueRef.current.push(buf);
      setState((s) => ({
        bufferedChunks: s.bufferedChunks + 1,
        totalDurationMs: s.totalDurationMs + event.duration_ms,
        lastChunkAt: new Date(),
        error: s.error,
      }));

      if (initializedRef.current) processQueue();
    } catch (e) {
      console.error("[Proctor] enqueueChunk failed:", e);
    }
  }, [processQueue]);

  const backfillFromManifest = useCallback(async (chunksPath: string) => {
    // When admin opens an in-progress session, load any chunks that uploaded
    // before they joined. Manifest may not exist yet (interview still going),
    // so list the folder directly.
    try {
      const folder = chunksPath.replace(/\/$/, "");
      const { data: files } = await supabase.storage
        .from("interview-recordings")
        .list(folder);
      if (!files) return;
      const chunkFiles = files
        .filter((f) => /^chunk_\d+\.webm$/.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const f of chunkFiles) {
        await enqueueChunk({
          index: parseInt(f.name.match(/\d+/)?.[0] ?? "0", 10),
          path: `${folder}/${f.name}`,
          duration_ms: 30000,
          size_bytes: f.metadata?.size ?? 0,
        });
      }
    } catch (e) {
      console.error("[Proctor] backfill failed:", e);
    }
  }, [enqueueChunk]);

  return { state, enqueueChunk, backfillFromManifest };
};
