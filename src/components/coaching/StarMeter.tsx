import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StarElement {
  covered: boolean;
  evidence: string | null;
  score: number;
}

export interface StarCoverage {
  situation: StarElement;
  task: StarElement;
  action: StarElement;
  result: StarElement;
  overall_coverage: number;
}

interface StarMeterProps {
  coverage: StarCoverage;
  compact?: boolean;
}

const ELEMENTS: { key: keyof Omit<StarCoverage, "overall_coverage">; label: string; letter: string }[] = [
  { key: "situation", label: "الموقف", letter: "S" },
  { key: "task", label: "المهمّة", letter: "T" },
  { key: "action", label: "الإجراء", letter: "A" },
  { key: "result", label: "النتيجة", letter: "R" },
];

const StarMeter = ({ coverage, compact = false }: StarMeterProps) => {
  if (!coverage) return null;

  return (
    <div className="space-y-3" dir="rtl">
      {!compact && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">تغطية STAR</span>
          <span className="text-sm text-muted-foreground">
            {Math.round((coverage.overall_coverage ?? 0) * 100)}%
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {ELEMENTS.map(({ key, label, letter }) => {
          const el = coverage[key];
          const score = Math.round((el?.score ?? 0) * 100);
          const ok = el?.covered;
          return (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2",
                  ok
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted border-muted-foreground/30 text-muted-foreground"
                )}
                title={el?.evidence ?? "لم يُذكر"}
              >
                {letter}
              </div>
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <Progress
                value={score}
                className={cn(
                  "h-1.5 w-full",
                  !ok && "opacity-40"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StarMeter;
