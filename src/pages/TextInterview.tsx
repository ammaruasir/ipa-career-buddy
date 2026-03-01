import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { useInterviewTimer } from "@/hooks/useInterviewTimer";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import InterviewHeader from "@/components/interview/InterviewHeader";
import ExitConfirmationDialog from "@/components/interview/ExitConfirmationDialog";
import JobSelector from "@/components/interview/JobSelector";
import TypingIndicator from "@/components/interview/TypingIndicator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, AlertTriangle } from "lucide-react";

const TextInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [showExit, setShowExit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = useInterviewSession({ type: "text" });
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

  const handleBack = () => {
    if (session.interviewId) {
      setShowExit(true);
    } else {
      navigate("/dashboard");
    }
  };

  if (!session.selectedJob) {
    return <JobSelector title="المقابلة النصية" onSelect={session.startInterview} onBack={() => navigate("/dashboard")} />;
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
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
    </div>
  );
};

export default TextInterview;
