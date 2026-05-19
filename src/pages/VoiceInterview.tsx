import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import JobSelector from "@/components/interview/JobSelector";
import LiveInterview from "@/components/interview/LiveInterview";
import { Loader2 } from "lucide-react";

const VoiceInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [searchParams] = useSearchParams();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const preSelectedJob = searchParams.get("job") || undefined;
  // Demo-tour shortcut: when the URL pre-specifies a question count (and
  // either a job or practice mode), skip the JobSelector entirely so the
  // automated tour can drive straight into the live interview.
  const urlQuestionCount = searchParams.get("question_count");
  const isPractice = searchParams.get("practice") === "true";

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (settingsLoading) return;
    if (selectedJob !== null && questionCount !== null) return;
    const n = urlQuestionCount ? parseInt(urlQuestionCount, 10) : NaN;
    if (!Number.isFinite(n) || n < 1) return;
    if (preSelectedJob) {
      setSelectedJob(preSelectedJob);
      setQuestionCount(n);
    } else if (isPractice) {
      setSelectedJob("عام");
      setQuestionCount(n);
    }
  }, [settingsLoading, urlQuestionCount, preSelectedJob, isPractice, selectedJob, questionCount]);

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedJob || questionCount === null) {
    return (
      <JobSelector
        title="المقابلة الصوتية"
        onSelect={(job, count) => {
          setSelectedJob(job);
          setQuestionCount(count ?? settings.questions_per_type.voice);
        }}
        onBack={() => navigate("/dashboard")}
        isPractice={isPractice}
        preSelectedJob={preSelectedJob}
      />
    );
  }

  return (
    <LiveInterview
      type="voice"
      jobPosition={selectedJob}
      totalQuestions={questionCount}
      onBack={() => navigate("/dashboard")}
    />
  );
};

export default VoiceInterview;
