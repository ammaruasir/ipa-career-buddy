import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, Award, Brain, MessageSquare, Briefcase,
  Users, BarChart3, Loader2, Mic, Eye, TrendingUp, TrendingDown
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user || !id) return;

    Promise.all([
      supabase.from("evaluations").select("*").eq("interview_id", id).maybeSingle(),
      supabase.from("interviews").select("*").eq("id", id).single(),
    ]).then(([evalRes, intRes]) => {
      setEvaluation(evalRes.data);
      setInterview(intRes.data);
      setLoading(false);
    });
  }, [user, authLoading, id, navigate]);

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

  const disc = discLabels[evaluation.personality_type] || discLabels.S;
  const recColor = recColors[evaluation.recommendation] || recColors["موصى به"];
  const strengths = (evaluation.strengths as string[]) || [];
  const improvements = (evaluation.improvements as string[]) || [];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
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
                <circle
                  cx="64" cy="64" r="56" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="10"
                  strokeDasharray={`${(evaluation.overall_score / 100) * 351.86} 351.86`}
                  strokeLinecap="round"
                />
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

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-600" />نقاط القوة</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-green-600 mt-0.5">✓</span>{s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-5 h-5 text-amber-600" />نقاط التحسين</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-amber-600 mt-0.5">→</span>{s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* AI Feedback */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />ملاحظات الذكاء الاصطناعي</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed">{evaluation.ai_feedback_ar}</p>
          </CardContent>
        </Card>

        <div className="flex justify-center pb-8">
          <Button size="lg" className="rounded-xl" onClick={() => navigate("/dashboard")}>
            العودة للوحة التحكم
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InterviewResults;
