import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { useInterviewTimer } from "@/hooks/useInterviewTimer";
import InterviewHeader from "@/components/interview/InterviewHeader";
import ExitConfirmationDialog from "@/components/interview/ExitConfirmationDialog";
import JobSelector from "@/components/interview/JobSelector";
import TypingIndicator from "@/components/interview/TypingIndicator";
import AudioWaveform from "@/components/interview/AudioWaveform";
import SuccessCheckmark from "@/components/interview/SuccessCheckmark";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Play, Send, RotateCcw } from "lucide-react";

const VoiceInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const session = useInterviewSession({ type: "voice", totalQuestions: 5 });
  const timer = useInterviewTimer({ durationSeconds: 300 });

  const [showExit, setShowExit] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [transcription, setTranscription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (session.questionCount > 0 && !session.isCompleted) timer.restart();
  }, [session.questionCount]);

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
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        setAnalyser(null);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setAudioURL(null);
    } catch {
      // permission denied
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleSubmit = async () => {
    if (!transcription.trim()) return;
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
    await session.sendAnswer(transcription);
    setTranscription("");
    setAudioURL(null);
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

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {/* Current question */}
        {lastAIMessage && (
          <Card className="w-full max-w-xl p-6 rounded-2xl shadow-lg animate-fade-in text-center">
            <p className="text-base leading-relaxed">{lastAIMessage.content}</p>
          </Card>
        )}

        {session.isLoading && <TypingIndicator />}
        {showSuccess && <SuccessCheckmark />}

        {/* Waveform */}
        {isRecording && <AudioWaveform analyser={analyser} isRecording={isRecording} />}

        {/* Record button */}
        {!session.isCompleted && !session.isLoading && (
          <div className="flex flex-col items-center gap-4">
            {!isRecording && !audioURL && (
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

        {/* Playback */}
        {audioURL && !isRecording && (
          <div className="flex items-center gap-3">
            <audio src={audioURL} controls className="h-10" />
            <Button variant="ghost" size="icon" onClick={() => { setAudioURL(null); setTranscription(""); }}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Transcription area */}
        {!session.isCompleted && !session.isLoading && (
          <div className="w-full max-w-xl space-y-3">
            <Textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="اكتب أو راجع النص المنسوخ هنا..."
              className="rounded-xl min-h-[80px]"
              rows={3}
            />
            <Button onClick={handleSubmit} disabled={!transcription.trim()} className="w-full rounded-xl gap-2">
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
