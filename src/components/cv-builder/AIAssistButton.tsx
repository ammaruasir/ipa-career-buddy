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

// =============================================================================
// AIAssistSummary — wraps improve-cv-summary edge function with same UX pattern
// =============================================================================

interface SummaryResult {
  ar?: { improved: string; sentence_count: number; justifications: Justification[] };
  en?: { improved: string; sentence_count: number; justifications: Justification[] };
}

interface AIAssistSummaryProps {
  currentSummary: string;
  fullProfile: any;
  targetRole?: string;
  language: Language;
  onAccept: (text: string, lang: "ar" | "en") => void;
}

export const AIAssistSummary = ({
  currentSummary,
  fullProfile,
  targetRole,
  language,
  onAccept,
}: AIAssistSummaryProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("improve-cv-summary", {
        body: {
          current_summary: currentSummary,
          full_profile: fullProfile,
          target_role: targetRole,
          language,
        },
      });
      if (error) throw error;
      setResult(data);
    } catch (e) {
      console.error(e);
      toast.error(language === "en" ? "Generation failed" : "فشل التوليد");
    } finally {
      setLoading(false);
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
            {language === "en" ? "AI is improving..." : "AI يحسّن..."}
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 ml-2" />
            {currentSummary ? (language === "en" ? "Improve with AI" : "حسّن بـ AI") : (language === "en" ? "Generate summary" : "ولّد ملخّصاً")}
          </>
        )}
      </Button>

      {result && (
        <Card className="border-primary/30 bg-primary/5 rounded-xl">
          <CardContent className="p-4 space-y-4">
            {result.ar && (
              <div className="space-y-2" dir="rtl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">اقتراح بالعربية</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAccept(result.ar!.improved, "ar")}
                    className="rounded-lg"
                  >
                    <Check className="w-3.5 h-3.5 ml-1.5" />
                    استخدم
                  </Button>
                </div>
                <p className="text-sm text-foreground p-3 rounded-lg bg-background leading-relaxed">
                  {result.ar.improved}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.ar.sentence_count} جمل
                </p>
              </div>
            )}

            {result.en && (
              <div className="space-y-2" dir="ltr">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">English suggestion</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAccept(result.en!.improved, "en")}
                    className="rounded-lg"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Use
                  </Button>
                </div>
                <p className="text-sm text-foreground p-3 rounded-lg bg-background leading-relaxed">
                  {result.en.improved}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.en.sentence_count} sentences
                </p>
              </div>
            )}

            {((result.ar?.justifications?.length ?? 0) + (result.en?.justifications?.length ?? 0)) > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground">
                  {language === "en" ? "Why?" : "لماذا؟"}
                </p>
                {(result.ar?.justifications ?? result.en?.justifications ?? []).map((j, idx) => (
                  <JustificationCard key={idx} justification={j} language={language === "en" ? "en" : "ar"} />
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={generate} className="text-xs">
                <RefreshCw className="w-3 h-3 ml-1" />
                {language === "en" ? "Regenerate" : "أعد"}
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

// =============================================================================
// AIAssistSkills — wraps suggest-cv-skills edge function
// =============================================================================

interface SkillItem {
  name: string;
  proficiency?: string;
  rationale: string;
}

interface SkillsResult {
  ar?: {
    technical: SkillItem[];
    soft: SkillItem[];
    languages: SkillItem[];
    justifications: Justification[];
  };
  en?: {
    technical: SkillItem[];
    soft: SkillItem[];
    languages: SkillItem[];
    justifications: Justification[];
  };
  gaps?: string[];
}

interface AIAssistSkillsProps {
  experience: any[];
  education: any[];
  targetRole?: string;
  language: Language;
  onAccept: (skills: { technical?: string[]; soft?: string[]; languages?: string[] }) => void;
}

export const AIAssistSkills = ({
  experience,
  education,
  targetRole,
  language,
  onAccept,
}: AIAssistSkillsProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkillsResult | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  const generate = async () => {
    setLoading(true);
    setResult(null);
    setAccepted({});
    try {
      const { data, error } = await supabase.functions.invoke("suggest-cv-skills", {
        body: { experience, education, target_role: targetRole, language },
      });
      if (error) throw error;
      setResult(data);
    } catch (e) {
      console.error(e);
      toast.error(language === "en" ? "Generation failed" : "فشل التوليد");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => setAccepted((s) => ({ ...s, [key]: !s[key] }));

  const acceptSelected = () => {
    const block = language === "en" ? result?.en : result?.ar;
    if (!block) return;
    const pick = (cat: "technical" | "soft" | "languages") =>
      (block[cat] ?? [])
        .filter((s, i) => accepted[`${cat}-${i}`])
        .map((s) => s.name);
    onAccept({ technical: pick("technical"), soft: pick("soft"), languages: pick("languages") });
    const total = Object.values(accepted).filter(Boolean).length;
    toast.success(language === "en" ? `Added ${total} skill(s)` : `أُضيفت ${total} مهارات`);
    setResult(null);
    setAccepted({});
  };

  const renderGroup = (label: string, cat: "technical" | "soft" | "languages") => {
    const block = language === "en" ? result?.en : result?.ar;
    const items = block?.[cat] ?? [];
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {items.map((s, i) => {
          const k = `${cat}-${i}`;
          return (
            <label
              key={k}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-background cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!accepted[k]}
                onChange={() => toggle(k)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-medium text-foreground">
                  {s.name}
                  {s.proficiency && (
                    <span className="text-xs text-muted-foreground font-normal mr-2">
                      ({s.proficiency})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                  {s.rationale}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    );
  };

  const groupLabel = (key: "technical" | "soft" | "languages") => {
    const labels = {
      ar: { technical: "مهارات تقنية", soft: "مهارات شخصية", languages: "لغات" },
      en: { technical: "Technical", soft: "Soft skills", languages: "Languages" },
    };
    return labels[language === "en" ? "en" : "ar"][key];
  };

  const dir = language === "en" ? "ltr" : "rtl";

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={loading || (experience.length === 0 && education.length === 0)}
        className="rounded-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 ml-2 animate-spin" />
            {language === "en" ? "Suggesting..." : "AI يقترح..."}
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 ml-2" />
            {language === "en" ? "Suggest skills" : "اقترح مهارات"}
          </>
        )}
      </Button>

      {(experience.length === 0 && education.length === 0) && (
        <p className="text-xs text-muted-foreground">
          {language === "en"
            ? "Fill in experience or education first."
            : "املأ الخبرة أو التعليم أولاً."}
        </p>
      )}

      {result && (
        <Card className="border-primary/30 bg-primary/5 rounded-xl" dir={dir}>
          <CardContent className="p-4 space-y-4">
            {renderGroup(groupLabel("technical"), "technical")}
            {renderGroup(groupLabel("soft"), "soft")}
            {renderGroup(groupLabel("languages"), "languages")}

            {result.gaps && result.gaps.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">
                  {language === "en" ? "Skills you may need:" : "مهارات قد تحتاجها:"}
                </p>
                <ul className="text-xs text-foreground space-y-0.5">
                  {result.gaps.map((g, i) => (
                    <li key={i}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              <Button size="sm" onClick={acceptSelected} className="rounded-lg">
                <Check className="w-3.5 h-3.5 ml-1.5" />
                {language === "en" ? "Add selected" : "أضف المحدّد"}
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
