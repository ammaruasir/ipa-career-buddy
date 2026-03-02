import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Briefcase, ArrowRight, Loader2, Play, ChevronRight, Sparkles, List } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toArabicNumerals, formatArabicPercent } from "@/lib/arabic-utils";

interface JobSelectorProps {
  title: string;
  onSelect: (job: string, questionCount?: number) => void;
  onBack: () => void;
  isPractice?: boolean;
}

interface MatchedJob {
  title: string;
  department: string | null;
  matchPercent: number;
  requirements: string[];
}

const QUICK_COUNTS = [3, 5, 8, 10];

const JobSelector = ({ title, onSelect, onBack, isPractice = false }: JobSelectorProps) => {
  const { settings, loading } = useSystemSettings();
  const { user } = useAuth();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [matchedJobs, setMatchedJobs] = useState<MatchedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);

  // Fetch profile + vacancies and compute match when in practice mode
  useEffect(() => {
    if (!isPractice || !user) return;

    const fetchAndMatch = async () => {
      setLoadingJobs(true);
      try {
        const [profileRes, vacanciesRes] = await Promise.all([
          supabase.from("profiles").select("resume_skills, major").eq("user_id", user.id).single(),
          supabase.from("job_vacancies").select("title, department, requirements").eq("is_active", true),
        ]);

        const profile = profileRes.data;
        const vacancies = vacanciesRes.data || [];

        if (!profile || !vacancies.length) {
          setMatchedJobs([]);
          setLoadingJobs(false);
          return;
        }

        // Extract user skills
        const skills = profile.resume_skills as any;
        const userSkills: string[] = [
          ...(skills?.technical_skills || []),
          ...(skills?.soft_skills || []),
          ...(skills?.certifications || []),
          ...(profile.major ? [profile.major] : []),
        ].map((s: string) => s.toLowerCase().trim());

        const results: MatchedJob[] = vacancies.map((v: any) => {
          const reqs: string[] = Array.isArray(v.requirements) ? v.requirements : [];
          if (reqs.length === 0) return { title: v.title, department: v.department, matchPercent: 50, requirements: reqs };

          const matched = reqs.filter((r: string) =>
            userSkills.some((s) => s.includes(r.toLowerCase().trim()) || r.toLowerCase().trim().includes(s))
          );
          const matchPercent = Math.round((matched.length / reqs.length) * 100);
          return { title: v.title, department: v.department, matchPercent, requirements: reqs };
        });

        results.sort((a, b) => b.matchPercent - a.matchPercent);
        setMatchedJobs(results);
      } catch (err) {
        console.error("Failed to fetch matched jobs:", err);
      }
      setLoadingJobs(false);
    };

    fetchAndMatch();
  }, [isPractice, user]);

  const handleJobClick = (job: string) => {
    setSelectedJob(job);
  };

  const handleStart = () => {
    if (selectedJob) {
      onSelect(selectedJob, questionCount);
    }
  };

  const handleBackToJobs = () => {
    setSelectedJob(null);
  };

  const getMatchBadge = (percent: number) => {
    if (percent >= 70) return { color: "bg-green-500/15 text-green-700 border-green-500/30", label: `تطابق ${formatArabicPercent(percent)}` };
    if (percent >= 40) return { color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", label: `تطابق ${formatArabicPercent(percent)}` };
    return { color: "bg-muted text-muted-foreground border-border", label: `تطابق ${formatArabicPercent(percent)}` };
  };

  const showPracticeJobs = isPractice && matchedJobs.length > 0 && !showAllJobs;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={selectedJob ? handleBackToJobs : onBack}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <img src="/ipa-logo.png" alt="معهد الإدارة العامة" className="w-10 h-10 rounded-xl object-contain" />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
      </header>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          {!selectedJob ? (
            <>
              <h2 className="text-2xl font-bold text-foreground">اختر الوظيفة المستهدفة</h2>
              <p className="text-muted-foreground">
                {showPracticeJobs
                  ? "الوظائف المقترحة بناءً على مهاراتك وملفك الشخصي"
                  : "سيتم توليد أسئلة مخصصة بناءً على الوظيفة التي تختارها"}
              </p>

              {(loading || loadingJobs) ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : showPracticeJobs ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {matchedJobs.map((job) => {
                      const badge = getMatchBadge(job.matchPercent);
                      return (
                        <Button
                          key={job.title}
                          variant="outline"
                          className="rounded-2xl py-6 h-auto flex flex-col items-start text-right gap-2 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all"
                          onClick={() => handleJobClick(job.title)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-lg font-semibold">{job.title}</span>
                            <Badge className={`text-xs border ${badge.color}`}>{badge.label}</Badge>
                          </div>
                          {job.department && (
                            <span className="text-xs text-muted-foreground">{job.department}</span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    className="gap-2 text-muted-foreground"
                    onClick={() => setShowAllJobs(true)}
                  >
                    <List className="w-4 h-4" />
                    عرض جميع الوظائف
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {settings.job_positions.map((job) => (
                      <Button
                        key={job}
                        variant="outline"
                        className="rounded-2xl py-6 text-lg shadow-lg hover:shadow-xl hover:border-primary/30 transition-all"
                        onClick={() => handleJobClick(job)}
                      >
                        {job}
                      </Button>
                    ))}
                  </div>
                  {isPractice && matchedJobs.length > 0 && showAllJobs && (
                    <Button
                      variant="ghost"
                      className="gap-2 text-muted-foreground"
                      onClick={() => setShowAllJobs(false)}
                    >
                      <Sparkles className="w-4 h-4" />
                      عرض الوظائف المقترحة
                    </Button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <span>{selectedJob}</span>
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span>اختيار عدد الأسئلة</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">اختر عدد الأسئلة للمقابلة</h2>
              <p className="text-muted-foreground">يمكنك تخصيص عدد الأسئلة لأغراض العرض التوضيحي</p>

              <div className="flex justify-center gap-3">
                {QUICK_COUNTS.map((count) => (
                  <Button
                    key={count}
                    variant={questionCount === count ? "default" : "outline"}
                    className="rounded-2xl w-16 h-16 text-xl font-bold shadow-md hover:shadow-lg transition-all"
                    onClick={() => setQuestionCount(count)}
                  >
                    {count}
                  </Button>
                ))}
              </div>

              <div className="space-y-3 px-4">
                <Slider
                  value={[questionCount]}
                  onValueChange={([v]) => setQuestionCount(v)}
                  min={1}
                  max={15}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span className="text-base font-bold text-primary">{questionCount} أسئلة</span>
                  <span>15</span>
                </div>
              </div>

              <Button
                size="lg"
                className="rounded-2xl px-10 py-6 text-lg shadow-xl hover:shadow-2xl transition-all gap-2"
                onClick={handleStart}
              >
                <Play className="w-5 h-5" />
                بدء المقابلة
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobSelector;
