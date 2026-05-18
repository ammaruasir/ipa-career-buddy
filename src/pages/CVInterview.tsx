import { useEffect, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionChoice {
  value: string;
  label_ar: string;
  label_en: string;
}

interface Question {
  id: string;
  step: number;
  field: string;
  required: boolean;
  type: "text" | "textarea" | "list_text" | "structured_list" | "choice";
  choices?: QuestionChoice[];
  label_ar: string;
  label_en: string;
  hint_ar: string;
  hint_en: string;
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

  // Pre-interview language picker
  const [language, setLanguage] = useState<Lang>("ar");
  const [started, setStarted] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(15);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
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

    const finalAnswer = opts.skip ? "" : answer;

    if (question.required && !opts.skip && !finalAnswer.trim()) {
      toast.error(t.required);
      return;
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
    } catch (e) {
      console.error(e);
      toast.error(uiLang === "en" ? "Failed to save answer" : "فشل حفظ الإجابة");
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
        <div className="container mx-auto px-4 py-10 max-w-2xl">
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
        <div className="flex items-center justify-between gap-3">
          {!question?.required ? (
            <Button
              variant="ghost"
              onClick={() => submit({ skip: true })}
              disabled={loading}
              className="rounded-xl"
            >
              <SkipForward className="w-4 h-4 ml-2" />
              {t.skip}
            </Button>
          ) : (
            <div />
          )}
          <Button
            onClick={() => submit()}
            disabled={loading || (question?.required && !answer.trim())}
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

export default CVInterview;
