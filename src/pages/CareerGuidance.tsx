import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, Loader2, Sparkles, Target, BookOpen, Briefcase,
  TrendingUp, RefreshCw, GraduationCap, Calendar, ExternalLink,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";

interface GuidanceResult {
  career_paths: { title: string; description: string; match_percent: number }[];
  skills_to_develop: { skill: string; importance: string; current_level?: number; required_level?: number }[];
  matching_jobs: { title: string; department: string; match_reason: string }[];
  summary: string;
  training_plan?: { phase: string; goals: string[]; actions: string[] }[];
  recommended_courses?: { name: string; platform: string; skill: string; duration: string; level?: string }[];
}

const CareerGuidance = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [result, setResult] = useState<GuidanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user) return;

    const load = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      setProfile(data);
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate]);

  const analyze = async () => {
    if (!user || !profile) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("career-guidance", {
        body: { user_id: user.id },
      });
      if (error) throw error;
      setResult(data?.guidance || null);
      if (!data?.guidance) toast.error("لم نتمكن من تحليل بياناتك. تأكد من رفع سيرتك الذاتية أولاً.");
    } catch (e: any) {
      toast.error("حدث خطأ في التحليل");
      console.error(e);
    }
    setAnalyzing(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasSkills = profile?.resume_skills && Object.keys(profile.resume_skills).length > 0;

  // Radar chart data
  const radarData = result?.skills_to_develop?.filter(s => s.current_level != null && s.required_level != null).map(s => ({
    skill: s.skill.length > 12 ? s.skill.slice(0, 12) + "…" : s.skill,
    current: s.current_level || 0,
    required: s.required_level || 0,
  })) || [];

  const platformColors: Record<string, string> = {
    Coursera: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Udemy: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    edX: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    "دروب": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "رواق": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  };

  const phaseColors = [
    "border-primary/40 bg-primary/5",
    "border-secondary/40 bg-secondary/5",
    "border-accent/40 bg-accent/5",
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/candidate")} className="rounded-xl">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <GraduationCap className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">الإرشاد المهني</h2>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        {/* Intro Card */}
        <Card className="rounded-2xl shadow-lg border-2 border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h1 className="text-2xl font-bold text-foreground mb-2">اكتشف مسارك المهني</h1>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              سيحلل الذكاء الاصطناعي مهاراتك وخبراتك من سيرتك الذاتية ليقترح لك المسارات المهنية الأنسب والمهارات التي تحتاج تطويرها
            </p>
            {!hasSkills && (
              <p className="text-sm text-warning mb-4">⚠️ لم يتم استخراج مهارات من سيرتك الذاتية بعد. ارفع سيرتك الذاتية أولاً من الملف الشخصي.</p>
            )}
            <Button onClick={analyze} disabled={analyzing || !hasSkills} className="rounded-xl px-8" size="lg">
              {analyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-2" />جاري التحليل...</>
              ) : result ? (
                <><RefreshCw className="w-4 h-4 ml-2" />إعادة التحليل</>
              ) : (
                <><Sparkles className="w-4 h-4 ml-2" />ابدأ التحليل</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <>
            {/* Summary */}
            <Card className="rounded-2xl shadow-lg">
              <CardContent className="p-6">
                <p className="text-foreground leading-relaxed">{result.summary}</p>
              </CardContent>
            </Card>

            {/* Career Paths */}
            <div>
              <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                المسارات المهنية المقترحة
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.career_paths.map((path, i) => (
                  <Card key={i} className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-foreground">{path.title}</h4>
                        <Badge variant="default">{path.match_percent}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{path.description}</p>
                      <Progress value={path.match_percent} className="h-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Skills Radar Chart */}
            {radarData.length > 2 && (
              <Card className="rounded-2xl shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    تحليل فجوة المهارات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          direction: "rtl",
                        }}
                      />
                      <Radar name="المستوى الحالي" dataKey="current" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Radar name="المستوى المطلوب" dataKey="required" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-primary inline-block" />
                      المستوى الحالي
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-destructive inline-block" />
                      المستوى المطلوب
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skills to Develop */}
            <div>
              <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-secondary" />
                مهارات يُنصح بتطويرها
              </h3>
              <div className="flex flex-wrap gap-3">
                {result.skills_to_develop.map((s, i) => (
                  <Badge
                    key={i}
                    variant={s.importance === "high" ? "default" : s.importance === "medium" ? "secondary" : "outline"}
                    className="text-sm px-4 py-2"
                  >
                    {s.skill}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Recommended Courses */}
            {result.recommended_courses && result.recommended_courses.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  دورات تدريبية مقترحة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.recommended_courses.map((course, i) => (
                    <Card key={i} className="rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-foreground text-sm leading-tight">{course.name}</h4>
                          <Badge className={`text-xs shrink-0 mr-2 ${platformColors[course.platform] || "bg-muted text-muted-foreground"}`}>
                            {course.platform}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.skill}</span>
                          {course.duration && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{course.duration}</span>}
                          {course.level && <Badge variant="outline" className="text-xs">{course.level}</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Training Plan / Roadmap */}
            {result.training_plan && result.training_plan.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-secondary" />
                  خطة التطوير الشخصية
                </h3>
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute top-0 bottom-0 right-6 w-0.5 bg-border hidden md:block" />
                  {result.training_plan.map((phase, i) => (
                    <Card key={i} className={`rounded-2xl shadow-lg border-2 ${phaseColors[i] || phaseColors[0]} relative`}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {i + 1}
                          </div>
                          <h4 className="font-bold text-foreground">{phase.phase}</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mr-11">
                          <div>
                            <p className="text-sm font-semibold text-foreground mb-2">🎯 الأهداف</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {phase.goals.map((g, gi) => <li key={gi} className="flex gap-1"><span>•</span><span>{g}</span></li>)}
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground mb-2">📋 الخطوات</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {phase.actions.map((a, ai) => <li key={ai} className="flex gap-1"><span>•</span><span>{a}</span></li>)}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Jobs */}
            {result.matching_jobs.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-warning" />
                  وظائف مطابقة متاحة الآن
                </h3>
                <div className="space-y-3">
                  {result.matching_jobs.map((job, i) => (
                    <Card key={i} className="rounded-2xl shadow-lg">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.department}</p>
                          <p className="text-sm text-muted-foreground mt-1">{job.match_reason}</p>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl" asChild>
                          <Link to="/jobs">عرض</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CareerGuidance;
