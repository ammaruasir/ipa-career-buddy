import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Play } from "lucide-react";

interface VideoPlaybackProps {
  interviewId: string;
  userId: string;
  recordingUrl?: string | null;
  interviewType?: string;
}

interface RecordingFile {
  name: string;
  url: string;
  label: string;
}

const VideoPlayback = ({ interviewId, userId, recordingUrl, interviewType }: VideoPlaybackProps) => {
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecordings = async () => {
      const files: RecordingFile[] = [];

      // If recordingUrl is a relative path (not a full URL), get signed URL
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
          // Legacy full URL — try to extract path and get signed URL
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

      // List per-question recordings from storage (list all files then filter)
      try {
        const { data: storageFiles } = await supabase.storage
          .from("interview-recordings")
          .list(userId);

        if (storageFiles) {
          // Also check for full recording if not found via recordingUrl
          for (const file of storageFiles) {
            if (!file.name.includes(interviewId)) continue;

            // Full recording fallback
            if (file.name.includes("_full") && files.length === 0) {
              const { data: signedData } = await supabase.storage
                .from("interview-recordings")
                .createSignedUrl(`${userId}/${file.name}`, 3600);
              if (signedData?.signedUrl) {
                files.push({ name: file.name, url: signedData.signedUrl, label: "التسجيل الكامل" });
              }
              continue;
            }

            // Cheat cam recording
            if (file.name.includes("_cheat_cam")) {
              const { data: signedData } = await supabase.storage
                .from("interview-recordings")
                .createSignedUrl(`${userId}/${file.name}`, 3600);
              if (signedData?.signedUrl) {
                files.push({ name: file.name, url: signedData.signedUrl, label: "كاميرا المراقبة" });
              }
              continue;
            }

            // Per-question recordings
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
        }
      } catch (err) {
        console.error("Error listing recordings:", err);
      }

      setRecordings(files);
      if (files.length > 0) setActiveVideo(files[0].url);
      setLoading(false);
    };

    loadRecordings();
  }, [interviewId, userId, recordingUrl]);

  if (loading) return null;
  if (recordings.length === 0) {
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

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          تسجيلات المقابلة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeVideo && (
          <div className="rounded-xl overflow-hidden bg-muted aspect-video">
            <video
              src={activeVideo}
              controls
              className="w-full h-full object-contain"
              key={activeVideo}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {recordings.map((rec) => (
            <Button
              key={rec.name}
              variant={activeVideo === rec.url ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => setActiveVideo(rec.url)}
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
