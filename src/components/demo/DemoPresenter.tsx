import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Mic, MicOff, Send, ChevronRight, ChevronLeft } from "lucide-react";
import { useTourEngine } from "@/contexts/DemoTourContext";
import { DemoControls } from "./DemoControls";

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-0.5 h-6 px-2" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`block w-1 rounded-full bg-primary transition-all ${active ? "animate-pulse" : ""}`}
          style={{
            height: active ? `${30 + ((i * 17) % 50)}%` : "20%",
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function DemoPresenter() {
  const {
    status, currentStep, stepIndex, totalSteps,
    isSpeaking, isRecording, pendingAnswer,
    askText, beginVoiceQuestion, endVoiceQuestion,
    micConsent, qaCount, qaCap, showActEndPrompt, actEndLabel,
  } = useTourEngine();

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (status === "idle" || status === "finished") return null;

  const displayText =
    pendingAnswer ?? (status === "qna" ? "جاري التفكير…" : currentStep?.narration ?? "");
  const capReached = qaCount >= qaCap;

  const submitText = async () => {
    const t = draft.trim();
    if (!t || sending || capReached) return;
    setSending(true);
    setDraft("");
    try { await askText(t); } finally { setSending(false); }
  };

  const handleMicDown = async () => {
    if (isRecording || sending || !micConsent || capReached) return;
    try { await beginVoiceQuestion(); }
    catch (e) { console.error("Mic permission denied or unavailable:", e); }
  };

  const handleMicUp = async () => {
    if (!isRecording) return;
    setSending(true);
    try { await endVoiceQuestion(); } finally { setSending(false); }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        dir="rtl"
        className="fixed z-[70] bottom-4 right-0 flex items-center gap-2 pl-3 pr-2 py-2 rounded-l-2xl bg-primary text-primary-foreground shadow-2xl border border-primary/30 hover:bg-primary/90 transition-all"
        title="إظهار مرشد المنصّة"
        aria-label="إظهار مرشد المنصّة"
      >
        <ChevronLeft className="w-4 h-4" />
        <Sparkles className="w-4 h-4" />
        <span className="text-xs font-semibold">عبدالله</span>
      </button>
    );
  }

  return (
    <div
      className="fixed z-[70] bottom-0 right-0 left-0 sm:bottom-4 sm:right-4 sm:left-auto sm:w-[min(400px,calc(100vw-2rem))]"
      dir="rtl"
    >
      {showActEndPrompt && actEndLabel && (
        <div className="mx-2 mb-2 sm:mx-0 px-3 py-2 rounded-xl bg-secondary/15 border border-secondary/30 text-xs text-center text-secondary-foreground font-medium">
          انتهى {actEndLabel} — تقدر تستأنف، تسأل، أو تتجاوز للقادم
        </div>
      )}
      <Card className="rounded-t-2xl sm:rounded-2xl shadow-2xl border-2 border-primary/20 bg-card/95 backdrop-blur-md p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">عبدالله</p>
            <p className="text-[11px] text-muted-foreground">
              مرشد المنصّة · {stepIndex + 1} / {totalSteps}
              {qaCount > 0 && <span className="mx-1">· {qaCount}/{qaCap} سؤال</span>}
            </p>
          </div>
          <Waveform active={isSpeaking} />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCollapsed(true)}
            title="إخفاء"
            aria-label="إخفاء مرشد المنصّة"
            className="shrink-0 h-7 w-7"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-foreground/85 leading-relaxed max-h-32 overflow-y-auto">
          {displayText}
        </p>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitText(); }}
            placeholder={capReached ? "وصلت للحدّ الأقصى من الأسئلة" : "اكتب سؤالك…"}
            disabled={sending || isRecording || capReached}
            className="flex-1 min-w-0 text-xs px-3 py-2 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          <Button size="icon" variant="ghost" onClick={submitText}
            disabled={!draft.trim() || sending || capReached} title="إرسال"
            className="shrink-0 h-9 w-9">
            <Send className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={isRecording ? "default" : "ghost"}
            onMouseDown={handleMicDown}
            onMouseUp={handleMicUp}
            onMouseLeave={handleMicUp}
            onTouchStart={handleMicDown}
            onTouchEnd={handleMicUp}
            disabled={sending || !micConsent || capReached}
            title={!micConsent ? "فعّل إذن الميكروفون من صفحة البداية" : isRecording ? "تسجيل…" : "اضغط مع الاستمرار للسؤال صوتياً"}
            className={`shrink-0 h-9 w-9 ${isRecording ? "animate-pulse" : ""}`}
          >
            {micConsent ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
        </div>

        <DemoControls />
      </Card>
    </div>
  );
}
