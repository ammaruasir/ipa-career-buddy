import { Card } from "@/components/ui/card";
import { User } from "lucide-react";

type Props = {
  visible: boolean;
  state: "thinking" | "answering" | "idle";
};

export function CandidateBadge({ visible, state }: Props) {
  if (!visible) return null;
  const labels: Record<Props["state"], string> = {
    thinking: "سعد يفكّر…",
    answering: "سعد يجيب",
    idle: "سعد",
  };
  return (
    <Card
      dir="rtl"
      className="fixed bottom-4 left-4 z-[70] rounded-2xl shadow-2xl border-2 border-secondary/30 bg-card/95 backdrop-blur-md p-3 flex items-center gap-2.5"
    >
      <div
        className={`w-9 h-9 rounded-full bg-secondary/15 flex items-center justify-center shrink-0 ${
          state === "answering" ? "ring-2 ring-secondary animate-pulse" : ""
        }`}
      >
        <User className="w-4 h-4 text-secondary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight">سعد الراشد</p>
        <p className="text-[11px] text-muted-foreground">{labels[state]}</p>
      </div>
    </Card>
  );
}
