import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lightbulb,
  MessagesSquare,
  CheckCircle2,
  SkipForward,
  Home,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfilePrefill } from "@/hooks/useProfilePrefill";

interface QuestionChoice {
  value: string;
  label_ar: string;
  label_en: string;
}

interface SubFieldDef {
  key: string;
  label_ar: string;
  label_en: string;
  type: "text" | "email" | "tel" | "url" | "date" | "textarea" | "choice";
  required?: boolean;
  placeholder_ar?: string;
  placeholder_en?: string;
  choices?: QuestionChoice[];
  span?: 1 | 2;
}

type QType =
  | "text"
  | "textarea"
  | "list_text"
  | "structured_list"
  | "choice"
  | "form"
  | "repeater"
  | "repeater_simple"
  | "chips";

interface Question {
  id: string;
  step: number;
  field: string;
  required: boolean;
  type: QType;
  choices?: QuestionChoice[];
  fields?: SubFieldDef[];
  item_label_ar?: string;
  item_label_en?: string;
  label_ar: string;
  label_en: string;
  hint_ar: string;
  hint_en: string;
}

const STRUCTURED_TYPES: QType[] = ["form", "repeater", "repeater_simple", "chips"];

function emptyStructuredFor(q: Question): any {
  if (q.type === "form") {
    const obj: Record<string, string> = {};
    (q.fields ?? []).forEach((f) => (obj[f.key] = ""));
    return obj;
  }
  if (q.type === "repeater") {
    const item: Record<string, string> = {};
    (q.fields ?? []).forEach((f) => (item[f.key] = ""));
    return [item];
  }
  if (q.type === "repeater_simple") return [""];
  if (q.type === "chips") return [];
  return null;
}

function isStructuredAnswerMeaningful(q: Question, val: any): boolean {
  if (val == null) return false;
  if (q.type === "form") {
    const required = (q.fields ?? []).filter((f) => f.required);
    return required.every((f) => String(val?.[f.key] ?? "").trim().length > 0);
  }
  if (q.type === "repeater") {
    if (!Array.isArray(val) || val.length === 0) return false;
    const required = (q.fields ?? []).filter((f) => f.required);
    return val.some((item) => required.every((f) => String(item?.[f.key] ?? "").trim().length > 0));
  }
  if (q.type === "repeater_simple") {
    return Array.isArray(val) && val.some((s) => String(s ?? "").trim().length > 0);
  }
  if (q.type === "chips") {
    return Array.isArray(val) && val.length > 0;
  }
  return false;
}

type Lang = "ar" | "en" | "bilingual";

const TEXT = {
  ar: {
    title: "إنشاء سيرة ذاتية من الصفر",
    intro:
      "سنطرح عليك ١٥ سؤالاً لبناء سيرة احترافية. كل سؤال يمكن أن يولّد AI اقتراحاً لمساعدتك.",
    chooseLang: "بأي لغة تريد البدء؟",
    arOnly: "العربية",
    enOnly: "English",
    both: "كلتا اللغتين",
    begin: "ابدأ المقابلة",
    next: "التالي",
    skip: "تخطّي",
    suggestAi: "اطلب اقتراح AI",
    suggesting: "AI يفكّر...",
    yourAnswer: "إجابتك",
    done: "اكتمل! جارٍ بناء سيرتك...",
    openBuilder: "فتح في منشئ السيرة",
    required: "هذا السؤال إلزامي",
    suggestionTitle: "اقتراح من AI (للإلهام، لست مضطرّاً للأخذ به)",
    useSuggestion: "استخدم هذا",
    progressLabel: "السؤال",
    of: "من",
  },
  en: {
    title: "Build a CV from Scratch",
    intro:
      "We'll ask 15 questions to build a professional CV. Each question can get an AI suggestion to help you.",
    chooseLang: "Which language to start with?",
    arOnly: "Arabic",
    enOnly: "English",
    both: "Both",
    begin: "Start interview",
    next: "Next",
    skip: "Skip",
    suggestAi: "Get AI suggestion",
    suggesting: "AI is thinking...",
    yourAnswer: "Your answer",
    done: "Done! Building your CV...",
    openBuilder: "Open in CV Builder",
    required: "This question is required",
    suggestionTitle: "AI suggestion (for inspiration, you don't have to use it)",
    useSuggestion: "Use this",
    progressLabel: "Question",
    of: "of",
  },
};

const CVInterview = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const prefill = useProfilePrefill();
  const [prefilled, setPrefilled] = useState(false);
  // When user navigates back, we restore their saved answer; suppress the prefill effect once.
  const skipPrefillOnceRef = useRef(false);

  // Pre-interview language picker
  const [language, setLanguage] = useState<Lang>("ar");
  const [started, setStarted] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(15);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [structuredAnswer, setStructuredAnswer] = useState<any>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const uiLang: "ar" | "en" = language === "en" ? "en" : "ar";
  const t = TEXT[uiLang];
  const dir = uiLang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  // Map a question field to a sensible default from the user's profile.
  const prefillFor = (q: Question | null): string => {
    if (!q || !prefill.loaded) return "";
    const pi = prefill.personal_info;
    switch (q.field) {
      case "personal_info.full_name":
        return pi.full_name ?? "";
      // target_role و target_industry: لا نعبّئها من التخصّص — يكتبها المستخدم بنفسه
      case "experience_level": {
        const yrs = prefill.experience_years ?? -1;
        if (yrs < 0 || !q.choices) return "";
        const wantedLabels =
          yrs === 0
            ? ["entry", "fresh", "graduate", "خريج", "مبتدئ"]
            : yrs <= 3
              ? ["junior", "1-3", "مبتدئ", "حديث"]
              : yrs <= 7
                ? ["mid", "intermediate", "4-7", "متوسط"]
                : ["senior", "lead", "expert", "خبير", "قيادي"];
        const match = q.choices.find((c) =>
          wantedLabels.some(
            (w) =>
              c.value?.toLowerCase().includes(w) ||
              c.label_ar?.includes(w) ||
              c.label_en?.toLowerCase().includes(w),
          ),
        );
        return match?.value ?? "";
      }
      default:
        return "";
    }
  };

  // Structured prefill from profile (returns null if not applicable)
  const prefillStructuredFor = (q: Question | null): any | null => {
    if (!q || !prefill.loaded) return null;
    const pi = prefill.personal_info;
    if (q.id === "contact") {
      return {
        email: pi.email ?? "",
        phone: pi.phone ?? "",
        city: (prefill as any).city ?? "",
        linkedin: "",
      };
    }
    if (q.id === "education" && prefill.education?.length) {
      return prefill.education.map((ed: any) => ({
        degree: ed.degree ?? "",
        major: ed.major ?? "",
        university: ed.institution ?? ed.university ?? "",
        year: ed.end ?? ed.year ?? "",
        gpa: ed.gpa ?? "",
      }));
    }
    return null;
  };

  // When a new question loads, pre-fill the answer from the profile when possible.
  useEffect(() => {
    if (!question) {
      setPrefilled(false);
      return;
    }
    // After "Previous question", the saved answer is already in state — don't overwrite it.
    if (skipPrefillOnceRef.current) {
      skipPrefillOnceRef.current = false;
      setPrefilled(false);
      return;
    }
    // Structured types
    if (STRUCTURED_TYPES.includes(question.type)) {
      const seed = prefillStructuredFor(question);
      if (seed && (Array.isArray(seed) ? seed.length > 0 : Object.values(seed).some((v) => v))) {
        setStructuredAnswer(seed);
        setPrefilled(true);
      } else {
        setStructuredAnswer(emptyStructuredFor(question));
        setPrefilled(false);
      }
      setAnswer("");
      return;
    }
    // Free text / choice
    setStructuredAnswer(null);
    const seed = prefillFor(question);
    if (seed) {
      setAnswer(seed);
      setPrefilled(true);
    } else {
      setAnswer("");
      setPrefilled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, prefill.loaded]);

  const startInterview = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cv-interview-step", {
        body: { action: "start", language },
      });
      if (error) throw error;
      setSessionId(data.session_id);
      setCurrentStep(data.current_step);
      setTotalSteps(data.total_steps);
      setQuestion(data.question);
      setStarted(true);
    } catch (e) {
      console.error(e);
      toast.error(uiLang === "en" ? "Failed to start session" : "فشل بدء الجلسة");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (opts: { withSuggestion?: boolean; skip?: boolean } = {}) => {
    if (!sessionId || !question) return;

    const isStructured = STRUCTURED_TYPES.includes(question.type);
    let finalAnswer: string;
    if (opts.skip) {
      finalAnswer = "";
    } else if (isStructured) {
      if (question.required && !isStructuredAnswerMeaningful(question, structuredAnswer)) {
        toast.error(t.required);
        return;
      }
      // Clean: drop empty items in repeaters
      let payload = structuredAnswer;
      if (question.type === "repeater") {
        payload = (Array.isArray(payload) ? payload : []).filter((item: any) =>
          Object.values(item ?? {}).some((v) => String(v ?? "").trim()),
        );
      } else if (question.type === "repeater_simple") {
        payload = (Array.isArray(payload) ? payload : []).map((s: any) => String(s ?? "").trim()).filter(Boolean);
      }
      finalAnswer = JSON.stringify(payload ?? (question.type === "form" ? {} : []));
    } else {
      finalAnswer = answer;
      if (question.required && !finalAnswer.trim()) {
        toast.error(t.required);
        return;
      }
    }

    setLoading(true);
    setSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke("cv-interview-step", {
        body: {
          action: "submit",
          session_id: sessionId,
          answer: finalAnswer,
          want_suggestion: !!opts.withSuggestion,
          language,
        },
      });
      if (error) throw error;

      if (data.done) {
        // Auto-finalize
        await finalize();
        return;
      }

      setCurrentStep(data.current_step);
      setQuestion(data.question);
      setSuggestion(data.suggestion);
      setAnswer("");
      setStructuredAnswer(null);
    } catch (e) {
      console.error(e);
      toast.error(uiLang === "en" ? "Failed to save answer" : "فشل حفظ الإجابة");
    } finally {
      setLoading(false);
    }
  };

  const goBack = async () => {
    if (!sessionId || currentStep <= 0 || loading) return;
    setLoading(true);
    setSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke("cv-interview-step", {
        body: { action: "back", session_id: sessionId, language },
      });
      if (error) throw error;
      // Mark that the next prefill effect should NOT overwrite the restored answer
      skipPrefillOnceRef.current = true;
      const prevQ: Question | null = data.question;
      const raw = data.previous_answer ?? "";
      if (prevQ && STRUCTURED_TYPES.includes(prevQ.type)) {
        // Try to parse structured JSON
        let parsed: any = null;
        if (typeof raw === "string" && raw.trim().startsWith(prevQ.type === "form" ? "{" : "[")) {
          try { parsed = JSON.parse(raw); } catch { parsed = null; }
        }
        if (parsed == null) parsed = emptyStructuredFor(prevQ);
        // Ensure repeater has at least one row for editing
        if (prevQ.type === "repeater" && (!Array.isArray(parsed) || parsed.length === 0)) {
          parsed = emptyStructuredFor(prevQ);
        }
        if (prevQ.type === "repeater_simple" && (!Array.isArray(parsed) || parsed.length === 0)) {
          parsed = [""];
        }
        setStructuredAnswer(parsed);
        setAnswer("");
      } else {
        setStructuredAnswer(null);
        setAnswer(typeof raw === "string" ? raw : "");
      }
      setCurrentStep(data.current_step);
      setQuestion(prevQ);
    } catch (e) {
      console.error(e);
      toast.error(uiLang === "en" ? "Failed to go back" : "تعذّر الرجوع");
    } finally {
      setLoading(false);
    }
  };

  const askSuggestion = async () => {
    if (!sessionId || !question) return;
    setSuggesting(true);
    try {
      // We trigger a suggestion by submitting a dummy "regenerate" — actually we need
      // a separate endpoint. For simplicity we ask submit endpoint to re-yield current Q.
      // Instead, call AI directly by re-fetching with want_suggestion=true on next step.
      // Workaround: do a no-op submit with empty answer if non-required? Not ideal.
      // Cleanest path: separate endpoint. For now, get a contextual hint client-side:
      const { data, error } = await supabase.functions.invoke("improve-cv-summary", {
        body: {
          current_summary: "",
          full_profile: { question: question.label_ar },
          target_role: "",
          language: uiLang,
        },
      });
      if (error) throw error;
      const text = uiLang === "en" ? data.en?.improved : data.ar?.improved;
      setSuggestion(text ?? null);
    } catch (e) {
      console.warn("suggestion error:", e);
      toast.error(uiLang === "en" ? "Could not generate suggestion" : "تعذّر توليد الاقتراح");
    } finally {
      setSuggesting(false);
    }
  };

  const finalize = async () => {
    if (!sessionId) return;
    setFinalizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("cv-interview-step", {
        body: { action: "finalize", session_id: sessionId, language },
      });
      if (error) throw error;
      setCompleted(true);
      toast.success(uiLang === "en" ? "CV draft created!" : "تم إنشاء مسوّدة السيرة!");
      // Navigate to CV builder after a short pause
      setTimeout(() => navigate("/cv/builder"), 1500);
    } catch (e) {
      console.error(e);
      toast.error(uiLang === "en" ? "Failed to build CV" : "فشل بناء السيرة");
    } finally {
      setFinalizing(false);
    }
  };

  // Pre-interview gate
  if (!started) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <div className="container mx-auto px-4 py-10 max-w-2xl space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="rounded-xl">
            {dir === "rtl" ? <ArrowRight className="w-4 h-4 ml-1.5" /> : <ArrowLeft className="w-4 h-4 mr-1.5" />}
            {uiLang === "en" ? "Back to home" : "العودة للرئيسية"}
          </Button>
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center">
                <MessagesSquare className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">{t.title}</CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.intro}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t.chooseLang}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["ar", "en", "bilingual"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLanguage(l)}
                      className={cn(
                        "px-3 py-2 rounded-xl border-2 text-sm transition-all",
                        language === l
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {l === "ar" ? t.arOnly : l === "en" ? t.enOnly : t.both}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={startInterview}
                disabled={loading}
                className="w-full rounded-xl"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 ml-2" />
                )}
                {t.begin}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Completion screen
  if (completed || finalizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir={dir}>
        <Card className="rounded-2xl shadow-lg max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            {finalizing ? (
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
            )}
            <h2 className="text-xl font-bold text-foreground">{t.done}</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active interview
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="rounded-xl -mb-2">
          {dir === "rtl" ? <ArrowRight className="w-4 h-4 ml-1.5" /> : <ArrowLeft className="w-4 h-4 mr-1.5" />}
          {uiLang === "en" ? "Back to home" : "العودة للرئيسية"}
        </Button>
        {/* Progress */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t.progressLabel} {currentStep + 1} {t.of} {totalSteps}
              </span>
              <Badge variant="outline" className="font-normal">
                {Math.round(progress)}%
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Question card */}
        {question && (
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">
                  {uiLang === "en" ? question.label_en : question.label_ar}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  {uiLang === "en" ? question.hint_en : question.hint_ar}
                </p>
              </div>

              {/* Input by type */}
              {question.type === "choice" && question.choices ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {question.choices.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setAnswer(c.value)}
                      className={cn(
                        "p-3 rounded-xl border-2 text-sm transition-all text-start",
                        answer === c.value
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {uiLang === "en" ? c.label_en : c.label_ar}
                    </button>
                  ))}
                </div>
              ) : question.type === "form" ? (
                <FormFields
                  fields={question.fields ?? []}
                  value={structuredAnswer ?? {}}
                  onChange={setStructuredAnswer}
                  lang={uiLang}
                  dir={dir}
                />
              ) : question.type === "repeater" ? (
                <Repeater
                  fields={question.fields ?? []}
                  itemLabel={uiLang === "en" ? question.item_label_en ?? "Item" : question.item_label_ar ?? "عنصر"}
                  value={Array.isArray(structuredAnswer) ? structuredAnswer : []}
                  onChange={setStructuredAnswer}
                  lang={uiLang}
                  dir={dir}
                />
              ) : question.type === "repeater_simple" ? (
                <RepeaterSimple
                  itemLabel={uiLang === "en" ? question.item_label_en ?? "Item" : question.item_label_ar ?? "عنصر"}
                  value={Array.isArray(structuredAnswer) ? structuredAnswer : []}
                  onChange={setStructuredAnswer}
                  lang={uiLang}
                  dir={dir}
                />
              ) : question.type === "chips" ? (
                <ChipsInput
                  value={Array.isArray(structuredAnswer) ? structuredAnswer : []}
                  onChange={setStructuredAnswer}
                  lang={uiLang}
                  dir={dir}
                />
              ) : question.type === "textarea" ? (
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t.yourAnswer}
                  rows={6}
                  dir={dir}
                />
              ) : (
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t.yourAnswer}
                  dir={dir}
                />
              )}

              {prefilled && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {uiLang === "en"
                    ? "Filled from your profile — you can edit it"
                    : "تم تعبئتها من ملفك — يمكنك التعديل"}
                </p>
              )}

              {/* AI suggestion (when present) */}
              {suggestion && (
                <Card className="border-primary/30 bg-primary/5 rounded-xl">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Sparkles className="w-4 h-4" />
                      {t.suggestionTitle}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {suggestion}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAnswer(suggestion);
                        setSuggestion(null);
                      }}
                      className="rounded-lg"
                    >
                      {t.useSuggestion}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Suggestion trigger */}
              {!suggestion && question.type !== "choice" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={askSuggestion}
                  disabled={suggesting}
                  className="text-xs"
                >
                  {suggesting ? (
                    <Loader2 className="w-3 h-3 ml-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 ml-1.5" />
                  )}
                  {suggesting ? t.suggesting : t.suggestAi}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={loading || currentStep <= 0}
              className="rounded-xl"
            >
              {uiLang === "ar" ? (
                <ArrowRight className="w-4 h-4 ml-2" />
              ) : (
                <ArrowLeft className="w-4 h-4 mr-2" />
              )}
              {uiLang === "en" ? "Previous question" : "السؤال السابق"}
            </Button>
            {!question?.required && (
              <Button
                variant="ghost"
                onClick={() => submit({ skip: true })}
                disabled={loading}
                className="rounded-xl"
              >
                <SkipForward className="w-4 h-4 ml-2" />
                {t.skip}
              </Button>
            )}
          </div>
          <Button
            onClick={() => submit()}
            disabled={
              loading ||
              (question?.required &&
                (STRUCTURED_TYPES.includes(question.type)
                  ? !isStructuredAnswerMeaningful(question, structuredAnswer)
                  : !answer.trim()))
            }
            className="rounded-xl"
            size="lg"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : null}
            {t.next}
            {uiLang === "ar" ? (
              <ArrowLeft className="w-4 h-4 mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 ml-2" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// =================== Structured input sub-components ===================

interface FormFieldsProps {
  fields: SubFieldDef[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  lang: "ar" | "en";
  dir: "rtl" | "ltr";
}

const FormFields = ({ fields, value, onChange, lang, dir }: FormFieldsProps) => {
  const update = (key: string, v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f) => {
        const label = lang === "en" ? f.label_en : f.label_ar;
        const placeholder = lang === "en" ? f.placeholder_en ?? "" : f.placeholder_ar ?? "";
        const colSpan = f.span === 2 ? "sm:col-span-2" : "";
        if (f.type === "choice" && f.choices) {
          return (
            <div key={f.key} className={cn("space-y-1.5", colSpan)}>
              <label className="text-xs font-medium text-foreground">
                {label} {f.required && <span className="text-destructive">*</span>}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {f.choices.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => update(f.key, c.value)}
                    className={cn(
                      "px-2 py-2 rounded-lg border-2 text-xs transition-all text-center",
                      value[f.key] === c.value
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {lang === "en" ? c.label_en : c.label_ar}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (f.type === "textarea") {
          return (
            <div key={f.key} className={cn("space-y-1.5", colSpan)}>
              <label className="text-xs font-medium text-foreground">
                {label} {f.required && <span className="text-destructive">*</span>}
              </label>
              <Textarea
                value={value[f.key] ?? ""}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={placeholder}
                rows={3}
                dir={dir}
              />
            </div>
          );
        }
        return (
          <div key={f.key} className={cn("space-y-1.5", colSpan)}>
            <label className="text-xs font-medium text-foreground">
              {label} {f.required && <span className="text-destructive">*</span>}
            </label>
            <Input
              type={f.type === "tel" || f.type === "email" || f.type === "url" || f.type === "date" ? f.type : "text"}
              value={value[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={placeholder}
              dir={f.type === "email" || f.type === "url" || f.type === "tel" ? "ltr" : dir}
            />
          </div>
        );
      })}
    </div>
  );
};

interface RepeaterProps {
  fields: SubFieldDef[];
  itemLabel: string;
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
  lang: "ar" | "en";
  dir: "rtl" | "ltr";
}

const Repeater = ({ fields, itemLabel, value, onChange, lang, dir }: RepeaterProps) => {
  const items = Array.isArray(value) && value.length > 0 ? value : [Object.fromEntries(fields.map((f) => [f.key, ""]))];
  const updateItem = (idx: number, newItem: Record<string, string>) => {
    const copy = [...items];
    copy[idx] = newItem;
    onChange(copy);
  };
  const removeItem = (idx: number) => {
    const copy = items.filter((_, i) => i !== idx);
    onChange(copy.length ? copy : [Object.fromEntries(fields.map((f) => [f.key, ""]))]);
  };
  const addItem = () => onChange([...items, Object.fromEntries(fields.map((f) => [f.key, ""]))]);
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="border-2 border-dashed border-border rounded-xl p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {itemLabel} #{idx + 1}
            </span>
            {items.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeItem(idx)}
                className="h-7 px-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <FormFields fields={fields} value={item} onChange={(v) => updateItem(idx, v)} lang={lang} dir={dir} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-xl w-full">
        <Plus className="w-4 h-4 ml-1.5" />
        {lang === "en" ? `Add ${itemLabel}` : `إضافة ${itemLabel}`}
      </Button>
    </div>
  );
};

interface RepeaterSimpleProps {
  itemLabel: string;
  value: string[];
  onChange: (v: string[]) => void;
  lang: "ar" | "en";
  dir: "rtl" | "ltr";
}

const RepeaterSimple = ({ itemLabel, value, onChange, lang, dir }: RepeaterSimpleProps) => {
  const items = Array.isArray(value) && value.length > 0 ? value : [""];
  const update = (idx: number, v: string) => {
    const copy = [...items];
    copy[idx] = v;
    onChange(copy);
  };
  const remove = (idx: number) => {
    const copy = items.filter((_, i) => i !== idx);
    onChange(copy.length ? copy : [""]);
  };
  const add = () => onChange([...items, ""]);
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={it}
            onChange={(e) => update(idx, e.target.value)}
            placeholder={`${itemLabel} #${idx + 1}`}
            dir={dir}
            className="flex-1"
          />
          {items.length > 1 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(idx)} className="h-9 px-2 text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="rounded-xl w-full">
        <Plus className="w-4 h-4 ml-1.5" />
        {lang === "en" ? `Add ${itemLabel}` : `إضافة ${itemLabel}`}
      </Button>
    </div>
  );
};

interface ChipsInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  lang: "ar" | "en";
  dir: "rtl" | "ltr";
}

const ChipsInput = ({ value, onChange, lang, dir }: ChipsInputProps) => {
  const [draft, setDraft] = useState("");
  const chips = Array.isArray(value) ? value : [];
  const add = (raw: string) => {
    const parts = raw.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...chips, ...parts]));
    onChange(next);
    setDraft("");
  };
  const remove = (idx: number) => onChange(chips.filter((_, i) => i !== idx));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2.5rem] p-2 rounded-xl border-2 border-dashed border-border bg-muted/30">
        {chips.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">
            {lang === "en" ? "No skills yet — add your first below." : "لا توجد مهارات بعد — أضف أوّل مهارة أدناه."}
          </span>
        )}
        {chips.map((chip, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium"
          >
            {chip}
            <button type="button" onClick={() => remove(idx)} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && chips.length) {
              remove(chips.length - 1);
            }
          }}
          placeholder={lang === "en" ? "Type a skill, press Enter" : "اكتب مهارة واضغط Enter"}
          dir={dir}
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={() => add(draft)} className="rounded-xl">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CVInterview;
