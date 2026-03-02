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
  TrendingUp, RefreshCw, GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

interface GuidanceResult {
  career_paths: { title: string; description: string; match_percent: number }[];
  skills_to_develop: { skill: string; importance: string }[];
  matching_jobs: { title: string; department: string; match_reason: string }[];
  summary: string;
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
            <Button
              onClick={analyze}
              disabled={analyzing || !hasSkills}
              className="rounded-xl px-8"
              size="lg"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  جاري التحليل...
                </>
              ) : result ? (
                <>
                  <RefreshCw className="w-4 h-4 ml-2" />
                  إعادة التحليل
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 ml-2" />
                  ابدأ التحليل
                </>
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
