import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { useInterviewTimer } from "@/hooks/useInterviewTimer";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import InterviewHeader from "@/components/interview/InterviewHeader";
import ExitConfirmationDialog from "@/components/interview/ExitConfirmationDialog";
import JobSelector from "@/components/interview/JobSelector";
import TypingIndicator from "@/components/interview/TypingIndicator";
import AudioWaveform from "@/components/interview/AudioWaveform";
import SuccessCheckmark from "@/components/interview/SuccessCheckmark";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Send, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VoiceInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const session = useInterviewSession({ type: "voice" });
  const timer = useInterviewTimer({ durationSeconds: session.timerDuration || 300 });

  const [showExit, setShowExit] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [transcription, setTranscription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

  const { tabSwitchCount, showWarning } = useAntiCheat({ enableTabDetection: true });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (session.questionCount > 0 && !session.isCompleted) timer.restart();
  }, [session.questionCount]);

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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      audioContextRef.current = ctx;
      setAnalyser(analyserNode);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        setAnalyser(null);
        // Auto-transcribe
        transcribeAudio(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setAudioURL(null);
      setTranscription("");
    } catch {
      toast.error("لم يتم السماح بالوصول إلى الميكروفون");
    }
  }, [transcribeAudio]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const uploadRecording = async (blob: Blob): Promise<string | null> => {
    if (!user || !session.interviewId) return null;
    const fileName = `${user.id}/${session.interviewId}_q${session.questionCount}_${Date.now()}.webm`;
    const { error } = await supabase.storage
      .from("interview-recordings")
      .upload(fileName, blob, { contentType: "audio/webm" });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    return fileName;
  };

  const handleSubmit = async () => {
    if (!transcription.trim()) return;
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);

    if (audioBlobRef.current) {
      uploadRecording(audioBlobRef.current).then((path) => {
        if (path) toast.success("تم رفع التسجيل بنجاح");
      });
    }

    await session.sendAnswer(transcription);
    setTranscription("");
    setAudioURL(null);
    audioBlobRef.current = null;
    timer.pause();
  };

  const handleBack = () => {
    if (session.interviewId) setShowExit(true);
    else navigate("/dashboard");
  };

  if (!session.selectedJob) {
    return <JobSelector title="المقابلة الصوتية" onSelect={session.startInterview} onBack={() => navigate("/dashboard")} />;
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

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {lastAIMessage && (
          <Card className="w-full max-w-xl p-6 rounded-2xl shadow-lg animate-fade-in text-center">
            <p className="text-base leading-relaxed">{lastAIMessage.content}</p>
          </Card>
        )}

        {session.isLoading && <TypingIndicator />}
        {showSuccess && <SuccessCheckmark />}

        {isRecording && <AudioWaveform analyser={analyser} isRecording={isRecording} />}

        {!session.isCompleted && !session.isLoading && (
          <div className="flex flex-col items-center gap-4">
            {!isRecording && !audioURL && !isTranscribing && (
              <button
                onClick={startRecording}
                className="w-24 h-24 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
              >
                <Mic className="w-10 h-10" />
              </button>
            )}
            {isRecording && (
              <button
                onClick={stopRecording}
                className="w-24 h-24 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-xl animate-pulse-record"
              >
                <Square className="w-8 h-8" />
              </button>
            )}
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center gap-3 text-muted-foreground animate-fade-in">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">جارٍ تحويل الصوت إلى نص...</span>
          </div>
        )}

        {audioURL && !isRecording && (
          <div className="flex items-center gap-3">
            <audio src={audioURL} controls className="h-10" />
            <Button variant="ghost" size="icon" onClick={() => { setAudioURL(null); setTranscription(""); audioBlobRef.current = null; }}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        )}

        {!session.isCompleted && !session.isLoading && (
          <div className="w-full max-w-xl space-y-3">
            <Textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder={isTranscribing ? "جارٍ تحويل الصوت إلى نص..." : "اكتب أو راجع النص المنسوخ هنا..."}
              className="rounded-xl min-h-[80px]"
              rows={3}
              disabled={isTranscribing}
            />
            <Button onClick={handleSubmit} disabled={!transcription.trim() || isTranscribing} className="w-full rounded-xl gap-2">
              <Send className="w-4 h-4" /> إرسال الإجابة
            </Button>
          </div>
        )}
      </div>

      <ExitConfirmationDialog open={showExit} onOpenChange={setShowExit} onConfirm={() => navigate("/dashboard")} />
    </div>
  );
};

export default VoiceInterview;
