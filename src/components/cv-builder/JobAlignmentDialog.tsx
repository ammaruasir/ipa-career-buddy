import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Target, Sparkles, Check, X, AlertCircle, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JustificationCard, { type Justification } from "./JustificationCard";
import { cn } from "@/lib/utils";

interface BulletRewrite {
  original: string;
  rewritten: string;
  reason: string;
}

interface AlignmentResult {
  alignment_score: number;
  matching_keywords: string[];
  missing_keywords: string[];
  bullet_rewrites: BulletRewrite[];
  justifications: Justification[];
}

interface JobAlignmentDialogProps {
  draftId: string | undefined;
  language: "ar" | "en" | "bilingual";
  /** Called with rewrite when user accepts a suggested bullet replacement. */
  onAcceptRewrite?: (rewrite: BulletRewrite) => void;
}

const JobAlignmentDialog = ({ draftId, language, onAcceptRewrite }: JobAlignmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AlignmentResult | null>(null);

  const lang: "ar" | "en" = language === "en" ? "en" : "ar";
  const t = lang === "ar"
    ? {
        button: "طابق مع وظيفة",
        title: "مطابقة سيرتك مع وصف وظيفي",
        intro: "الصق وصف الوظيفة المستهدفة. AI سيحلّل التوافق ويقترح تحسينات.",
        jdLabel: "الوصف الوظيفي",
        analyze: "حلّل التوافق",
        analyzing: "جارٍ التحليل...",
        score: "درجة التوافق",
        matching: "كلمات متطابقة",
        missing: "كلمات مفقودة (أضفها لرفع التوافق)",
        rewrites: "إعادة كتابة مقترحة",
        original: "الأصلي",
        suggested: "المقترَح",
        why: "لماذا",
        apply: "طبّق",
        reset: "تحليل جديد",
        close: "إغلاق",
        noDraft: "احفظ مسوّدتك أوّلاً",
      }
    : {
        button: "Tailor to job",
        title: "Match your CV with a job description",
        intro: "Paste the target job description. AI will analyze alignment and suggest improvements.",
        jdLabel: "Job description",
        analyze: "Analyze alignment",
        analyzing: "Analyzing...",
        score: "Alignment score",
        matching: "Matching keywords",
        missing: "Missing keywords (add for better match)",
        rewrites: "Suggested rewrites",
        original: "Original",
        suggested: "Suggested",
        why: "Why",
        apply: "Apply",
        reset: "New analysis",
        close: "Close",
        noDraft: "Save your draft first",
      };

  const dir = lang === "ar" ? "rtl" : "ltr";

  const analyze = async () => {
    if (!draftId) {
      toast.error(t.noDraft);
      return;
    }
    if (jd.trim().length < 50) {
      toast.error(lang === "ar" ? "الصق وصفاً وظيفياً أطول" : "Paste a longer JD");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("cv-job-alignment", {
        body: {
          draft_id: draftId,
          job_description: jd,
          language,
        },
      });
      if (error) throw error;
      setResult(data);
    } catch (e) {
      console.error(e);
      toast.error(lang === "ar" ? "فشل التحليل" : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor =
    !result ? "text-foreground"
    : result.alignment_score >= 75 ? "text-emerald-600"
    : result.alignment_score >= 50 ? "text-amber-600"
    : "text-red-600";

  const scoreBgRing =
    !result ? "stroke-muted"
    : result.alignment_score >= 75 ? "stroke-emerald-500"
    : result.alignment_score >= 50 ? "stroke-amber-500"
    : "stroke-red-500";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-tour="job-align" variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Target className="w-3.5 h-3.5" />
          {t.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.intro}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-4 py-2">
            {/* Input */}
            <div className="space-y-2">
              <Label htmlFor="jd">{t.jdLabel}</Label>
              <Textarea
                id="jd"
                data-tour="job-align-jd"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder={lang === "ar"
                  ? "مثال: نبحث عن محلّل سياسات مع خبرة 5 سنوات في القطاع الحكومي..."
                  : "Example: We're looking for a policy analyst with 5 years in public sector..."}
                rows={6}
                dir={dir}
              />
              <Button
                data-tour="job-align-analyze"
                onClick={analyze}
                disabled={loading || !draftId}
                className="w-full rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    {t.analyzing}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 ml-2" />
                    {result ? t.reset : t.analyze}
                  </>
                )}
              </Button>
            </div>

            {/* Result */}
            {result && (
              <div className="space-y-4">
                {/* Score gauge */}
                <Card className="rounded-2xl">
                  <CardContent className="p-5 flex items-center gap-5">
                    <div className="relative w-24 h-24 shrink-0">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="40" fill="none" className="stroke-muted" strokeWidth="8" />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          fill="none"
                          className={scoreBgRing}
                          strokeWidth="8"
                          strokeDasharray={`${(result.alignment_score / 100) * 251.33} 251.33`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={cn("text-2xl font-bold", scoreColor)}>
                          {result.alignment_score}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{t.score}</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        {result.alignment_score >= 75
                          ? lang === "ar" ? "توافق ممتاز" : "Excellent match"
                          : result.alignment_score >= 50
                          ? lang === "ar" ? "توافق متوسّط" : "Moderate match"
                          : lang === "ar" ? "توافق ضعيف" : "Weak match"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lang === "ar"
                          ? "اعمل على الكلمات المفقودة لرفع الدرجة"
                          : "Work on missing keywords to improve score"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Matching + Missing keywords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                        <Check className="w-4 h-4" />
                        <span className="text-xs font-semibold">{t.matching}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.matching_keywords.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          result.matching_keywords.map((k, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[11px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
                            >
                              {k}
                            </Badge>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-semibold">{t.missing}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.missing_keywords.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          result.missing_keywords.map((k, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[11px] bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30"
                            >
                              {k}
                            </Badge>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bullet rewrites */}
                {result.bullet_rewrites.length > 0 && (
                  <Card className="rounded-xl">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <ArrowLeftRight className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">{t.rewrites}</span>
                      </div>
                      {result.bullet_rewrites.map((rw, i) => (
                        <div key={i} className="space-y-1.5 p-3 rounded-lg bg-muted/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                                {t.original}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">{rw.original}</p>
                            </div>
                            <div className="rounded-md p-2 bg-emerald-500/10 border border-emerald-500/30">
                              <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-0.5">
                                {t.suggested}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">{rw.rewritten}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 pt-1.5 border-t border-border">
                            <div className="flex-1 text-xs text-muted-foreground leading-snug">
                              <span className="font-semibold">{t.why}:</span> {rw.reason}
                            </div>
                            {onAcceptRewrite && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAcceptRewrite(rw)}
                                className="rounded-lg shrink-0"
                              >
                                <Check className="w-3 h-3 ml-1" />
                                {t.apply}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Justifications */}
                {result.justifications.length > 0 && (
                  <div className="space-y-2">
                    {result.justifications.map((j, idx) => (
                      <JustificationCard key={idx} justification={j} language={lang} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            <X className="w-3.5 h-3.5 ml-1.5" />
            {t.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobAlignmentDialog;
