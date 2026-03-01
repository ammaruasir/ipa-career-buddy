import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Loader2, User, Briefcase, Calendar, MessageSquare, Mic, Video } from "lucide-react";
import VideoPlayback from "@/components/interview/VideoPlayback";
import { toast } from "sonner";

const discLabels: Record<string, { label: string; desc: string; color: string }> = {
  D: { label: "مسيطر (D)", desc: "حازم ومباشر", color: "bg-destructive/10 text-destructive" },
  I: { label: "مؤثر (I)", desc: "اجتماعي ومتحمس", color: "bg-warning/10 text-warning" },
  S: { label: "مستقر (S)", desc: "صبور ومتعاون", color: "bg-success/10 text-success" },
  C: { label: "ملتزم (C)", desc: "دقيق ومنظم", color: "bg-primary/10 text-primary" },
};

const typeIcons: Record<string, typeof MessageSquare> = { text: MessageSquare, voice: Mic, video: Video };
const typeLabels: Record<string, string> = { text: "نصية", voice: "صوتية", video: "فيديو" };

const actionButtons = [
  { action: "accepted", label: "قبول", variant: "default" as const },
  { action: "rejected", label: "رفض", variant: "destructive" as const },
  { action: "retry", label: "إعادة المقابلة", variant: "outline" as const },
  { action: "waiting", label: "انتظار", variant: "secondary" as const },
];

const CandidateDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && role !== "admin" && role !== "hr") { navigate("/dashboard"); return; }
    if (!user || !id) return;

    const load = async () => {
      const [ivRes, evRes, notesRes] = await Promise.all([
        supabase.from("interviews").select("*").eq("id", id).single(),
        supabase.from("evaluations").select("*").eq("interview_id", id).single(),
        supabase.from("hr_notes").select("*").eq("interview_id", id).order("created_at", { ascending: false }),
      ]);
      setInterview(ivRes.data);
      setEvaluation(evRes.data);
      setNotes(notesRes.data || []);

      if (ivRes.data) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", ivRes.data.user_id).single();
        setProfile(prof);
      }
      setLoading(false);
    };
    load();
  }, [user, role, authLoading, id, navigate]);

  const submitNote = async (action: string) => {
    if (!user || !id) return;
    setSubmitting(true);

    // Optimistic: add note immediately
    const optimisticNote = {
      id: `temp-${Date.now()}`,
      interview_id: id,
      author_id: user.id,
      note_text: noteText.trim() || null,
      action,
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [optimisticNote, ...prev]);
    const savedText = noteText;
    setNoteText("");

    const { error } = await supabase.from("hr_notes").insert({
      interview_id: id,
      author_id: user.id,
      note_text: savedText.trim() || null,
      action,
    });
    if (error) {
      toast.error("حدث خطأ في حفظ الملاحظة");
      // Roll back optimistic update
      setNotes((prev) => prev.filter((n) => n.id !== optimisticNote.id));
      setNoteText(savedText);
    } else {
      toast.success("تم حفظ الإجراء بنجاح");
      // Refresh from server
      const { data } = await supabase.from("hr_notes").select("*").eq("interview_id", id).order("created_at", { ascending: false });
      setNotes(data || []);
    }
    setSubmitting(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">لم يتم العثور على المقابلة</p>
        <Button onClick={() => navigate("/dashboard/admin")} className="rounded-xl">العودة</Button>
      </div>
    );
  }

  const disc = evaluation?.personality_type ? discLabels[evaluation.personality_type] : null;
  const strengths = Array.isArray(evaluation?.strengths) ? evaluation.strengths : [];
  const improvements = Array.isArray(evaluation?.improvements) ? evaluation.improvements : [];
  const TypeIcon = typeIcons[interview.type] || MessageSquare;

  const actionLabels: Record<string, string> = { accepted: "قبول", rejected: "رفض", retry: "إعادة", waiting: "انتظار" };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/admin")} className="rounded-xl">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-bold text-foreground">تفاصيل المرشح</h2>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Profile + Interview Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">معلومات المرشح</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{profile?.full_name || "—"}</p>
                  <p className="text-sm text-muted-foreground">{profile?.branch_location || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">معلومات المقابلة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{interview.job_position}</span>
              </div>
              <div className="flex items-center gap-2">
                <TypeIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">مقابلة {typeLabels[interview.type] || interview.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{new Date(interview.created_at).toLocaleDateString("ar-SA")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Analysis */}
        {evaluation && (
          <>
            <Card className="rounded-2xl shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">تحليل الذكاء الاصطناعي</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">{evaluation.overall_score}%</span>
                    {evaluation.recommendation && (
                      <Badge variant={evaluation.recommendation === "غير موصى به" ? "destructive" : "default"}>
                        {evaluation.recommendation}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "مهارات التواصل", value: evaluation.communication_score, color: "bg-primary" },
                  { label: "الكفاءة التقنية", value: evaluation.technical_score, color: "bg-secondary" },
                  { label: "التوافق الثقافي", value: evaluation.personality_match, color: "bg-warning" },
                  { label: "الثقة", value: evaluation.confidence_score, color: "bg-success" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold text-foreground">{item.value || 0}%</span>
                    </div>
                    <Progress value={item.value || 0} className="h-3" />
                  </div>
                ))}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {disc && (
                    <div className={`rounded-xl p-3 text-center ${disc.color}`}>
                      <p className="text-xs font-semibold">{disc.label}</p>
                      <p className="text-[10px]">{disc.desc}</p>
                    </div>
                  )}
                  <div className="rounded-xl p-3 text-center bg-muted">
                    <p className="text-xs text-muted-foreground">المشاعر</p>
                    <p className="text-sm font-semibold text-foreground">{evaluation.sentiment || "—"}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-muted">
                    <p className="text-xs text-muted-foreground">كلمات حشو</p>
                    <p className="text-sm font-semibold text-foreground">{evaluation.filler_words_count || 0}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-muted">
                    <p className="text-xs text-muted-foreground">سرعة الكلام</p>
                    <p className="text-sm font-semibold text-foreground">{evaluation.speech_pace ? `${evaluation.speech_pace} ك/د` : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {strengths.length > 0 && (
                <Card className="rounded-2xl shadow-lg">
                  <CardHeader><CardTitle className="text-base text-success">نقاط القوة</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {strengths.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-success mt-2 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {improvements.length > 0 && (
                <Card className="rounded-2xl shadow-lg">
                  <CardHeader><CardTitle className="text-base text-warning">مجالات التحسين</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {improvements.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {evaluation.ai_feedback_ar && (
              <Card className="rounded-2xl shadow-lg">
                <CardHeader><CardTitle className="text-base">ملاحظات الذكاء الاصطناعي</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed">{evaluation.ai_feedback_ar}</p>
                </CardContent>
              </Card>
            )}

            {/* Video Analysis Scores */}
            {evaluation?.detailed_scores?.video_analysis && (
              <Card className="rounded-2xl shadow-lg">
                <CardHeader><CardTitle className="text-base">تحليل الفيديو</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "التواصل البصري", value: evaluation.detailed_scores.video_analysis.eye_contact },
                    { label: "الثقة (تحليل الوجه)", value: evaluation.detailed_scores.video_analysis.video_confidence },
                    { label: "الانخراط والاهتمام", value: evaluation.detailed_scores.video_analysis.engagement },
                    { label: "المظهر المهني", value: evaluation.detailed_scores.video_analysis.professional_appearance },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-semibold text-foreground">{item.value || 0}%</span>
                      </div>
                      <Progress value={item.value || 0} className="h-3" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Video Playback for HR */}
        {interview.type === "video" && interview.user_id && (
          <VideoPlayback
            interviewId={interview.id}
            userId={interview.user_id}
            recordingUrl={(interview as any).recording_url}
          />
        )}

        {/* HR Notes */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader><CardTitle className="text-base">ملاحظات الموارد البشرية</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="أضف ملاحظتك هنا..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="rounded-xl"
            />
            <div className="flex flex-wrap gap-2">
              {actionButtons.map((btn) => (
                <Button
                  key={btn.action}
                  variant={btn.variant}
                  size="sm"
                  className="rounded-xl"
                  disabled={submitting}
                  onClick={() => submitNote(btn.action)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>

            {notes.length > 0 && (
              <div className="border-t border-border pt-4 space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{actionLabels[n.action] || n.action}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-SA")}</span>
                    </div>
                    {n.note_text && <p className="text-sm text-foreground">{n.note_text}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidateDetail;
