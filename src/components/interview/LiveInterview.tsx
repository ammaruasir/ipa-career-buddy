import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveInterview } from "@/hooks/useLiveInterview";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useCheatCamera } from "@/hooks/useCheatCamera";
import InterviewHeader from "@/components/interview/InterviewHeader";
import ExitConfirmationDialog from "@/components/interview/ExitConfirmationDialog";
import AIAvatarScene from "@/components/interview/AIAvatarScene";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Phone, PhoneOff, AlertTriangle, Loader2, Mic, Volume2, Brain, FileText, Camera } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LiveInterviewProps {
  type: "voice" | "video";
  jobPosition: string;
  totalQuestions: number;
  onBack: () => void;
}

const LiveInterview = ({ type, jobPosition, totalQuestions, onBack }: LiveInterviewProps) => {
  const navigate = useNavigate();
  const [showExit, setShowExit] = useState(false);
  const { tabSwitchCount, showWarning } = useAntiCheat({ enableTabDetection: true });

  const live = useLiveInterview({
    type,
    jobPosition,
    totalQuestions,
  });

  // Cheat camera for voice mode (video mode already has camera via useLiveInterview)
  const cheatCamera = useCheatCamera({
    enabled: type === "voice" && live.isCallActive,
    interviewId: live.interviewId,
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Bind video stream to video element
  useEffect(() => {
    if (type === "video" && localVideoRef.current && live.videoStream) {
      localVideoRef.current.srcObject = live.videoStream;
    }
  }, [type, live.videoStream]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [live.transcript]);

  // Also connect videoElementRef for frame capture
  useEffect(() => {
    if (type === "video" && localVideoRef.current) {
      live.videoElementRef.current = localVideoRef.current;
    }
  }, [type, live.videoElementRef]);

  const handleBack = () => {
    if (live.isCallActive) {
      setShowExit(true);
    } else {
      onBack();
    }
  };

  const handleExitConfirm = () => {
    live.endCall();
    navigate("/dashboard");
  };

  const progress = Math.min((live.questionCount / totalQuestions) * 100, 100);

  // Determine avatar state
  const avatarState = live.isSpeaking ? "speaking" : live.isListening ? "listening" : "idle";

  // Determine current status label
  const getStatusBadge = () => {
    if (live.isSpeaking) {
      return (
        <Badge variant="default" className="gap-2 px-4 py-2 text-sm animate-fade-in">
          <Volume2 className="w-4 h-4 animate-pulse" />
          المحاور يتحدث...
        </Badge>
      );
    }
    if (live.isListening) {
      return (
        <Badge variant="secondary" className="gap-2 px-4 py-2 text-sm animate-fade-in">
          <Mic className="w-4 h-4 animate-pulse" />
          يستمع إليك...
        </Badge>
      );
    }
    if (live.isTranscribing) {
      return (
        <Badge variant="outline" className="gap-2 px-4 py-2 text-sm">
          <FileText className="w-4 h-4 animate-pulse" />
          جارٍ تحويل الصوت...
        </Badge>
      );
    }
    if (live.isProcessing) {
      return (
        <Badge variant="outline" className="gap-2 px-4 py-2 text-sm">
          <Brain className="w-4 h-4 animate-pulse" />
          جارٍ التفكير...
        </Badge>
      );
    }
    if (live.isConnecting) {
      return (
        <Badge variant="outline" className="gap-2 px-4 py-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ بدء المقابلة...
        </Badge>
      );
    }
    if (live.isEvaluating) {
      return (
        <Badge variant="outline" className="gap-2 px-4 py-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ تقييم المقابلة...
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <InterviewHeader
        timerFormatted="مباشر"
        isWarning={false}
        questionCount={live.questionCount}
        totalQuestions={totalQuestions}
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
        {/* AI Avatar + Candidate Camera */}
        <div className="relative w-full max-w-md h-64 rounded-2xl overflow-hidden shadow-xl border">
          <AIAvatarScene avatarState={avatarState} />
          {/* Candidate PiP Camera - video mode */}
          {type === "video" && (
            <div className="absolute bottom-3 left-3 w-28 h-20 rounded-xl overflow-hidden border-2 border-background shadow-lg bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: "scaleX(-1)" }}
              />
            </div>
          )}
          {/* Candidate PiP Camera - voice mode (cheat detection) */}
          {type === "voice" && cheatCamera.stream && (
            <div className="absolute bottom-3 left-3 w-28 h-20 rounded-xl overflow-hidden border-2 border-background shadow-lg bg-black">
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
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3">
          {getStatusBadge()}
        </div>

        {/* Progress */}
        {live.isCallActive && (
          <div className="w-full max-w-md space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              السؤال {Math.min(live.questionCount, totalQuestions)} من {totalQuestions}
            </p>
          </div>
        )}

        {/* Live transcript */}
        {live.transcript.length > 0 && (
          <Card className="w-full max-w-xl p-4 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-muted-foreground mb-3">النص المباشر</p>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {live.transcript.slice(-6).map((entry, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded-lg ${
                      entry.role === "assistant"
                        ? "bg-primary/10 text-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <span className="text-xs font-bold text-muted-foreground block mb-1">
                      {entry.role === "assistant" ? "المحاور" : "أنت"}
                    </span>
                    {entry.text}
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* Call controls */}
        <div className="flex items-center gap-4">
          {!live.isCallActive && !live.isConnecting && !live.isCompleted && (
            <Button
              onClick={live.startCall}
              size="lg"
              className="rounded-full gap-2 px-8 bg-emerald-600 hover:bg-emerald-700"
            >
              <Phone className="w-5 h-5" />
              بدء المقابلة المباشرة
            </Button>
          )}
          {live.isCallActive && (
            <Button
              onClick={live.endCall}
              size="lg"
              variant="destructive"
              className="rounded-full gap-2 px-8"
            >
              <PhoneOff className="w-5 h-5" />
              إنهاء المقابلة
            </Button>
          )}
        </div>

        {/* Instructions before call */}
        {!live.isCallActive && !live.isConnecting && !live.isCompleted && (
          <Card className="w-full max-w-md p-4 rounded-2xl text-center">
            <p className="text-sm text-muted-foreground leading-relaxed">
              ستتحدث مباشرة مع المحاور الآلي عبر الصوت.
              <br />
              تأكد من تفعيل الميكروفون والسماعات قبل البدء.
              <br />
              <span className="text-xs mt-2 block">سيتم تسجيل إجابتك تلقائياً والتوقف عند الصمت.</span>
            </p>
          </Card>
        )}
      </div>

      <ExitConfirmationDialog
        open={showExit}
        onOpenChange={setShowExit}
        onConfirm={handleExitConfirm}
      />
    </div>
  );
};

export default LiveInterview;
