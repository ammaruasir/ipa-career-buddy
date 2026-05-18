import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Radio, Clock, User } from "lucide-react";

interface InProgressInterview {
  id: string;
  user_id: string;
  type: string;
  job_position: string | null;
  mode: string;
  created_at: string;
  recording_status: string | null;
  recording_chunk_count: number | null;
  candidate_name?: string;
}

const ALLOWED_ROLES = ["admin", "hr", "instructor"];

const LiveProctor = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InProgressInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && !ALLOWED_ROLES.includes(role)) { navigate("/dashboard"); return; }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user || !role || !ALLOWED_ROLES.includes(role)) return;

    const load = async () => {
      setLoading(true);
      const { data: ivs } = await supabase
        .from("interviews")
        .select("id, user_id, type, job_position, mode, created_at, recording_status, recording_chunk_count")
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });

      const userIds = [...new Set((ivs ?? []).map((i: any) => i.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] as { user_id: string; full_name: string | null }[] };

      const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      const merged: InProgressInterview[] = (ivs ?? []).map((i: any) => ({
        ...i,
        candidate_name: nameMap.get(i.user_id) ?? "—",
      }));
      setInterviews(merged);
      setLoading(false);
    };

    load();

    // Refresh whenever an interview transitions state.
    const channel = supabase
      .channel("admin-proctor-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "interviews" }, () => load())
      .subscribe();

    const interval = setInterval(load, 15000); // belt-and-braces refresh

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, role]);

  const formatElapsed = (createdAt: string) => {
    const elapsed = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(elapsed / 60000);
    if (mins < 60) return `${mins} د`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} س ${mins % 60} د`;
  };

  const modeLabel = (m: string) => {
    switch (m) {
      case "practice": return "تدريب";
      case "assessment": return "تقييم";
      case "mock_final": return "بروفة";
      default: return m;
    }
  };

  const typeLabel = (t: string) => {
    switch (t) {
      case "text": return "نصية";
      case "voice": return "صوتية";
      case "video": return "فيديو";
      default: return t;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="w-6 h-6 text-destructive animate-pulse" />
              المراقبة المباشرة
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              المقابلات الجارية حالياً. اضغط لمشاهدتها مباشرة (تأخير ~30 ثانية).
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" className="rounded-xl">العودة</Button>
          </Link>
        </div>

        {interviews.length === 0 ? (
          <Card className="rounded-2xl p-12 text-center">
            <Radio className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد مقابلات جارية حالياً.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {interviews.map((iv) => (
              <Card key={iv.id} className="rounded-2xl p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{iv.candidate_name}</div>
                      <div className="text-xs text-muted-foreground">{iv.job_position ?? "—"}</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {modeLabel(iv.mode)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatElapsed(iv.created_at)}</span>
                  <span className="text-foreground/40">·</span>
                  <span>{typeLabel(iv.type)}</span>
                  {iv.recording_chunk_count !== null && iv.recording_chunk_count > 0 && (
                    <>
                      <span className="text-foreground/40">·</span>
                      <span>{iv.recording_chunk_count} مقطع</span>
                    </>
                  )}
                </div>

                <Link to={`/admin/proctor/${iv.id}`}>
                  <Button size="sm" className="rounded-xl w-full gap-2">
                    <Eye className="w-4 h-4" />
                    شاهد المقابلة
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveProctor;
