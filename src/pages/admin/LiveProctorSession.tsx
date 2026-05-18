import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useProctorChannel } from "@/hooks/useProctorChannel";
import { useProctorViewer } from "@/hooks/useProctorViewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Radio, Send, Flag, StopCircle, Phone, UserPlus, Eye, AlertTriangle, Camera,
} from "lucide-react";

const ALLOWED_ROLES = ["admin", "hr", "instructor"];

interface InterviewRow {
  id: string;
  user_id: string;
  type: string;
  job_position: string | null;
  mode: string;
  status: string;
  created_at: string;
  recording_chunks_path: string | null;
  flagged_at: string | null;
  flagged_reason: string | null;
}

interface CheatEvent {
  id: string;
  event_type: string;
  details: string | null;
  frame_url: string | null;
  created_at: string;
}

interface ResponseRow {
  id: string;
  question_text: string | null;
  answer_text: string | null;
  created_at: string;
}

const LiveProctorSession = () => {
  const { interviewId } = useParams<{ interviewId: string }>();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const proctorSessionIdRef = useRef<string | null>(null);

  const [interview, setInterview] = useState<InterviewRow | null>(null);
  const [candidateName, setCandidateName] = useState<string>("");
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [cheatEvents, setCheatEvents] = useState<CheatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [traineePresent, setTraineePresent] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [endReason, setEndReason] = useState("");
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);

  const mimeType: "video/webm" | "audio/webm" =
    interview?.type === "text" || interview?.type === "voice" ? "audio/webm" : "video/webm";

  const { state: viewerState, enqueueChunk, backfillFromManifest } = useProctorViewer({
    videoRef,
    enabled: !!interview && !!interview.recording_chunks_path,
    mimeType,
  });

  const proctorRole: "admin" | "hr" | "instructor" =
    role === "admin" ? "admin" : role === "hr" ? "hr" : "instructor";

  const { broadcastAdminMessage, broadcastForceEnd } = useProctorChannel({
    interviewId: interviewId ?? null,
    userId: user?.id ?? null,
    enabled: !!interviewId && !!user?.id && !!interview,
    role: proctorRole,
    onChunkReady: (event) => enqueueChunk(event),
    onPresenceChange: (peers) => {
      // Trainee presence appears if anyone with role=trainee is in the channel.
      // useProctorChannel filters those out from the proctors list, so use a
      // separate channel query for trainee presence indicator.
    },
  });

  // Auth gate.
  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && !ALLOWED_ROLES.includes(role)) { navigate("/dashboard"); return; }
  }, [user, role, authLoading, navigate]);

  // Load interview row + initial transcript and cheat events.
  useEffect(() => {
    if (!interviewId || !user || !role || !ALLOWED_ROLES.includes(role)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [ivRes, respRes, cheatRes] = await Promise.all([
        supabase.from("interviews").select("*").eq("id", interviewId).single(),
        supabase.from("responses").select("id, question_text, answer_text, created_at").eq("interview_id", interviewId).order("created_at", { ascending: true }),
        supabase.from("cheat_events").select("id, event_type, details, frame_url, created_at").eq("interview_id", interviewId).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;

      if (ivRes.error || !ivRes.data) {
        toast.error("لم يتم العثور على المقابلة");
        navigate("/admin/proctor");
        return;
      }
      const iv = ivRes.data as any as InterviewRow;
      setInterview(iv);
      setResponses((respRes.data as ResponseRow[]) ?? []);
      setCheatEvents((cheatRes.data as CheatEvent[]) ?? []);

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", iv.user_id)
        .maybeSingle();
      setCandidateName(prof?.full_name ?? "—");

      // Backfill chunks uploaded before we joined.
      if (iv.recording_chunks_path) {
        await backfillFromManifest(iv.recording_chunks_path);
      }

      // Record an entry in proctor_sessions audit log.
      const { data: psRow } = await supabase
        .from("proctor_sessions")
        .insert({ interview_id: interviewId, proctor_id: user.id, role: proctorRole } as any)
        .select("id")
        .single();
      proctorSessionIdRef.current = (psRow as any)?.id ?? null;

      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (proctorSessionIdRef.current) {
        supabase
          .from("proctor_sessions")
          .update({ left_at: new Date().toISOString() } as any)
          .eq("id", proctorSessionIdRef.current)
          .then(() => undefined, () => undefined);
      }
    };
  }, [interviewId, user, role, proctorRole, navigate, backfillFromManifest]);

  // Live subscribe to responses, cheat_events, interview status.
  useEffect(() => {
    if (!interviewId) return;

    const channel = supabase
      .channel(`proctor-live-${interviewId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "responses",
        filter: `interview_id=eq.${interviewId}`,
      }, (payload) => {
        setResponses((prev) => [...prev, payload.new as ResponseRow]);
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "cheat_events",
        filter: `interview_id=eq.${interviewId}`,
      }, (payload) => {
        setCheatEvents((prev) => [...prev, payload.new as CheatEvent]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "interviews",
        filter: `id=eq.${interviewId}`,
      }, (payload) => {
        setInterview((prev) => prev ? { ...prev, ...(payload.new as InterviewRow) } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [interviewId]);

  // Trainee presence detection — separate quick check on the same proctor channel.
  useEffect(() => {
    if (!interviewId) return;
    const ch = supabase.channel(`proctor-${interviewId}`, { config: { presence: { key: `viewer-${user?.id ?? "anon"}` } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      let trainee = false;
      for (const presences of Object.values(state)) {
        for (const p of presences as Array<{ role?: string }>) {
          if (p?.role === "trainee") trainee = true;
        }
      }
      setTraineePresent(trainee);
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [interviewId, user?.id]);

  const handleSendMessage = async () => {
    const text = messageDraft.trim();
    if (!text) return;
    await broadcastAdminMessage(text, user?.email ?? "المسؤول");
    setMessageDraft("");
    if (proctorSessionIdRef.current) {
      await appendProctorEvent({ type: "message", text });
    }
    toast.success("تم إرسال الرسالة");
  };

  const handleFlag = async () => {
    if (!interviewId) return;
    await supabase
      .from("interviews")
      .update({
        flagged_by: user?.id,
        flagged_reason: flagReason,
        flagged_at: new Date().toISOString(),
      } as any)
      .eq("id", interviewId);
    if (proctorSessionIdRef.current) {
      await appendProctorEvent({ type: "flag", reason: flagReason });
    }
    toast.success("تم وضع علامة على الجلسة");
    setFlagDialogOpen(false);
    setFlagReason("");
  };

  const handleForceEnd = async () => {
    if (!interviewId) return;
    await broadcastForceEnd(endReason || "تم إنهاء المقابلة من قبل المسؤول", user?.email ?? "المسؤول");
    if (proctorSessionIdRef.current) {
      await appendProctorEvent({ type: "force_end", reason: endReason });
    }
    toast.success("تم إرسال أمر الإنهاء");
    setEndReason("");
  };

  const appendProctorEvent = async (event: any) => {
    if (!proctorSessionIdRef.current) return;
    const { data } = await supabase
      .from("proctor_sessions")
      .select("events")
      .eq("id", proctorSessionIdRef.current)
      .single();
    const events = Array.isArray((data as any)?.events) ? (data as any).events : [];
    events.push({ ...event, at: new Date().toISOString() });
    await supabase
      .from("proctor_sessions")
      .update({ events } as any)
      .eq("id", proctorSessionIdRef.current);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!interview) return null;

  const isCompleted = interview.status === "completed" || interview.status === "cancelled";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/admin/proctor">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {candidateName}
                {!isCompleted && (
                  <Badge variant="destructive" className="rounded-full gap-1.5 animate-pulse">
                    <Radio className="w-3 h-3" />
                    مباشر
                  </Badge>
                )}
                {isCompleted && <Badge variant="secondary" className="rounded-full">انتهت</Badge>}
                {traineePresent && !isCompleted && (
                  <Badge variant="outline" className="rounded-full">المرشح متصل</Badge>
                )}
              </h1>
              <div className="text-xs text-muted-foreground mt-0.5">
                {interview.job_position ?? "—"} · {interview.type === "video" ? "فيديو" : interview.type === "voice" ? "صوتية" : "نصية"}
              </div>
            </div>
          </div>

          {!isCompleted && (
            <div className="flex items-center gap-2 flex-wrap">
              <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl gap-2">
                    <Flag className="w-4 h-4 text-amber-500" />
                    وضع علامة
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>وضع علامة على الجلسة</DialogTitle>
                  </DialogHeader>
                  <Textarea
                    placeholder="سبب وضع العلامة..."
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    className="rounded-xl"
                  />
                  <DialogFooter>
                    <Button variant="outline" className="rounded-xl" onClick={() => setFlagDialogOpen(false)}>إلغاء</Button>
                    <Button className="rounded-xl" onClick={handleFlag} disabled={!flagReason.trim()}>تأكيد</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-xl gap-2">
                    <StopCircle className="w-4 h-4" />
                    إنهاء المقابلة
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>إنهاء المقابلة الآن؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم إنهاء المقابلة فوراً وسيظهر للمرشح إشعار بذلك. هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    placeholder="سبب الإنهاء (اختياري)..."
                    value={endReason}
                    onChange={(e) => setEndReason(e.target.value)}
                    className="rounded-xl"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleForceEnd} className="rounded-xl bg-destructive text-destructive-foreground">
                      إنهاء المقابلة
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {interview.flagged_at && (
          <Card className="rounded-2xl border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2">
            <Flag className="w-4 h-4 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-700 dark:text-amber-300">تم وضع علامة على هذه الجلسة</div>
              {interview.flagged_reason && <div className="text-muted-foreground">{interview.flagged_reason}</div>}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Live video + intervention */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>التسجيل المباشر</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {viewerState.bufferedChunks} مقطع · ~30 ث تأخير
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    muted={false}
                    className="w-full h-full object-contain"
                  />
                  {viewerState.bufferedChunks === 0 && !isCompleted && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-black/70 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <p className="text-sm">في انتظار أول مقطع... (≈30 ثانية)</p>
                    </div>
                  )}
                  {viewerState.error && (
                    <div className="absolute bottom-2 left-2 right-2 bg-destructive/90 text-destructive-foreground text-xs p-2 rounded-lg">
                      {viewerState.error}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!isCompleted && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">إرسال رسالة للمرشح</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Input
                    placeholder="مثال: من فضلك أبعد الهاتف عن مدى الكاميرا"
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                    className="rounded-xl"
                  />
                  <Button
                    className="rounded-xl gap-2"
                    onClick={handleSendMessage}
                    disabled={!messageDraft.trim()}
                  >
                    <Send className="w-4 h-4" />
                    إرسال
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Transcript + cheat events */}
          <div className="space-y-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">النص المباشر ({responses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-y-auto space-y-2 text-sm">
                  {responses.length === 0 && <p className="text-muted-foreground text-center py-4">لا توجد إجابات بعد</p>}
                  {responses.map((r) => (
                    <div key={r.id} className="space-y-1">
                      {r.question_text && (
                        <div className="text-xs text-muted-foreground italic">س: {r.question_text}</div>
                      )}
                      {r.answer_text && (
                        <div className="text-sm bg-muted/40 rounded-lg p-2">{r.answer_text}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  أحداث المراقبة ({cheatEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {cheatEvents.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">لا توجد أحداث مشبوهة</p>}
                  {cheatEvents.map((e) => {
                    const icon =
                      e.event_type === "phone_detected" ? Phone :
                      e.event_type === "person_detected" ? UserPlus :
                      e.event_type === "looking_away" ? Eye : AlertTriangle;
                    const Icon = icon;
                    const label =
                      e.event_type === "phone_detected" ? "كشف هاتف" :
                      e.event_type === "person_detected" ? "شخص إضافي" :
                      e.event_type === "looking_away" ? "نظر بعيد" :
                      e.event_type === "tab_switch" ? "تبديل نافذة" : e.event_type;
                    return (
                      <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                        <Icon className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">{label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                            {e.frame_url && <Camera className="w-3 h-3 text-destructive" />}
                          </div>
                          {e.details && <p className="text-xs mt-1">{e.details}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveProctorSession;
