import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Loader2, User, Briefcase, Calendar, MessageSquare, Mic, Video, FileDown, CheckCircle, XCircle, AlertTriangle, Shield, Eye, Phone, UserPlus, Camera } from "lucide-react";
import VideoPlayback from "@/components/interview/VideoPlayback";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [responses, setResponses] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [cheatEvents, setCheatEvents] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedCheatFrame, setSelectedCheatFrame] = useState<string | null>(null);
  const [overrideDecision, setOverrideDecision] = useState(false);

  const exportPDF = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { interview_id: id },
      });
      if (error) throw error;
      const html = data?.html;
      if (!html) throw new Error("No report generated");
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
      toast.success("تم إنشاء التقرير");
    } catch {
      toast.error("حدث خطأ في إنشاء التقرير");
    }
    setExporting(false);
  };

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && role && role !== "admin" && role !== "hr") { navigate("/dashboard"); return; }
    if (!user || !id) return;

    const load = async () => {
      const [ivRes, evRes, notesRes, respRes, cheatRes] = await Promise.all([
        supabase.from("interviews").select("*").eq("id", id).single(),
        supabase.from("evaluations").select("*").eq("interview_id", id).single(),
        supabase.from("hr_notes").select("*").eq("interview_id", id).order("created_at", { ascending: false }),
        supabase.from("responses").select("*").eq("interview_id", id).order("created_at", { ascending: true }),
        supabase.from("cheat_events").select("*").eq("interview_id", id).order("created_at", { ascending: true }),
      ]);
      setInterview(ivRes.data);
      setEvaluation(evRes.data);
      setNotes(notesRes.data || []);
      setResponses(respRes.data || []);
      setCheatEvents(cheatRes.data || []);

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
    const optimisticNote = {
      id: `temp-${Date.now()}`, interview_id: id, author_id: user.id,
      note_text: noteText.trim() || null, action, created_at: new Date().toISOString(),
    };
    setNotes((prev) => [optimisticNote, ...prev]);
    const savedText = noteText;
    setNoteText("");

    const { error } = await supabase.from("hr_notes").insert({
      interview_id: id, author_id: user.id, note_text: savedText.trim() || null, action,
    });
    if (error) {
      toast.error("حدث خطأ في حفظ الملاحظة");
      setNotes((prev) => prev.filter((n) => n.id !== optimisticNote.id));
      setNoteText(savedText);
    } else {
      // Auto-release results when a decision is made (accept/reject/retry)
      if (["accepted", "rejected", "retry"].includes(action) && evaluation?.id) {
        await supabase
          .from("evaluations")
          .update({ review_status: "released" } as any)
          .eq("id", evaluation.id);
        setEvaluation((prev: any) => ({ ...prev, review_status: "released" }));
      }
      toast.success("تم حفظ الإجراء بنجاح");
      const { data } = await supabase.from("hr_notes").select("*").eq("interview_id", id).order("created_at", { ascending: false });
      setNotes(data || []);
    }
    setSubmitting(false);
  };

  const updateReviewStatus = async (status: "released" | "rejected") => {
    if (!evaluation?.id) return;
    const { error } = await supabase
      .from("evaluations")
      .update({ review_status: status } as any)
      .eq("id", evaluation.id);
    if (error) {
      toast.error("حدث خطأ في تحديث الحالة");
    } else {
      setEvaluation((prev: any) => ({ ...prev, review_status: status }));
      toast.success(status === "released" ? "تم إطلاق النتائج للمرشح" : "تم رفض المرشح");
    }
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
  const redFlags = Array.isArray((evaluation as any)?.red_flags) ? (evaluation as any).red_flags : [];
  const TypeIcon = typeIcons[interview.type] || MessageSquare;
  const reviewStatus = (evaluation as any)?.review_status || "pending_review";

  const actionLabels: Record<string, string> = { accepted: "قبول", rejected: "رفض", retry: "إعادة", waiting: "انتظار" };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/admin")} className="rounded-xl">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-bold text-foreground">تفاصيل المرشح</h2>
          {evaluation && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={exportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <FileDown className="w-4 h-4 ml-1" />}
              تصدير PDF
            </Button>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Approve / Reject bar */}
        {evaluation && (
          <Card className="rounded-2xl shadow-lg border-2 border-primary/20">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <span className="text-sm font-semibold text-muted-foreground">حالة المراجعة:</span>
              <Badge variant={reviewStatus === "released" ? "default" : "secondary"}>
                {reviewStatus === "released" ? "تم إطلاق النتائج للمرشح" : "بانتظار اتخاذ القرار"}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Proctor flag banner */}
        {(interview as any).flagged_at && (
          <Card className="rounded-2xl border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-700 dark:text-amber-300">
                تم وضع علامة على هذه الجلسة خلال المراقبة
              </div>
              {(interview as any).flagged_reason && (
                <div className="text-muted-foreground">{(interview as any).flagged_reason}</div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date((interview as any).flagged_at).toLocaleString("ar-SA")}
              </div>
            </div>
          </Card>
        )}

        {/* End reason banner */}
        {(interview as any).end_reason === "terminated_by_proctor" && (
          <Card className="rounded-2xl border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-destructive">تم إنهاء هذه المقابلة من قبل المسؤول.</div>
            </div>
          </Card>
        )}
        {(interview as any).end_reason === "disconnected" && (
          <Card className="rounded-2xl border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-700 dark:text-amber-300">
                انتهت الجلسة بشكل غير متوقع — قد تكون البيانات ناقصة.
              </div>
            </div>
          </Card>
        )}

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
              <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-muted-foreground" /><span className="text-foreground">{interview.job_position}</span></div>
              <div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-muted-foreground" /><span className="text-foreground">مقابلة {typeLabels[interview.type] || interview.type}</span></div>
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-foreground">{new Date(interview.created_at).toLocaleDateString("ar-SA")}</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Full Transcript */}
        {responses.length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader><CardTitle className="text-base">النص الكامل للمقابلة</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {responses.map((r, i) => (
                <div key={r.id || i} className="space-y-1">
                  <p className="text-xs font-semibold text-primary">سؤال {i + 1}:</p>
                  <p className="text-sm text-foreground bg-primary/5 p-2 rounded-lg">{r.question_text}</p>
                  <p className="text-xs font-semibold text-muted-foreground">الإجابة:</p>
                  <p className="text-sm text-foreground bg-muted/50 p-2 rounded-lg">{r.answer_text || "(لم يتم الإجابة)"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* AI Analysis */}
        {evaluation && (
          <>
            <Card className="rounded-2xl shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">تحليل محرك واكب للذكاء الاصطناعي</CardTitle>
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
                  { label: "مهارات التواصل", value: evaluation.communication_score },
                  { label: "الكفاءة التقنية", value: evaluation.technical_score },
                  { label: "التوافق الثقافي", value: evaluation.personality_match },
                  { label: "حل المشكلات", value: (evaluation as any).problem_solving },
                  { label: "القيادة", value: (evaluation as any).leadership },
                  { label: "الثقة", value: evaluation.confidence_score },
                ].filter(item => item.value != null).map((item) => (
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
                    <p className="text-xs text-muted-foreground">مستوى الثقة</p>
                    <p className="text-sm font-semibold text-foreground">{(evaluation as any).confidence_level || "—"}</p>
                  </div>
                </div>

                {/* Final recommendation */}
                {(evaluation as any).final_recommendation && (
                  <div className="mt-2 p-3 rounded-xl bg-primary/5 text-center">
                    <p className="text-xs text-muted-foreground">التوصية النهائية</p>
                    <p className="text-lg font-bold text-foreground">{(evaluation as any).final_recommendation}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Strengths, Improvements, Red Flags */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {strengths.length > 0 && (
                <Card className="rounded-2xl shadow-lg">
                  <CardHeader><CardTitle className="text-base text-success">نقاط القوة</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {strengths.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-success mt-2 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {improvements.length > 0 && (
                <Card className="rounded-2xl shadow-lg">
                  <CardHeader><CardTitle className="text-base text-warning">مجالات التطوير</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {improvements.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {redFlags.length > 0 && (
                <Card className="rounded-2xl shadow-lg border-destructive/20">
                  <CardHeader><CardTitle className="text-base text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" />إشارات تحذيرية</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {redFlags.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {evaluation.ai_feedback_ar && (
              <Card className="rounded-2xl shadow-lg">
                <CardHeader><CardTitle className="text-base">ملاحظات محرك واكب للذكاء الاصطناعي</CardTitle></CardHeader>
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
                    { label: "الانخراط", value: evaluation.detailed_scores.video_analysis.engagement },
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

        {/* Video/Audio Playback — for all interview types */}
        {interview.user_id && (
          <VideoPlayback
            interviewId={interview.id}
            userId={interview.user_id}
            recordingUrl={(interview as any).recording_url}
            recordingChunksPath={(interview as any).recording_chunks_path}
            recordingDurationMs={(interview as any).recording_duration_ms}
            recordingChunkCount={(interview as any).recording_chunk_count}
            recordingStatus={(interview as any).recording_status}
            interviewType={interview.type}
          />
        )}

        {/* Cheat Events Log */}
        {cheatEvents.length > 0 && (
          <Card className="rounded-2xl shadow-lg border-destructive/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-destructive" />
                سجل أحداث المراقبة ({cheatEvents.length} حدث)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cheatEvents.map((event) => {
                  const icon = event.event_type === "phone_detected" ? Phone
                    : event.event_type === "person_detected" ? UserPlus
                    : event.event_type === "looking_away" ? Eye
                    : AlertTriangle;
                  const Icon = icon;
                  const label = event.event_type === "phone_detected" ? "كشف هاتف"
                    : event.event_type === "person_detected" ? "شخص إضافي"
                    : event.event_type === "looking_away" ? "نظر بعيد"
                    : event.event_type === "tab_switch" ? "تبديل نافذة"
                    : event.event_type;

                  return (
                    <div
                      key={event.id}
                      className={`flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10 ${event.frame_url ? "cursor-pointer hover:bg-destructive/10 transition-colors" : ""}`}
                      onClick={() => event.frame_url && setSelectedCheatFrame(event.frame_url)}
                    >
                      <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="destructive" className="text-xs">{label}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                          {event.frame_url && <Camera className="w-3.5 h-3.5 text-destructive" />}
                        </div>
                        {event.details && <p className="text-sm text-foreground">{event.details}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cheat Frame Dialog */}
        <Dialog open={!!selectedCheatFrame} onOpenChange={() => setSelectedCheatFrame(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-destructive" />
                لقطة كشف الغش
              </DialogTitle>
            </DialogHeader>
            {selectedCheatFrame && (
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={selectedCheatFrame} alt="لقطة غش" className="w-full h-auto" />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* HR Notes */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader><CardTitle className="text-base">ملاحظات الموارد البشرية</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea placeholder="أضف ملاحظتك هنا..." value={noteText} onChange={(e) => setNoteText(e.target.value)} className="rounded-xl" />
            {(() => {
              const lastDecision = notes.find((n: any) => ["accepted", "rejected"].includes(n.action));
              if (lastDecision && !overrideDecision) {
                return (
                  <div className="flex items-center gap-3">
                    <Badge variant={lastDecision.action === "accepted" ? "default" : "destructive"}>
                      {lastDecision.action === "accepted" ? "✓ تم القبول" : "✗ تم الرفض"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(lastDecision.created_at).toLocaleString("ar-SA")}
                    </span>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOverrideDecision(true)}>
                      تغيير القرار
                    </Button>
                  </div>
                );
              }
              return (
                <div className="flex flex-wrap gap-2">
                  {actionButtons.map((btn) => (
                    <Button key={btn.action} variant={btn.variant} size="sm" className="rounded-xl" disabled={submitting} onClick={() => { submitNote(btn.action); setOverrideDecision(false); }}>
                      {btn.label}
                    </Button>
                  ))}
                </div>
              );
            })()}
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
