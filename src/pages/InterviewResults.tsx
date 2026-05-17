import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, Award, Brain, MessageSquare, Briefcase,
  Users, BarChart3, Loader2, Eye, TrendingUp, TrendingDown, Clock,
  Smartphone, AlertTriangle, GraduationCap, Sparkles, Lightbulb
} from "lucide-react";

const discLabels: Record<string, { label: string; desc: string; color: string }> = {
  D: { label: "مسيطر (D)", desc: "قيادي، حاسم، يركز على النتائج", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  I: { label: "مؤثر (I)", desc: "اجتماعي، متحمس، ملهم", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  S: { label: "ثابت (S)", desc: "صبور، موثوق، متعاون", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  C: { label: "متقن (C)", desc: "دقيق، تحليلي، منظم", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

const recColors: Record<string, string> = {
  "موصى به بشدة": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "موصى به": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "غير موصى به": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const InterviewResults = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [evaluation, setEvaluation] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachingFor, setCoachingFor] = useState<string | null>(null);

  const loadResponses = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("responses")
      .select("*")
      .eq("interview_id", id)
      .order("created_at");
    setResponses(data || []);
  };

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user || !id) return;

    Promise.all([
      supabase.from("evaluations").select("*").eq("interview_id", id).maybeSingle(),
      supabase.from("interviews").select("*").eq("id", id).single(),
      supabase.from("responses").select("*").eq("interview_id", id).order("created_at"),
    ]).then(([evalRes, intRes, resRes]) => {
      setEvaluation(evalRes.data);
      setInterview(intRes.data);
      setResponses(resRes.data || []);
      setLoading(false);
    });
  }, [user, authLoading, id, navigate]);

  const requestCoaching = async (responseId: string) => {
    setCoachingFor(responseId);
    try {
      const { data, error } = await supabase.functions.invoke("coach-response", {
        body: { response_id: responseId },
      });
      if (error) throw error;
      if (data?.coaching) {
        setResponses((prev) => prev.map((r) => r.id === responseId ? { ...r, coaching: data.coaching } : r));
        toast.success("تم تحضير التغذية الراجعة");
      }
    } catch (err) {
      console.error(err);
      toast.error("تعذّر تحضير التغذية الراجعة الآن");
    } finally {
      setCoachingFor(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4" dir="rtl">
        <p className="text-muted-foreground text-lg">لم يتم العثور على نتائج التقييم بعد.</p>
        <Button onClick={() => navigate("/dashboard")}>العودة للوحة التحكم</Button>
      </div>
    );
  }

  // Check review_status — in practice mode (scope='formative' / status='auto_released')
  // we always show results. In assessment mode, gate on review_status === 'released'.
  const reviewStatus = (evaluation as any).review_status;
  const isFormative = (evaluation as any).scope === "formative" || reviewStatus === "auto_released";
  if (!isFormative && reviewStatus && reviewStatus !== "released") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Clock className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground text-center">تم إكمال المقابلة بنجاح</h1>
        <p className="text-muted-foreground text-center max-w-md text-lg leading-relaxed">
          سيتم إشعارك بالنتيجة بعد مراجعة فريق الموارد البشرية واتخاذ القرار.
        </p>
        <Button size="lg" className="rounded-xl mt-4" onClick={() => navigate("/dashboard")}>
          العودة للوحة التحكم
        </Button>
      </div>
    );
  }

  const disc = discLabels[evaluation.personality_type] || discLabels.S;
  const recColor = recColors[evaluation.recommendation] || recColors["موصى به"];
  const strengths = (evaluation.strengths as string[]) || [];
  const improvements = (evaluation.improvements as string[]) || [];
  const videoAnalysis = (evaluation.detailed_scores as any)?.video_analysis;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">نتائج التقييم</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            العودة للوحة التحكم
            <ArrowRight className="w-4 h-4 mr-2" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        {/* Overall Score */}
        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <p className="text-muted-foreground">الدرجة الإجمالية</p>
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="56" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle cx="64" cy="64" r="56" fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
                  strokeDasharray={`${(evaluation.overall_score / 100) * 351.86} 351.86`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{evaluation.overall_score}</span>
              </div>
            </div>
            <Badge className={`text-sm px-4 py-1 ${recColor}`}>{evaluation.recommendation}</Badge>
            <p className="text-sm text-muted-foreground">{interview?.job_position}</p>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "مهارات التواصل", score: evaluation.communication_score, icon: MessageSquare },
            { label: "الكفاءة التقنية", score: evaluation.technical_score, icon: Briefcase },
            { label: "التوافق الثقافي", score: evaluation.personality_match, icon: Users },
          ].map(({ label, score, icon: Icon }) => (
            <Card key={label} className="rounded-2xl shadow-lg">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">{label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{score}<span className="text-sm text-muted-foreground">/100</span></p>
                <Progress value={score} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* New scores: problem_solving, leadership */}
        {((evaluation as any).problem_solving || (evaluation as any).leadership) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(evaluation as any).problem_solving != null && (
              <Card className="rounded-2xl shadow-lg">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">حل المشكلات</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{(evaluation as any).problem_solving}<span className="text-sm text-muted-foreground">/100</span></p>
                  <Progress value={(evaluation as any).problem_solving} className="h-2" />
                </CardContent>
              </Card>
            )}
            {(evaluation as any).leadership != null && (
              <Card className="rounded-2xl shadow-lg">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">القيادة</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{(evaluation as any).leadership}<span className="text-sm text-muted-foreground">/100</span></p>
                  <Progress value={(evaluation as any).leadership} className="h-2" />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* DISC + Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Brain className="w-5 h-5 text-primary" />نوع الشخصية (DISC)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Badge className={`text-sm px-3 py-1 ${disc.color}`}>{disc.label}</Badge>
              <p className="text-sm text-muted-foreground">{disc.desc}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />مؤشرات إضافية</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">تحليل المشاعر</span><span className="font-medium text-foreground">{evaluation.sentiment}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">مستوى الثقة</span><span className="font-medium text-foreground">{evaluation.confidence_score}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">كلمات الحشو</span><span className="font-medium text-foreground">{evaluation.filler_words_count}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">سرعة الكلام</span><span className="font-medium text-foreground">{evaluation.speech_pace} ك/د</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Video Analysis */}
        {videoAnalysis && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />تحليل الفيديو</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "التواصل البصري", value: videoAnalysis.eye_contact },
                  { label: "الثقة (الوجه)", value: videoAnalysis.video_confidence },
                  { label: "الانخراط", value: videoAnalysis.engagement },
                  { label: "المظهر المهني", value: videoAnalysis.professional_appearance },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold text-foreground">{value}<span className="text-xs text-muted-foreground">/100</span></p>
                    <Progress value={value || 0} className="h-2" />
                  </div>
                ))}
              </div>
              {/* Phone Detection Alert */}
              {videoAnalysis.phone_detected && (
                <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4" />
                      تم رصد هاتف محمول
                    </p>
                    {videoAnalysis.phone_detection_notes && (
                      <p className="text-xs text-muted-foreground mt-1">{videoAnalysis.phone_detection_notes}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-600" />نقاط القوة</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground"><span className="text-green-600 mt-0.5">✓</span>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-5 h-5 text-amber-600" />نقاط التحسين</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground"><span className="text-amber-600 mt-0.5">→</span>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* AI Feedback */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />ملاحظات محرك واكب للذكاء الاصطناعي</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed">{evaluation.ai_feedback_ar}</p>
          </CardContent>
        </Card>

        {/* Per-response STAR coaching (P0.2) */}
        {responses.length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                مراجعة كل إجابة على حدة (منهج STAR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {responses.map((r, idx) => {
                  const c = r.coaching as any;
                  const total = c?.coverage_score ?? 0;
                  return (
                    <AccordionItem key={r.id} value={r.id}>
                      <AccordionTrigger className="text-right hover:no-underline">
                        <div className="flex items-center justify-between w-full pl-4">
                          <span className="font-medium text-foreground line-clamp-1">سؤال {idx + 1}: {r.question_text}</span>
                          {c && (
                            <Badge variant="outline" className="ml-2 shrink-0">{Math.round(total)}/100</Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        <div className="bg-muted/50 rounded-xl p-4">
                          <p className="text-xs text-muted-foreground mb-1">إجابتك:</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{r.answer_text || "(لم تُسجَّل إجابة)"}</p>
                        </div>

                        {!c && (
                          <div className="flex flex-col items-start gap-3">
                            <p className="text-sm text-muted-foreground">لم يُحضَّر الكوتشينج بعد لهذه الإجابة.</p>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={coachingFor === r.id}
                              onClick={() => requestCoaching(r.id)}
                            >
                              {coachingFor === r.id ? (
                                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ التحضير...</>
                              ) : (
                                <><Sparkles className="w-4 h-4 ml-2" /> اشرح إجابتي وفق STAR</>
                              )}
                            </Button>
                          </div>
                        )}

                        {c && (
                          <>
                            {/* STAR meter */}
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { key: "s", label: "S — الموقف" },
                                { key: "t", label: "T — المهمة" },
                                { key: "a", label: "A — الإجراء" },
                                { key: "r", label: "R — النتيجة" },
                              ].map(({ key, label }) => {
                                const v = (c.star as any)?.[key] ?? 0;
                                return (
                                  <div key={key} className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground text-center">{label}</p>
                                    <Progress value={(v / 3) * 100} className="h-2" />
                                    <p className="text-xs text-center font-medium">{v}/3</p>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Strengths in answer */}
                            {Array.isArray(c.strengths_in_answer) && c.strengths_in_answer.length > 0 && (
                              <div className="border border-green-200 dark:border-green-900/40 rounded-xl p-3 bg-green-50/50 dark:bg-green-900/10">
                                <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1.5 flex items-center gap-1.5">
                                  <TrendingUp className="w-3.5 h-3.5" /> نقاط قوة في إجابتك
                                </p>
                                <ul className="space-y-1 text-sm text-foreground">
                                  {c.strengths_in_answer.map((s: string, i: number) => (
                                    <li key={i} className="flex gap-1.5"><span className="text-green-600">✓</span>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Improved rewrite */}
                            {c.rewrite_ar && (
                              <div className="border border-primary/20 rounded-xl p-3 bg-primary/5">
                                <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5" /> نسخة محسّنة من إجابتك
                                </p>
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.rewrite_ar}</p>
                              </div>
                            )}

                            {/* Exemplar */}
                            {c.exemplar_ar && (
                              <div className="border border-border rounded-xl p-3 bg-card">
                                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5" /> إجابة نموذجية — هكذا تبدو الإجابة القوية
                                </p>
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.exemplar_ar}</p>
                              </div>
                            )}

                            {/* Tips */}
                            {Array.isArray(c.tips) && c.tips.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">نصائح للجلسة التالية</p>
                                <ul className="space-y-1 text-sm text-foreground">
                                  {c.tips.map((t: string, i: number) => (
                                    <li key={i} className="flex gap-1.5"><span className="text-amber-600">→</span>{t}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Filler word count for this answer */}
                            {Array.isArray(c.filler_marks) && c.filler_marks.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                كلمات الحشو في هذه الإجابة: <span className="font-medium text-foreground">{c.filler_marks.length}</span>
                              </p>
                            )}
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center pb-8">
          <Button size="lg" className="rounded-xl" onClick={() => navigate("/dashboard")}>العودة للوحة التحكم</Button>
        </div>
      </div>
    </div>
  );
};

export default InterviewResults;
