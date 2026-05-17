import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, FileText, Sparkles, Loader2, Target,
  Lightbulb, AlertCircle, BadgeCheck, Upload,
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

const SECTION_LABELS: Record<string, string> = {
  contact: "بيانات التواصل",
  summary: "الملخّص الشخصي",
  experience: "الخبرات",
  education: "التعليم",
  skills: "المهارات",
  achievements: "الإنجازات",
  formatting: "التنسيق",
  language_quality: "جودة اللغة",
  saudi_gov_alignment: "ملاءمة القطاع الحكومي",
  target_role_alignment: "محاذاة الوظيفة المستهدفة",
};

const CVReview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const docIdParam = searchParams.get("doc");

  const [latestDoc, setLatestDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [targetRole, setTargetRole] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const loadLatest = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("cv_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (docIdParam) query = supabase.from("cv_documents").select("*").eq("id", docIdParam);
    const { data } = await query;
    setLatestDoc(data && data.length > 0 ? data[0] : null);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (user) loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, docIdParam]);

  const reAnalyze = async () => {
    if (!user) return;
    // Need a resume_path to re-analyze
    const { data: profile } = await supabase
      .from("profiles")
      .select("resume_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.resume_url) {
      toast.error("لم يتم العثور على سيرة ذاتية مرفوعة — ارفع سيرتك أولاً من الإعدادات");
      return;
    }

    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke("analyze-resume", {
        body: { resume_path: profile.resume_url, target_role: targetRole || undefined },
      });
      if (error) throw error;
      toast.success("تم تحليل السيرة بنجاح");
      await loadLatest();
    } catch (err) {
      console.error(err);
      toast.error("تعذّر تحليل السيرة الآن");
    } finally {
      setAnalyzing(false);
    }
  };

  const scores = (latestDoc?.scores as any) || {};
  const suggestions = (latestDoc?.suggestions as any) || {};

  const radarData = useMemo(() => {
    const keys = ["contact", "summary", "experience", "education", "skills", "achievements", "formatting", "language_quality"];
    return keys.map((k) => ({ subject: SECTION_LABELS[k], score: scores[k] ?? 0 }));
  }, [scores]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">مراجعة السيرة الذاتية</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            العودة للوحة التحكم
            <ArrowRight className="w-4 h-4 mr-2" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        {!latestDoc && (
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-8 text-center space-y-4">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-semibold">لا توجد سيرة ذاتية معتمدة بعد</h2>
              <p className="text-muted-foreground">
                ارفع سيرتك الذاتية من إعدادات الملف الشخصي لنحلّلها ونقيّمها، أو ابدأ بإنشاء سيرة جديدة في منشئ السيرة.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate("/settings/profile")}>
                  <Upload className="w-4 h-4 ml-2" /> ارفع سيرتي
                </Button>
                <Button variant="secondary" onClick={() => navigate("/cv/builder")}>
                  أنشئ سيرة جديدة
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {latestDoc && (
          <>
            {/* Re-analyze with target role */}
            <Card className="rounded-2xl shadow-lg">
              <CardContent className="p-6 flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="target_role">الوظيفة المستهدفة (اختياري)</Label>
                  <Input
                    id="target_role"
                    placeholder="مثال: أخصائي موارد بشرية في وزارة الخدمة المدنية"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                  />
                </div>
                <Button disabled={analyzing} onClick={reAnalyze}>
                  {analyzing ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ التحليل...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 ml-2" /> أعد التحليل</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Overall score */}
            <Card className="rounded-2xl shadow-lg">
              <CardContent className="p-8 flex flex-col items-center gap-4">
                <p className="text-muted-foreground">الدرجة الإجمالية للسيرة</p>
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                    <circle cx="64" cy="64" r="56" fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
                      strokeDasharray={`${((scores.overall ?? 0) / 100) * 351.86} 351.86`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-foreground">{scores.overall ?? "—"}</span>
                  </div>
                </div>
                {latestDoc.target_role && (
                  <Badge variant="outline" className="text-sm">
                    <Target className="w-3 h-3 ml-1.5" /> {latestDoc.target_role}
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Section breakdown + radar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-lg">
                <CardHeader className="pb-2"><CardTitle className="text-base">الدرجات حسب القسم</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(SECTION_LABELS).map(([key, label]) => {
                    const v = scores[key];
                    if (v == null) return null;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground">{label}</span>
                          <span className="font-medium">{v}/100</span>
                        </div>
                        <Progress value={v} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-lg">
                <CardHeader className="pb-2"><CardTitle className="text-base">رادار الأقسام</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="السيرة" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Weaknesses */}
            {Array.isArray(suggestions.weaknesses) && suggestions.weaknesses.length > 0 && (
              <Card className="rounded-2xl shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" /> نقاط ضعف تحتاج معالجة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {suggestions.weaknesses.map((w: any, i: number) => (
                    <div key={i} className="border-r-2 border-amber-500 pr-3 py-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">{SECTION_LABELS[w.section] || w.section}</p>
                      <p className="text-sm text-muted-foreground">{w.issue_ar}</p>
                      {w.example_from_cv && (
                        <p className="text-xs text-foreground bg-muted/40 rounded p-2">«{w.example_from_cv}»</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Rewrites */}
            {Array.isArray(suggestions.rewrites) && suggestions.rewrites.length > 0 && (
              <Card className="rounded-2xl shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> إعادة كتابة محسّنة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {suggestions.rewrites.map((rw: any, i: number) => (
                      <AccordionItem key={i} value={`rw-${i}`}>
                        <AccordionTrigger className="text-right hover:no-underline">
                          <span className="font-medium">{SECTION_LABELS[rw.section] || rw.section} — مقترح {i + 1}</span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pt-2">
                          <div className="bg-muted/50 rounded-xl p-3">
                            <p className="text-xs text-muted-foreground mb-1">نسختك:</p>
                            <p className="text-sm text-foreground">{rw.original_ar}</p>
                          </div>
                          <div className="border border-primary/30 bg-primary/5 rounded-xl p-3">
                            <p className="text-xs text-primary font-semibold mb-1 flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> نسخة محسّنة:</p>
                            <p className="text-sm text-foreground">{rw.improved_ar}</p>
                          </div>
                          {rw.why_ar && (
                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {rw.why_ar}
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {/* Missing for target role */}
            {Array.isArray(suggestions.missing_for_target) && suggestions.missing_for_target.length > 0 && (
              <Card className="rounded-2xl shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" /> ما ينقص للوظيفة المستهدفة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {suggestions.missing_for_target.map((m: string, i: number) => (
                      <li key={i} className="flex gap-2"><span className="text-primary">•</span>{m}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-center gap-3 pb-8">
              <Button variant="secondary" onClick={() => navigate("/cv/builder")}>
                ابدأ بسيرة جديدة في المنشئ
              </Button>
              <Button onClick={() => navigate("/dashboard")}>
                العودة للوحة التحكم
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CVReview;
