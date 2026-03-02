import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import JobSelector from "@/components/interview/JobSelector";
import LiveInterview from "@/components/interview/LiveInterview";
import { Loader2 } from "lucide-react";

const VideoInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [searchParams] = useSearchParams();
  const [selectedJob, setSelectedJob] = useState<string | null>(searchParams.get("job"));
  const [questionCount, setQuestionCount] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If job came from URL params, skip JobSelector but use default count
  if (selectedJob && questionCount === null) {
    setQuestionCount(settings.questions_per_type.video);
  }

  if (!selectedJob || questionCount === null) {
    return (
      <JobSelector
        title="مقابلة الفيديو"
        onSelect={(job, count) => {
          setSelectedJob(job);
          setQuestionCount(count ?? settings.questions_per_type.video);
        }}
        onBack={() => navigate("/dashboard")}
      />
    );
  }

  return (
    <LiveInterview
      type="video"
      jobPosition={selectedJob}
      totalQuestions={questionCount}
      onBack={() => navigate("/dashboard")}
    />
  );
};

export default VideoInterview;
