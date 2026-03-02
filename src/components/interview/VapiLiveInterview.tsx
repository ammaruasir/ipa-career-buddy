import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVapiInterview } from "@/hooks/useVapiInterview";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import InterviewHeader from "@/components/interview/InterviewHeader";
import ExitConfirmationDialog from "@/components/interview/ExitConfirmationDialog";
import AIAvatarScene from "@/components/interview/AIAvatarScene";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Phone, PhoneOff, AlertTriangle, Loader2, Mic, Volume2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VapiLiveInterviewProps {
  type: "voice" | "video";
  jobPosition: string;
  totalQuestions: number;
  onBack: () => void;
}

const VapiLiveInterview = ({ type, jobPosition, totalQuestions, onBack }: VapiLiveInterviewProps) => {
  const navigate = useNavigate();
  const [showExit, setShowExit] = useState(false);
  const { tabSwitchCount, showWarning } = useAntiCheat({ enableTabDetection: true });

  const vapi = useVapiInterview({
    type,
    jobPosition,
    totalQuestions,
  });

  const handleBack = () => {
    if (vapi.isCallActive) {
      setShowExit(true);
    } else {
      onBack();
    }
  };

  const handleExitConfirm = () => {
    vapi.endCall();
    navigate("/dashboard");
  };

  const progress = Math.min((vapi.questionCount / totalQuestions) * 100, 100);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <InterviewHeader
        timerFormatted="مباشر"
        isWarning={false}
        questionCount={vapi.questionCount}
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
        {/* AI Avatar */}
        <div className="w-full max-w-md h-64 rounded-2xl overflow-hidden shadow-xl border">
          <AIAvatarScene
            avatarState={vapi.isSpeaking ? "speaking" : vapi.isCallActive ? "listening" : "idle"}
            audioAnalyser={null}
          />
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3">
          {vapi.isCallActive && (
            <Badge
              variant={vapi.isSpeaking ? "default" : "secondary"}
              className="gap-2 px-4 py-2 text-sm animate-fade-in"
            >
              {vapi.isSpeaking ? (
                <>
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  المحاور يتحدث...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 animate-pulse" />
                  يستمع إليك...
                </>
              )}
            </Badge>
          )}
          {vapi.isConnecting && (
            <Badge variant="outline" className="gap-2 px-4 py-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ الاتصال...
            </Badge>
          )}
          {vapi.isEvaluating && (
            <Badge variant="outline" className="gap-2 px-4 py-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ تقييم المقابلة...
            </Badge>
          )}
        </div>

        {/* Progress */}
        {vapi.isCallActive && (
          <div className="w-full max-w-md space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              السؤال {Math.min(vapi.questionCount, totalQuestions)} من {totalQuestions}
            </p>
          </div>
        )}

        {/* Live transcript */}
        {vapi.transcript.length > 0 && (
          <Card className="w-full max-w-xl p-4 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-muted-foreground mb-3">النص المباشر</p>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {vapi.transcript.slice(-6).map((entry, i) => (
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
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* Call controls */}
        <div className="flex items-center gap-4">
          {!vapi.isCallActive && !vapi.isConnecting && !vapi.isCompleted && (
            <Button
              onClick={vapi.startCall}
              size="lg"
              className="rounded-full gap-2 px-8 bg-emerald-600 hover:bg-emerald-700"
            >
              <Phone className="w-5 h-5" />
              بدء المقابلة المباشرة
            </Button>
          )}
          {vapi.isCallActive && (
            <Button
              onClick={vapi.endCall}
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
        {!vapi.isCallActive && !vapi.isConnecting && !vapi.isCompleted && (
          <Card className="w-full max-w-md p-4 rounded-2xl text-center">
            <p className="text-sm text-muted-foreground leading-relaxed">
              ستتحدث مباشرة مع المحاور الآلي عبر الصوت.
              <br />
              تأكد من تفعيل الميكروفون والسماعات قبل البدء.
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

export default VapiLiveInterview;
