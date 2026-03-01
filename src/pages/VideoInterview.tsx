import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { useInterviewTimer } from "@/hooks/useInterviewTimer";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import InterviewHeader from "@/components/interview/InterviewHeader";
import ExitConfirmationDialog from "@/components/interview/ExitConfirmationDialog";
import JobSelector from "@/components/interview/JobSelector";
import CountdownOverlay from "@/components/interview/CountdownOverlay";
import RecordingControls from "@/components/interview/RecordingControls";
import TypingIndicator from "@/components/interview/TypingIndicator";
import SuccessCheckmark from "@/components/interview/SuccessCheckmark";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Video, Eye, EyeOff, Briefcase, Send, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VideoInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const session = useInterviewSession({ type: "video" });
  const timer = useInterviewTimer({ durationSeconds: session.timerDuration || 300 });

  const [showExit, setShowExit] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [transcription, setTranscription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { tabSwitchCount, showWarning } = useAntiCheat({ enableTabDetection: true });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (session.questionCount > 0 && !session.isCompleted) timer.restart();
  }, [session.questionCount]);

  useEffect(() => {
    if (!session.selectedJob) return;
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch {
        // permission denied
      }
    };
    initCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [session.selectedJob]);

  const transcribeAudio = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "فشل في تحويل الصوت");
      }

      const data = await response.json();
      if (data.transcription) {
        setTranscription(data.transcription);
        toast.success("تم تحويل الصوت إلى نص بنجاح");
      } else {
        toast.warning("لم يتم التعرف على كلام في التسجيل");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("فشل في تحويل الصوت إلى نص، يمكنك كتابة إجابتك يدوياً");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const beginRecording = useCallback(() => {
    setShowCountdown(true);
  }, []);

  const onCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      // Upload to storage
      if (user && session.interviewId && blob.size <= 52428800) {
        const fileName = `${user.id}/${session.interviewId}_q${session.questionCount}_${Date.now()}.webm`;
        const { error } = await supabase.storage
          .from("interview-recordings")
          .upload(fileName, blob, { contentType: "video/webm" });
        if (!error) toast.success("تم رفع التسجيل بنجاح");
      }
      // Auto-transcribe
      transcribeAudio(blob);
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setIsPaused(false);
  }, [user, session.interviewId, session.questionCount, transcribeAudio]);

  const pauseRecording = useCallback(() => {
    recorderRef.current?.pause();
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(() => {
    recorderRef.current?.resume();
    setIsPaused(false);
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const handleSubmit = async () => {
    if (!transcription.trim()) return;
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
    await session.sendAnswer(transcription);
    setTranscription("");
    timer.pause();
  };

  const handleBack = () => {
    if (session.interviewId) setShowExit(true);
    else navigate("/dashboard");
  };

  if (!session.selectedJob) {
    return <JobSelector title="مقابلة الفيديو" onSelect={session.startInterview} onBack={() => navigate("/dashboard")} />;
  }

  const lastAIMessage = [...session.messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <InterviewHeader
        timerFormatted={timer.formatted}
        isWarning={timer.isWarning}
        questionCount={session.questionCount}
        totalQuestions={session.totalQuestions}
        onBack={handleBack}
      />

      {showWarning && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-center gap-2 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            تحذير: تم اكتشاف مغادرة النافذة ({tabSwitchCount} مرة)
          </span>
        </div>
      )}

      {lastAIMessage && (
        <div className="px-4 pt-4">
          <Card className="container mx-auto max-w-5xl p-4 rounded-2xl shadow-lg animate-fade-in">
            <p className="text-sm leading-relaxed text-center">{lastAIMessage.content}</p>
          </Card>
        </div>
      )}

      {session.isLoading && (
        <div className="flex justify-center py-4"><TypingIndicator /></div>
      )}
      {showSuccess && (
        <div className="flex justify-center py-4"><SuccessCheckmark /></div>
      )}

      <div className="flex-1 container mx-auto max-w-5xl px-4 py-4 flex gap-4 relative">
        {showCountdown && <CountdownOverlay onComplete={onCountdownComplete} />}

        <div className="w-[60%] relative rounded-2xl overflow-hidden bg-muted shadow-xl">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <span className="w-3 h-3 rounded-full bg-destructive animate-pulse-record" />
              <span className="text-xs font-bold text-destructive">REC</span>
            </div>
          )}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-success bg-success/20 animate-pulse pointer-events-none" />
        </div>

        <div className="w-[40%] flex flex-col items-center justify-center rounded-2xl bg-card border shadow-lg p-6">
          <div
            className={`w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mb-4 ${
              session.isLoading ? "ring-4 ring-primary/40 animate-pulse" : "ring-2 ring-border"
            }`}
          >
            <Briefcase className="w-16 h-16 text-primary" />
          </div>
          <h3 className="font-bold text-foreground">المحاور الذكي</h3>
          <p className="text-xs text-muted-foreground">منصة المقابلات الذكية</p>
        </div>
      </div>

      {isTranscribing && (
        <div className="flex items-center justify-center gap-3 py-3 text-muted-foreground animate-fade-in">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">جارٍ تحويل الصوت إلى نص...</span>
        </div>
      )}

      {!session.isCompleted && !session.isLoading && (
        <div className="border-t border-border bg-card p-4">
          <div className="container mx-auto max-w-5xl space-y-3">
            <div className="flex items-center justify-center gap-4">
              {!isRecording && (
                <Button onClick={beginRecording} className="rounded-full gap-2 px-6" disabled={!cameraReady}>
                  <Video className="w-4 h-4" /> بدء التسجيل
                </Button>
              )}
              <RecordingControls
                isRecording={isRecording}
                isPaused={isPaused}
                onPause={pauseRecording}
                onResume={resumeRecording}
                onStop={stopRecording}
              />
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1"
                onClick={() => setShowTranscript((v) => !v)}
              >
                {showTranscript ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showTranscript ? "إخفاء النص" : "إظهار النص"}
              </Button>
            </div>

            {showTranscript && (
              <div className="flex gap-3">
                <Textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder={isTranscribing ? "جارٍ تحويل الصوت إلى نص..." : "اكتب إجابتك هنا..."}
                  className="rounded-xl flex-1 min-h-[48px] max-h-[100px] resize-none"
                  rows={2}
                  disabled={isTranscribing}
                />
                <Button onClick={handleSubmit} disabled={!transcription.trim() || isTranscribing} className="rounded-xl self-end" size="icon">
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <ExitConfirmationDialog open={showExit} onOpenChange={setShowExit} onConfirm={() => navigate("/dashboard")} />
    </div>
  );
};

export default VideoInterview;
