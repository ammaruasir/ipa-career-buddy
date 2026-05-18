import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Play, AlertTriangle, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

interface VideoPlaybackProps {
  interviewId: string;
  userId: string;
  recordingUrl?: string | null;
  recordingChunksPath?: string | null;
  recordingDurationMs?: number | null;
  recordingChunkCount?: number | null;
  recordingStatus?: string | null;
  interviewType?: string;
}

interface RecordingFile {
  name: string;
  url: string;
  label: string;
}

interface ChunkMeta {
  index: number;
  path: string;
  duration_ms: number;
  size_bytes: number;
}

interface Manifest {
  version: number;
  interview_id: string;
  total_duration_ms: number;
  chunk_count: number;
  mime_type: string;
  chunks: ChunkMeta[];
  completed_at: string;
}

/**
 * Chunked playback: read manifest.json, sign each chunk URL, append the
 * chunks sequentially into a MediaSource so the admin gets seamless playback
 * with full duration + seekability across the entire recording.
 */
const useChunkedPlayback = (
  videoRef: React.RefObject<HTMLVideoElement>,
  recordingChunksPath: string | null | undefined,
  recordingUrl: string | null | undefined,
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    setError(null);
    setManifestLoaded(false);

    const manifestPath =
      recordingUrl && recordingUrl.endsWith("manifest.json")
        ? recordingUrl
        : recordingChunksPath
          ? `${recordingChunksPath.replace(/\/$/, "")}/manifest.json`
          : null;

    if (!manifestPath || !videoRef.current) return;

    let mediaSource: MediaSource | null = null;
    let cleanupUrl: string | null = null;
    setLoading(true);

    (async () => {
      try {
        // Fetch manifest
        const { data: signed, error: signErr } = await supabase.storage
          .from("interview-recordings")
          .createSignedUrl(manifestPath, 3600);
        if (signErr || !signed?.signedUrl) {
          throw new Error("Could not sign manifest URL");
        }
        const manifestResp = await fetch(signed.signedUrl);
        if (!manifestResp.ok) throw new Error("Manifest fetch failed");
        const manifest: Manifest = await manifestResp.json();
        if (!manifest.chunks?.length) {
          throw new Error("Manifest contains no chunks");
        }

        if (abortRef.current) return;
        setManifestLoaded(true);

        // Set up MediaSource
        const video = videoRef.current;
        if (!video) return;
        mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        cleanupUrl = URL.createObjectURL(mediaSource);
        video.src = cleanupUrl;

        const codec = manifest.mime_type.startsWith("video")
          ? 'video/webm;codecs="vp8,opus"'
          : 'audio/webm;codecs="opus"';

        await new Promise<void>((resolve, reject) => {
          if (!mediaSource) return reject(new Error("MediaSource gone"));
          mediaSource.addEventListener("sourceopen", () => resolve(), { once: true });
          mediaSource.addEventListener("error", () => reject(new Error("MediaSource error")), { once: true });
        });

        if (abortRef.current || !mediaSource) return;

        if (!MediaSource.isTypeSupported(codec)) {
          // Fall back to letting the browser pick — single src; lose seamless playback
          throw new Error(`Codec ${codec} not supported by MSE`);
        }

        const sourceBuffer = mediaSource.addSourceBuffer(codec);
        sourceBuffer.mode = "sequence";

        // Sign all chunk URLs in parallel for speed
        const signedUrls = await Promise.all(
          manifest.chunks.map(async (chunk) => {
            const { data } = await supabase.storage
              .from("interview-recordings")
              .createSignedUrl(chunk.path, 3600);
            return data?.signedUrl ?? null;
          })
        );

        const appendBuffer = (data: ArrayBuffer): Promise<void> =>
          new Promise((resolve, reject) => {
            if (!sourceBuffer) return reject(new Error("No source buffer"));
            const onUpdateEnd = () => {
              sourceBuffer.removeEventListener("updateend", onUpdateEnd);
              sourceBuffer.removeEventListener("error", onError);
              resolve();
            };
            const onError = () => {
              sourceBuffer.removeEventListener("updateend", onUpdateEnd);
              sourceBuffer.removeEventListener("error", onError);
              reject(new Error("appendBuffer error"));
            };
            sourceBuffer.addEventListener("updateend", onUpdateEnd);
            sourceBuffer.addEventListener("error", onError);
            try {
              sourceBuffer.appendBuffer(data);
            } catch (e) {
              sourceBuffer.removeEventListener("updateend", onUpdateEnd);
              sourceBuffer.removeEventListener("error", onError);
              reject(e);
            }
          });

        for (let i = 0; i < signedUrls.length; i++) {
          if (abortRef.current) return;
          const url = signedUrls[i];
          if (!url) continue;
          try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const buf = await resp.arrayBuffer();
            await appendBuffer(buf);
          } catch (e) {
            console.warn(`[Playback] Chunk ${i} append failed:`, e);
          }
        }

        if (mediaSource.readyState === "open") {
          try { mediaSource.endOfStream(); } catch { /* ignore */ }
        }
        setLoading(false);
      } catch (e) {
        console.error("[Playback] Chunked playback failed:", e);
        setError((e as Error).message);
        setLoading(false);
      }
    })();

    return () => {
      abortRef.current = true;
      if (cleanupUrl) URL.revokeObjectURL(cleanupUrl);
      if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
        try { mediaSourceRef.current.endOfStream(); } catch { /* ignore */ }
      }
      mediaSourceRef.current = null;
    };
  }, [recordingChunksPath, recordingUrl, videoRef]);

  return { loading, error, manifestLoaded };
};

const VideoPlayback = ({
  interviewId,
  userId,
  recordingUrl,
  recordingChunksPath,
  recordingDurationMs,
  recordingChunkCount,
  recordingStatus,
  interviewType,
}: VideoPlaybackProps) => {
  const [legacyRecordings, setLegacyRecordings] = useState<RecordingFile[]>([]);
  const [activeLegacyVideo, setActiveLegacyVideo] = useState<string | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const chunkedVideoRef = useRef<HTMLVideoElement>(null);

  const isChunked =
    !!recordingChunksPath ||
    (typeof recordingUrl === "string" && recordingUrl.endsWith("manifest.json"));

  const chunked = useChunkedPlayback(chunkedVideoRef, recordingChunksPath, recordingUrl);

  // Load legacy single-file recordings (for old interviews without chunks).
  useEffect(() => {
    if (isChunked) {
      setLegacyLoading(false);
      return;
    }
    const loadRecordings = async () => {
      const files: RecordingFile[] = [];

      if (recordingUrl) {
        const isRelativePath = !recordingUrl.startsWith("http");
        if (isRelativePath) {
          const { data: signedData } = await supabase.storage
            .from("interview-recordings")
            .createSignedUrl(recordingUrl, 3600);
          if (signedData?.signedUrl) {
            files.push({ name: "full", url: signedData.signedUrl, label: "التسجيل الكامل" });
          }
        } else {
          const match = recordingUrl.match(/interview-recordings\/(.+)$/);
          if (match) {
            const { data: signedData } = await supabase.storage
              .from("interview-recordings")
              .createSignedUrl(match[1], 3600);
            if (signedData?.signedUrl) {
              files.push({ name: "full", url: signedData.signedUrl, label: "التسجيل الكامل" });
            }
          }
        }
      }

      try {
        const { data: storageFiles } = await supabase.storage
          .from("interview-recordings")
          .list(userId);

        if (storageFiles) {
          let hasFullRecording = files.length > 0;
          let partialFile: typeof storageFiles[0] | null = null;

          for (const file of storageFiles) {
            if (!file.name.includes(interviewId)) continue;
            if (file.name.includes("_cheat_cam")) continue; // removed in chunked recording PR

            if (file.name.includes("_full") && !hasFullRecording) {
              const { data: signedData } = await supabase.storage
                .from("interview-recordings")
                .createSignedUrl(`${userId}/${file.name}`, 3600);
              if (signedData?.signedUrl) {
                files.push({ name: file.name, url: signedData.signedUrl, label: "التسجيل الكامل" });
                hasFullRecording = true;
              }
              continue;
            }
            if (file.name.includes("_partial")) {
              partialFile = file;
              continue;
            }
            if (!file.name.includes("_full")) {
              const { data: signedData } = await supabase.storage
                .from("interview-recordings")
                .createSignedUrl(`${userId}/${file.name}`, 3600);
              if (!signedData?.signedUrl) continue;
              const qMatch = file.name.match(/_q(\d+)_/);
              const label = qMatch ? `تسجيل السؤال ${qMatch[1]}` : file.name;
              files.push({ name: file.name, url: signedData.signedUrl, label });
            }
          }

          if (!hasFullRecording && partialFile) {
            const { data: signedData } = await supabase.storage
              .from("interview-recordings")
              .createSignedUrl(`${userId}/${partialFile.name}`, 3600);
            if (signedData?.signedUrl) {
              files.push({ name: partialFile.name, url: signedData.signedUrl, label: "تسجيل جزئي" });
            }
          }
        }
      } catch (err) {
        console.error("Error listing recordings:", err);
      }

      setLegacyRecordings(files);
      if (files.length > 0) setActiveLegacyVideo(files[0].url);
      setLegacyLoading(false);
    };

    loadRecordings();
  }, [interviewId, userId, recordingUrl, isChunked]);

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const { error } = await supabase.functions.invoke("repair-recording", {
        body: { interview_id: interviewId },
      });
      if (error) throw error;
      toast.success("تم إصلاح التسجيل — أعد تحميل الصفحة");
    } catch (e) {
      console.error("Repair failed:", e);
      toast.error("فشل إصلاح التسجيل");
    } finally {
      setRepairing(false);
    }
  };

  const statusBanner = (() => {
    if (recordingStatus === "incomplete") {
      return (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">
            هذا التسجيل غير مكتمل — انتهت الجلسة قبل اكتمالها. {recordingChunkCount ? `${recordingChunkCount} مقطع تم استرجاعها.` : ""}
          </p>
        </div>
      );
    }
    if (recordingStatus === "failed") {
      return (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">فشل التسجيل بالكامل — لا توجد مقاطع متاحة للمشاهدة.</p>
        </div>
      );
    }
    return null;
  })();

  const totalMin = recordingDurationMs ? Math.floor(recordingDurationMs / 60000) : null;
  const totalSec = recordingDurationMs ? Math.floor((recordingDurationMs % 60000) / 1000) : null;
  const durationLabel = totalMin !== null && totalSec !== null
    ? `${totalMin}:${String(totalSec).padStart(2, "0")}`
    : null;

  // Chunked path
  if (isChunked) {
    return (
      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            تسجيل المقابلة
            {durationLabel && (
              <span className="text-xs font-normal text-muted-foreground mr-2">
                ({durationLabel} · {recordingChunkCount ?? "?"} مقاطع)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusBanner}
          <div className="rounded-xl overflow-hidden bg-muted aspect-video relative">
            <video
              ref={chunkedVideoRef}
              controls
              className="w-full h-full object-contain"
            />
            {chunked.loading && !chunked.manifestLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          {chunked.error && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>تعذّر تشغيل التسجيل المقطّع: {chunked.error}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-2 self-start"
                onClick={handleRepair}
                disabled={repairing}
              >
                {repairing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                إصلاح التسجيل
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Legacy single-file path
  if (legacyLoading) return null;
  if (legacyRecordings.length === 0) {
    if (interviewType === "video" || interviewType === "voice") {
      return (
        <Card className="rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              تسجيلات المقابلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              لا يوجد تسجيل فيديو متاح لهذه المقابلة
            </p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const isPartial = legacyRecordings.some((r) => r.name.includes("_partial")) && !legacyRecordings.some((r) => r.name.includes("_full"));

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          تسجيلات المقابلة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPartial && (
          <div className="flex items-start justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm">
                هذا تسجيل جزئي — قد لا يعرض كامل المقابلة. يمكنك محاولة إصلاحه.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-2 shrink-0"
              onClick={handleRepair}
              disabled={repairing}
            >
              {repairing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
              إصلاح
            </Button>
          </div>
        )}
        {activeLegacyVideo && (
          <div className="rounded-xl overflow-hidden bg-muted aspect-video">
            <video
              src={activeLegacyVideo}
              controls
              className="w-full h-full object-contain"
              key={activeLegacyVideo}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {legacyRecordings.map((rec) => (
            <Button
              key={rec.name}
              variant={activeLegacyVideo === rec.url ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => setActiveLegacyVideo(rec.url)}
            >
              <Play className="w-3 h-3" />
              {rec.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoPlayback;
