import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Check, X, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import JustificationCard, { type Justification } from "./JustificationCard";
import { toast } from "sonner";

type Language = "ar" | "en" | "bilingual";

interface BulletResult {
  ar?: { bullets: string[]; justifications: Justification[] };
  en?: { bullets: string[]; justifications: Justification[] };
  missing_information?: string[];
}

interface AIAssistBulletsProps {
  role: string;
  rawDescription: string;
  language: Language;
  onAccept: (bullets: string[], language: "ar" | "en") => void;
}

export const AIAssistBullets = ({
  role,
  rawDescription,
  language,
  onAccept,
}: AIAssistBulletsProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulletResult | null>(null);
  const [selectedAr, setSelectedAr] = useState<Set<number>>(new Set());
  const [selectedEn, setSelectedEn] = useState<Set<number>>(new Set());

  const generate = async () => {
    if (rawDescription.trim().length < 10) {
      toast.error(
        language === "en"
          ? "Description too short — write at least 10 characters."
          : "الوصف قصير جداً — اكتب على الأقل ١٠ أحرف.",
      );
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cv-bullets", {
        body: {
          role,
          raw_description: rawDescription,
          language,
        },
      });
      if (error) throw error;
      setResult(data);
      setSelectedAr(new Set((data.ar?.bullets ?? []).map((_: any, i: number) => i)));
      setSelectedEn(new Set((data.en?.bullets ?? []).map((_: any, i: number) => i)));
    } catch (e) {
      console.error(e);
      toast.error(language === "en" ? "Generation failed" : "فشل التوليد");
    } finally {
      setLoading(false);
    }
  };

  const toggleAr = (i: number) => {
    const s = new Set(selectedAr);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelectedAr(s);
  };
  const toggleEn = (i: number) => {
    const s = new Set(selectedEn);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelectedEn(s);
  };

  const acceptAr = () => {
    const bullets = (result?.ar?.bullets ?? []).filter((_, i) => selectedAr.has(i));
    if (bullets.length > 0) {
      onAccept(bullets, "ar");
      toast.success(`أُضيفت ${bullets.length} نقاط`);
    }
  };
  const acceptEn = () => {
    const bullets = (result?.en?.bullets ?? []).filter((_, i) => selectedEn.has(i));
    if (bullets.length > 0) {
      onAccept(bullets, "en");
      toast.success(`Added ${bullets.length} bullet(s)`);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={loading}
        className="rounded-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 ml-2 animate-spin" />
            {language === "en" ? "AI is drafting..." : "AI يكتب..."}
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 ml-2" />
            {language === "en" ? "Convert to STAR bullets" : "حوّل لنقاط STAR"}
          </>
        )}
      </Button>

      {result && (
        <Card className="border-primary/30 bg-primary/5 rounded-xl">
          <CardContent className="p-4 space-y-4">
            {/* Arabic bullets */}
            {result.ar && result.ar.bullets.length > 0 && (
              <div className="space-y-2" dir="rtl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    اقتراح بالعربية
                  </p>
                  <Button size="sm" variant="outline" onClick={acceptAr} className="rounded-lg">
                    <Check className="w-3.5 h-3.5 ml-1.5" />
                    إضافة المحدّد
                  </Button>
                </div>
                {result.ar.bullets.map((b, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-background cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAr.has(i)}
                      onChange={() => toggleAr(i)}
                      className="mt-1"
                    />
                    <span className="text-sm text-foreground flex-1">{b}</span>
                  </label>
                ))}
              </div>
            )}

            {/* English bullets */}
            {result.en && result.en.bullets.length > 0 && (
              <div className="space-y-2" dir="ltr">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    English suggestion
                  </p>
                  <Button size="sm" variant="outline" onClick={acceptEn} className="rounded-lg">
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Add selected
                  </Button>
                </div>
                {result.en.bullets.map((b, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-background cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEn.has(i)}
                      onChange={() => toggleEn(i)}
                      className="mt-1"
                    />
                    <span className="text-sm text-foreground flex-1">{b}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Justifications */}
            {(result.ar?.justifications?.length ?? result.en?.justifications?.length ?? 0) > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground">
                  {language === "en" ? "Why these phrasings?" : "لماذا هذه الصياغة؟"}
                </p>
                {(result.ar?.justifications ?? result.en?.justifications ?? []).map((j, idx) => (
                  <JustificationCard
                    key={idx}
                    justification={j}
                    language={language === "en" ? "en" : "ar"}
                  />
                ))}
              </div>
            )}

            {/* Missing info */}
            {result.missing_information && result.missing_information.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">
                  {language === "en"
                    ? "Add these for stronger bullets:"
                    : "أضف هذه لنقاط أقوى:"}
                </p>
                <ul className="text-xs text-foreground space-y-0.5">
                  {result.missing_information.map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={generate} className="text-xs">
                <RefreshCw className="w-3 h-3 ml-1" />
                {language === "en" ? "Regenerate" : "أعد التوليد"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setResult(null)} className="text-xs">
                <X className="w-3 h-3 ml-1" />
                {language === "en" ? "Dismiss" : "تجاهل"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
