import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Play, Download } from "lucide-react";

interface VideoPlaybackProps {
  interviewId: string;
  userId: string;
  recordingUrl?: string | null;
}

interface RecordingFile {
  name: string;
  url: string;
  label: string;
}

const VideoPlayback = ({ interviewId, userId, recordingUrl }: VideoPlaybackProps) => {
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecordings = async () => {
      const files: RecordingFile[] = [];

      // Add full recording if available
      if (recordingUrl) {
        files.push({ name: "full", url: recordingUrl, label: "التسجيل الكامل" });
      }

      // List per-question recordings from storage
      try {
        const { data: storageFiles } = await supabase.storage
          .from("interview-recordings")
          .list(`${userId}`, { search: interviewId });

        if (storageFiles) {
          for (const file of storageFiles) {
            if (file.name.includes(interviewId)) {
              const { data: urlData } = supabase.storage
                .from("interview-recordings")
                .getPublicUrl(`${userId}/${file.name}`);

              // Try to get a signed URL since bucket is private
              const { data: signedData } = await supabase.storage
                .from("interview-recordings")
                .createSignedUrl(`${userId}/${file.name}`, 3600);

              const url = signedData?.signedUrl || urlData?.publicUrl;
              if (!url) continue;

              const qMatch = file.name.match(/_q(\d+)_/);
              const label = qMatch ? `تسجيل السؤال ${qMatch[1]}` : file.name;

              if (!file.name.includes("_full")) {
                files.push({ name: file.name, url, label });
              }
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
  if (recordings.length === 0) return null;

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
