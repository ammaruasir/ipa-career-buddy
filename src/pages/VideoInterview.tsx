import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import JobSelector from "@/components/interview/JobSelector";
import LiveInterview from "@/components/interview/LiveInterview";
import { Loader2 } from "lucide-react";

const VideoInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

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

  if (!selectedJob) {
    return (
      <JobSelector
        title="مقابلة الفيديو"
        onSelect={(job) => setSelectedJob(job)}
        onBack={() => navigate("/dashboard")}
      />
    );
  }

  return (
    <LiveInterview
      type="video"
      jobPosition={selectedJob}
      totalQuestions={settings.questions_per_type.video}
      onBack={() => navigate("/dashboard")}
    />
  );
};

export default VideoInterview;
