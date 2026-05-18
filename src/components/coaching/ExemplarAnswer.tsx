import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, ChevronDown, Info } from "lucide-react";
import { useState } from "react";

interface ExemplarAnswerProps {
  text: string;
}

const ExemplarAnswer = ({ text }: ExemplarAnswerProps) => {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} dir="rtl">
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 transition-colors border border-amber-500/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
            <Sparkles className="w-4 h-4" />
            عرض إجابة نموذجية
          </div>
          <ChevronDown
            className={`w-4 h-4 text-amber-700 dark:text-amber-300 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        <div className="p-4 rounded-lg bg-card border border-amber-500/20">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {text}
          </p>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            هذه إجابة مرجعية واحدة من إجابات قوية ممكنة. هدفها إلهام الأسلوب، لا الحفظ والتكرار.
          </span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ExemplarAnswer;
