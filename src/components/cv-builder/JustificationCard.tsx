import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, AlertTriangle, AlertCircle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Justification {
  observation: string;
  rule: string;
  why_it_matters: string;
  example_better: string;
  severity: "info" | "warning" | "important";
}

interface JustificationCardProps {
  justification: Justification;
  language?: "ar" | "en";
}

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    text: "text-blue-700 dark:text-blue-300",
    label_ar: "معلومة",
    label_en: "Info",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    text: "text-amber-700 dark:text-amber-300",
    label_ar: "تنبيه",
    label_en: "Warning",
  },
  important: {
    icon: AlertCircle,
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    text: "text-red-700 dark:text-red-300",
    label_ar: "مهمّ",
    label_en: "Important",
  },
};

const LABELS = {
  ar: {
    observation: "الملاحظة",
    rule: "القاعدة",
    why: "لماذا",
    better: "مثال أفضل",
  },
  en: {
    observation: "Observation",
    rule: "Rule",
    why: "Why it matters",
    better: "Better example",
  },
};

const JustificationCard = ({ justification: j, language = "ar" }: JustificationCardProps) => {
  const cfg = SEVERITY_CONFIG[j.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  const labels = LABELS[language];
  const dir = language === "ar" ? "rtl" : "ltr";

  return (
    <Card className={cn("rounded-xl", cfg.border, cfg.bg)}>
      <CardContent className="p-4" dir={dir}>
        <div className="flex items-center justify-between mb-3">
          <div className={cn("flex items-center gap-2", cfg.text)}>
            <Icon className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {language === "ar" ? cfg.label_ar : cfg.label_en}
            </span>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            <BookOpen className="w-3 h-3 me-1" />
            {j.rule}
          </Badge>
        </div>

        <div className="space-y-2.5 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{labels.observation}:</p>
            <p className="text-foreground">{j.observation}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{labels.why}:</p>
            <p className="text-foreground leading-relaxed">{j.why_it_matters}</p>
          </div>

          {j.example_better && (
            <div className="rounded-lg bg-card border border-border p-2.5 mt-2">
              <p className="text-xs text-muted-foreground mb-0.5">{labels.better}:</p>
              <p className="text-foreground" dir={dir}>
                {j.example_better}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default JustificationCard;
