import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Briefcase, ArrowRight, Loader2, Play, ChevronRight } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface JobSelectorProps {
  title: string;
  onSelect: (job: string, questionCount?: number) => void;
  onBack: () => void;
}

const QUICK_COUNTS = [3, 5, 8, 10];

const JobSelector = ({ title, onSelect, onBack }: JobSelectorProps) => {
  const { settings, loading } = useSystemSettings();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(5);

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
              <p className="text-muted-foreground">سيتم توليد أسئلة مخصصة بناءً على الوظيفة التي تختارها</p>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
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

              {/* Quick count buttons */}
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

              {/* Slider */}
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

              {/* Start button */}
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
