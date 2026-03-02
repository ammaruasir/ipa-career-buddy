import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { useInterviewTimer } from "@/hooks/useInterviewTimer";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useCheatCamera } from "@/hooks/useCheatCamera";
import InterviewHeader from "@/components/interview/InterviewHeader";
import ExitConfirmationDialog from "@/components/interview/ExitConfirmationDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import JobSelector from "@/components/interview/JobSelector";
import TypingIndicator from "@/components/interview/TypingIndicator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, AlertTriangle, Camera } from "lucide-react";

const TextInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [showExit, setShowExit] = useState(false);
  const [customQuestionCount, setCustomQuestionCount] = useState<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionChunksRef = useRef<Blob[]>([]);

  const session = useInterviewSession({ type: "text", totalQuestions: customQuestionCount });
  const timer = useInterviewTimer({
    durationSeconds: session.timerDuration || 300,
    onExpire: () => {
      if (input.trim()) session.sendAnswer(input);
    },
  });

  const { tabSwitchCount, showWarning, handlePaste } = useAntiCheat({
    enableTabDetection: true,
    enablePasteDetection: true,
  });

  const cheatCamera = useCheatCamera({
    enabled: !!session.selectedJob,
    interviewId: session.interviewId,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session.messages]);

  useEffect(() => {
    if (session.messages.length > 0 && !session.isCompleted) {
      timer.restart();
    }
  }, [session.questionCount]);

  const handleSend = () => {
    if (!input.trim()) return;
    session.sendAnswer(input);
    setInput("");
    timer.pause();
  };

  // Start session recording when cheat camera stream is available
  useEffect(() => {
    if (!cheatCamera.stream || !session.interviewId) return;
    try {
      const recorder = new MediaRecorder(cheatCamera.stream, { mimeType: "video/webm" });
      sessionChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) sessionChunksRef.current.push(e.data);
      };
      recorder.start(5000);
      sessionRecorderRef.current = recorder;
    } catch (err) {
      console.error("Failed to start session recorder:", err);
    }
    return () => {
      if (sessionRecorderRef.current?.state === "recording") {
        sessionRecorderRef.current.stop();
      }
    };
  }, [cheatCamera.stream, session.interviewId]);

  // Upload recording when interview completes
  useEffect(() => {
    if (!session.isCompleted || !session.interviewId || !user) return;

    const uploadRecording = async () => {
      // Stop cheat camera
      cheatCamera.stopAndUpload();

      // Stop session recorder
      if (sessionRecorderRef.current?.state === "recording") {
        sessionRecorderRef.current.stop();
      }

      // Wait for chunks
      await new Promise(resolve => setTimeout(resolve, 500));

      const blob = new Blob(sessionChunksRef.current, { type: "video/webm" });
      if (blob.size === 0) return;

      try {
        const fileName = `${user.id}/${session.interviewId}_full.webm`;
        const { error } = await supabase.storage
          .from("interview-recordings")
          .upload(fileName, blob, { contentType: "video/webm", upsert: true });

        if (!error) {
          const { data: urlData } = supabase.storage
            .from("interview-recordings")
            .getPublicUrl(fileName);

          await supabase
            .from("interviews")
            .update({ recording_url: urlData.publicUrl } as any)
            .eq("id", session.interviewId);
        }
      } catch (err) {
        console.error("Failed to upload text interview recording:", err);
      }
    };

    uploadRecording();
  }, [session.isCompleted, session.interviewId, user]);

  const handleBack = () => {
    if (session.interviewId) {
      setShowExit(true);
    } else {
      navigate("/dashboard");
    }
  };

  const isPractice = new URLSearchParams(window.location.search).get("practice") === "true";
  const preSelectedJob = new URLSearchParams(window.location.search).get("job") || undefined;

  if (!session.selectedJob) {
    return <JobSelector title="المقابلة النصية" onSelect={(job, count) => { setCustomQuestionCount(count); session.startInterview(job); }} onBack={() => navigate("/dashboard")} isPractice={isPractice} preSelectedJob={preSelectedJob} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <InterviewHeader
        timerFormatted={timer.formatted}
        isWarning={timer.isWarning}
        questionCount={session.questionCount}
        totalQuestions={session.totalQuestions}
        onBack={handleBack}
      />

      {/* Anti-cheat warning banner */}
      {showWarning && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-center gap-2 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            تحذير: تم اكتشاف مغادرة النافذة ({tabSwitchCount} مرة)
          </span>
        </div>
      )}

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 relative">
        {/* Cheat Camera PiP */}
        {cheatCamera.stream && (
          <div className="fixed bottom-24 left-4 w-32 h-24 rounded-xl overflow-hidden border-2 border-border shadow-lg bg-black z-50">
            <video
              ref={cheatCamera.videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
              <Camera className="w-3 h-3 text-red-400" />
              <span className="text-[9px] text-red-400 font-medium">REC</span>
            </div>
          </div>
        )}
        <div className="container mx-auto max-w-2xl space-y-4">
          {session.messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 animate-fade-in ${msg.role === "user" ? "justify-start" : "justify-end"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 order-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <Card
                className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border shadow-md rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                <span className={`text-[10px] mt-1 block ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </Card>
            </div>
          ))}
          {session.isLoading && (
            <div className="flex items-end gap-2 justify-end animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <Card className="p-4 rounded-2xl bg-card border shadow-md rounded-bl-sm">
                <TypingIndicator />
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      {!session.isCompleted && (
        <div className="border-t border-border bg-card p-4">
          <div className="container mx-auto max-w-2xl flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={handlePaste}
              placeholder="اكتب إجابتك هنا..."
              className="rounded-xl flex-1 min-h-[48px] max-h-[120px] resize-none"
              disabled={session.isLoading}
              rows={2}
            />
            <Button
              onClick={handleSend}
              disabled={session.isLoading || !input.trim()}
              className="rounded-xl self-end"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      <ExitConfirmationDialog open={showExit} onOpenChange={setShowExit} onConfirm={() => navigate("/dashboard")} />

      {/* End confirmation dialog when all questions answered */}
      <AlertDialog open={session.awaitingEndConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>اكتملت أسئلة المقابلة</AlertDialogTitle>
            <AlertDialogDescription>
              هل ترغب في إنهاء المقابلة والحصول على التقييم، أم المتابعة بأسئلة إضافية؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={session.continueInterview}>متابعة بأسئلة إضافية</AlertDialogCancel>
            <AlertDialogAction onClick={session.confirmEnd} className="bg-primary text-primary-foreground hover:bg-primary/90">
              إنهاء المقابلة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TextInterview;
