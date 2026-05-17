import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";

interface RewriteComparisonProps {
  original: string;
  rewrite: string;
}

const RewriteComparison = ({ original, rewrite }: RewriteComparisonProps) => {
  if (!rewrite) return null;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ArrowLeftRight className="w-4 h-4 text-primary" />
        مقارنة: إجابتك مقابل النسخة المحسّنة
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border-muted-foreground/20 bg-muted/30">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              إجابتك
            </div>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {original || <span className="italic text-muted-foreground">(لا توجد إجابة نصية)</span>}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              نسخة محسّنة
            </div>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {rewrite}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RewriteComparison;
