import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GraduationCap, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import StarMeter, { type StarCoverage } from "./StarMeter";
import RewriteComparison from "./RewriteComparison";
import ExemplarAnswer from "./ExemplarAnswer";
import FillerWordsList from "./FillerWordsList";

interface CoachingPayload {
  star: StarCoverage;
  filler_words?: { word: string; count: number }[];
  rewrite?: string;
  exemplar?: string;
  model?: string;
  tokens_used?: number | null;
}

interface ResponseWithCoaching {
  id: string;
  question_text: string;
  answer_text: string | null;
  coaching: CoachingPayload | null;
  coached_at: string | null;
}

interface CoachingSectionProps {
  interviewId: string;
  /** Whether the parent interview was a practice session — coaching is auto-triggered for practice. */
  practice?: boolean;
}

const CoachingSection = ({ interviewId, practice = false }: CoachingSectionProps) => {
  const [responses, setResponses] = useState<ResponseWithCoaching[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("responses")
      .select("id, question_text, answer_text, coaching, coached_at")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setResponses(data as unknown as ResponseWithCoaching[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (interviewId) load();
  }, [interviewId]);

  const triggerCoaching = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("coach-response", {
        body: { interview_id: interviewId },
      });
      if (error) {
        console.error("Failed to trigger coaching:", error);
      }
      // Audit #18: poll with exponential backoff until all coached or 5 attempts.
      // Delays: 2s, 4s, 8s, 16s, 30s (cumulative ~60s).
      const delays = [2000, 4000, 8000, 16000, 30000];
      for (const delay of delays) {
        await new Promise((r) => setTimeout(r, delay));
        const { data } = await supabase
          .from("responses")
          .select("id, question_text, answer_text, coaching, coached_at")
          .eq("interview_id", interviewId)
          .order("created_at", { ascending: true });
        if (data) {
          const rows = data as unknown as ResponseWithCoaching[];
          setResponses(rows);
          const allDone = rows.length > 0 && rows.every((r) => r.coaching);
          if (allDone) break;
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-lg">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (responses.length === 0) return null;

  const coachedCount = responses.filter((r) => r.coaching).length;
  const allCoached = coachedCount === responses.length;

  return (
    <Card className="rounded-2xl shadow-lg" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            تغذية راجعة لكل إجابة
            <Badge variant="secondary" className="font-normal text-xs">
              {coachedCount}/{responses.length}
            </Badge>
          </CardTitle>

          {!allCoached && (
            <Button
              size="sm"
              variant="outline"
              onClick={triggerCoaching}
              disabled={generating}
              className="rounded-xl"
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin ml-2" />
                  جارٍ التحليل...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 ml-2" />
                  توليد التغذية الراجعة
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Accordion type="multiple" className="space-y-2">
          {responses.map((r, idx) => {
            const coverage = r.coaching?.star?.overall_coverage ?? 0;
            const coveragePct = Math.round(coverage * 100);
            const badgeColor =
              coveragePct >= 75
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : coveragePct >= 50
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : r.coaching
                ? "bg-red-500/15 text-red-700 dark:text-red-400"
                : "bg-muted text-muted-foreground";

            return (
              <AccordionItem
                key={r.id}
                value={r.id}
                className="border rounded-xl px-4 data-[state=open]:bg-muted/30"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center justify-between w-full gap-3 text-right">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="shrink-0">السؤال {idx + 1}</Badge>
                      <span className="text-sm text-foreground line-clamp-1">
                        {r.question_text}
                      </span>
                    </div>
                    <Badge className={cn("shrink-0 text-xs", badgeColor)}>
                      {r.coaching ? `STAR ${coveragePct}%` : "بانتظار التحليل"}
                    </Badge>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="space-y-5 pt-2 pb-4">
                  {!r.coaching ? (
                    <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/40">
                      لم يتمّ تحليل هذه الإجابة بعد.
                      {practice && " اضغط زرّ التوليد أعلاه لتشغيل الكوتشينج."}
                    </div>
                  ) : (
                    <>
                      <StarMeter coverage={r.coaching.star} />

                      {r.coaching.filler_words && r.coaching.filler_words.length > 0 && (
                        <FillerWordsList words={r.coaching.filler_words} />
                      )}

                      {r.coaching.rewrite && (
                        <RewriteComparison
                          original={r.answer_text || ""}
                          rewrite={r.coaching.rewrite}
                        />
                      )}

                      {r.coaching.exemplar && (
                        <ExemplarAnswer text={r.coaching.exemplar} />
                      )}
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default CoachingSection;
