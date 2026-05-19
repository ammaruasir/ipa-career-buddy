import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessagesSquare, Send, Loader2, Lightbulb, Sparkles, User2, CheckCircle2, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import JustificationCard, { type Justification } from "./JustificationCard";
import { proofreadText } from "./ProofreadInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Lang = "ar" | "en";

interface Replacement {
  original: string;
  improved: string;
  section?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  justifications?: Justification[];
  suggested_actions?: string[];
  replacements?: Replacement[];
  created_at?: string;
}

interface CVChatPanelProps {
  cvDocumentId: string;
  language?: Lang;
  onAcceptImprovement?: (improved: string, original: string, section?: string) => Promise<void> | void;
}

const TEXT = {
  ar: {
    title: "تحدّث مع واكب AI حول سيرتك",
    intro:
      "اطرح أي سؤال عن سيرتك ('ما الذي يجب تحسينه في خبراتي؟' / 'أعد كتابة الملخّص' / 'لماذا هذا البند ضعيف؟'). واكب AI سيشرح لك المنطق وراء كل ملاحظة.",
    placeholder: "اكتب سؤالك...",
    send: "إرسال",
    sending: "جارٍ التحليل...",
    suggestedActions: "خطوات مقترحة",
    you: "أنت",
    coach: "المدرّب",
    suggestionsPrompts: [
      "ما أكبر ٣ نقاط ضعف في سيرتي؟",
      "كيف أحسّن قسم الخبرات؟",
      "هل سيرتي مناسبة لوظيفة حكومية؟",
      "أعد كتابة الملخّص بأسلوب أقوى",
    ],
  },
  en: {
    title: "Chat with Wakeb AI about your CV",
    intro:
      "Ask any question about your CV ('What should I improve in my experience?' / 'Rewrite the summary' / 'Why is this bullet weak?'). Wakeb AI will explain the reasoning behind every observation.",
    placeholder: "Type your question...",
    send: "Send",
    sending: "Analyzing...",
    suggestedActions: "Suggested next steps",
    you: "You",
    coach: "Coach",
    suggestionsPrompts: [
      "What are my CV's top 3 weaknesses?",
      "How do I improve the experience section?",
      "Is my CV suitable for a government role?",
      "Rewrite the summary in a stronger style",
    ],
  },
};

// Extract the actionable improvement text from a chatty AI reply.
// Priority: fenced code block -> quoted block -> text after a labelled cue
// ("النص المحسّن:", "Improved:", "النسخة المحسّنة:" ...) -> longest paragraph >40 chars.
const extractImprovementFromReply = (text: string): string => {
  if (!text) return "";
  const trimmed = text.trim();

  // 1) Fenced code block ```...```
  const fence = trimmed.match(/```[a-zA-Z]*\n?([\s\S]+?)```/);
  if (fence?.[1]?.trim()) return fence[1].trim();

  // 2) Labelled cue — capture text after the label until a blank line or end
  const labelRe =
    /(?:النص\s*المحسّن|النسخة\s*المحسّنة|المحسّن|المقترح|Improved(?:\s*version)?|Rewrite|Suggested)\s*[:：\-—]\s*([\s\S]+?)(?:\n\s*\n|$)/i;
  const labelled = trimmed.match(labelRe);
  if (labelled?.[1]?.trim()) {
    return labelled[1].replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
  }

  // 3) Quoted block — first triple/double quoted chunk
  const quoted =
    trimmed.match(/"{3}([\s\S]+?)"{3}/) ||
    trimmed.match(/"([^"]{40,})"/) ||
    trimmed.match(/«([^»]{20,})»/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  // 4) Longest paragraph >40 chars
  const paragraphs = trimmed.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const long = paragraphs.filter((p) => p.length > 40);
  if (long.length) {
    long.sort((a, b) => b.length - a.length);
    return long[0];
  }

  return "";
};

const CVChatPanel = ({ cvDocumentId, language = "ar", onAcceptImprovement }: CVChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerImproved, setPickerImproved] = useState("");
  const [pickerOriginal, setPickerOriginal] = useState("");
  const [pickerSection, setPickerSection] = useState("other");
  const [accepting, setAccepting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = TEXT[language];
  const dir = language === "ar" ? "rtl" : "ltr";

  const acceptOne = async (improved: string, original: string, section?: string) => {
    if (!onAcceptImprovement) return;
    try {
      await onAcceptImprovement(improved, original, section);
      toast.success(
        language === "en" ? "Added to accepted improvements" : "تمت إضافته للتحسينات المعتمدة",
      );
    } catch (e: any) {
      toast.error(e?.message || (language === "en" ? "Failed to save" : "تعذّر الحفظ"));
    }
  };

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text?: string) => {
    const raw = (text ?? input).trim();
    if (!raw || loading) return;

    setInput("");
    setLoading(true);
    // Silent Arabic proofread before sending (only auto-applies single-option fixes)
    const msg = language === "ar" ? await proofreadText(raw, "general") : raw;
    setMessages((m) => [...m, { role: "user", content: msg }]);

    try {
      const { data, error } = await supabase.functions.invoke("chat-with-cv", {
        body: {
          cv_document_id: cvDocumentId,
          conversation_id: conversationId,
          message: msg,
          language,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.message) throw new Error(language === "en" ? "Empty response" : "استجابة فارغة");
      if (data.conversation_id) setConversationId(data.conversation_id);
      setMessages((m) => [...m, data.message]);
    } catch (e: any) {
      console.error("chat-with-cv failed:", e);
      const fallback =
        e?.message?.includes("Failed to fetch") || e?.name === "FunctionsFetchError"
          ? language === "en"
            ? "Connection issue. Please check your internet and try again."
            : "تعذّر الاتصال. تحقّق من الإنترنت وحاول مجدداً."
          : e?.message ||
            (language === "en" ? "Something went wrong. Please try again." : "حدث خطأ. حاول مرّة أخرى.");
      toast.error(fallback);
      setInput(msg);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${fallback}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-lg flex flex-col h-[600px]" dir={dir}>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <MessagesSquare className="w-5 h-5 text-primary" />
          {t.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{t.intro}</p>
              <div className="space-y-1.5 pt-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {language === "en" ? "Try one of these:" : "جرّب أحد هذه:"}
                </p>
                {t.suggestionsPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => send(p)}
                    className="w-full text-start text-sm p-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition-all"
                  >
                    <Lightbulb className="w-3.5 h-3.5 inline-block ml-1.5 text-amber-500" />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, idx) => (
            <div key={idx} className="space-y-2">
              <div
                className={cn(
                  "flex gap-2",
                  m.role === "user" ? "justify-start" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    m.role === "user"
                      ? "bg-muted text-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {m.role === "user" ? (
                    <User2 className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {m.role === "user" ? t.you : t.coach}
                  </div>
                  <div
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-muted text-foreground"
                        : "bg-primary/5 border border-primary/20 text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === "assistant" && onAcceptImprovement && !m.content.startsWith("⚠️") && (
                    <div className="space-y-2 mt-1.5">
                      {/* Structured replacements from AI */}
                      {m.replacements && m.replacements.length > 0 && (
                        <div className="space-y-2">
                          {m.replacements.map((rep, ri) => {
                            const isAddition = !rep.original?.trim();
                            return (
                              <div
                                key={ri}
                                className="rounded-lg border border-primary/20 bg-background p-2.5 space-y-2"
                              >
                                {isAddition ? (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <PlusCircle className="w-3 h-3 text-emerald-600" />
                                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        {language === "en" ? "New addition" : "إضافة جديدة"}
                                      </span>
                                      {rep.section && (
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                          {rep.section}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                                      {rep.improved}
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[10px] font-semibold text-muted-foreground">
                                          {language === "en" ? "Original" : "الأصلي"}
                                        </span>
                                        {rep.section && (
                                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                            {rep.section}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground line-through">
                                        {rep.original}
                                      </p>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">
                                        {language === "en" ? "Improved" : "المُحسَّن"}
                                      </div>
                                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                                        {rep.improved}
                                      </p>
                                    </div>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 w-full"
                                  onClick={() => acceptOne(rep.improved, rep.original || "", rep.section)}
                                >
                                  <CheckCircle2 className="w-3 h-3 ml-1" />
                                  {language === "en" ? "Accept this improvement" : "اعتمد هذا التحسين"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Generic "use this whole reply" button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => {
                          const extracted = extractImprovementFromReply(m.content);
                          setPickerImproved(extracted);
                          setPickerOriginal("");
                          setPickerSection("other");
                          setPickerOpen(true);
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3 ml-1" />
                        {language === "en" ? "Use as improvement" : "اعتمد كتحسين على السيرة"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Justifications */}
              {m.justifications && m.justifications.length > 0 && (
                <div className="space-y-2 ps-9">
                  {m.justifications.map((j, ji) => (
                    <JustificationCard key={ji} justification={j} language={language} />
                  ))}
                </div>
              )}

              {/* Suggested actions */}
              {m.suggested_actions && m.suggested_actions.length > 0 && (
                <div className="ps-9 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                    {t.suggestedActions}
                  </p>
                  <ul className="space-y-1 text-sm text-foreground">
                    {m.suggested_actions.map((a, ai) => (
                      <li key={ai} className="flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">→</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.sending}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3 space-y-2">
          <Textarea
            data-tour="cv-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t.placeholder}
            rows={2}
            dir={dir}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              data-tour="cv-chat-send"
              onClick={() => send()}
              disabled={!input.trim() || loading}
              size="sm"
              className="rounded-xl"
            >
              <Send className="w-3.5 h-3.5 ml-1.5" />
              {t.send}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Manual accept dialog (used when AI didn't return structured replacements) */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent dir={dir} className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle>
              {language === "en" ? "Accept improvement" : "اعتماد التحسين"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {language === "en"
                ? "Review and edit both texts before approving. The original is what gets replaced in your CV; leave it empty to add the improved text as a new bullet."
                : "راجع وعدّل النصين قبل الاعتماد. النص الأصلي هو ما سيُستبدل في سيرتك؛ اتركه فارغاً لإضافة النص المحسّن كبند جديد."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {language === "en" ? "Original text from CV (optional)" : "النص الأصلي من السيرة (اختياري)"}
              </div>
              <Textarea
                value={pickerOriginal}
                onChange={(e) => setPickerOriginal(e.target.value)}
                rows={4}
                dir={dir}
                placeholder={
                  language === "en"
                    ? "Paste the exact text from your CV that should be replaced. Leave empty to add as a new bullet."
                    : "الصق النص الأصلي من سيرتك ليُستبدل. اتركه فارغاً لإضافته كبند جديد."
                }
                className="text-sm"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                {language === "en" ? "Improved (from Wakeb AI)" : "النص المُحسَّن (من واكب AI)"}
              </div>
              <Textarea
                value={pickerImproved}
                onChange={(e) => setPickerImproved(e.target.value)}
                rows={5}
                dir={dir}
                placeholder={
                  language === "en"
                    ? "We couldn't auto-extract a clean rewrite from the AI reply. Paste or edit the improved version here."
                    : "تعذّر استخراج نص محسّن واضح من رد الذكاء الاصطناعي. الصق أو عدّل النسخة المحسّنة هنا."
                }
                className="text-sm"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {language === "en" ? "Section" : "القسم"}
              </div>
              <select
                value={pickerSection}
                onChange={(e) => setPickerSection(e.target.value)}
                className="w-full text-sm border border-input bg-background rounded-md h-9 px-2"
                dir={dir}
              >
                <option value="summary">{language === "en" ? "Summary" : "الملخّص"}</option>
                <option value="experience">{language === "en" ? "Experience" : "الخبرة"}</option>
                <option value="education">{language === "en" ? "Education" : "التعليم"}</option>
                <option value="skills">{language === "en" ? "Skills" : "المهارات"}</option>
                <option value="achievements">{language === "en" ? "Achievements" : "الإنجازات"}</option>
                <option value="certifications">{language === "en" ? "Certifications" : "الشهادات"}</option>
                <option value="other">{language === "en" ? "Other" : "أخرى"}</option>
              </select>
            </div>

            {/* Before / After preview */}
            {(pickerOriginal.trim() || pickerImproved.trim()) && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {language === "en" ? "Preview before approving" : "معاينة قبل الاعتماد"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="rounded-lg bg-background p-2.5 border">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                      {language === "en" ? "Before" : "قبل"}
                    </p>
                    <p className="text-xs whitespace-pre-wrap text-muted-foreground line-through min-h-[2rem]">
                      {pickerOriginal.trim() || (language === "en" ? "(new addition — nothing replaced)" : "(إضافة جديدة — لا يوجد نص يُستبدل)")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/5 p-2.5 border border-emerald-500/30">
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      {language === "en" ? "After" : "بعد"}
                    </p>
                    <p className="text-xs whitespace-pre-wrap text-foreground min-h-[2rem]">
                      {pickerImproved.trim() || (language === "en" ? "(empty)" : "(فارغ)")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t">
            <Button variant="ghost" onClick={() => setPickerOpen(false)} disabled={accepting}>
              {language === "en" ? "Cancel" : "إلغاء"}
            </Button>
            <Button
              disabled={!pickerImproved.trim() || accepting}
              onClick={async () => {
                setAccepting(true);
                await acceptOne(pickerImproved.trim(), pickerOriginal.trim(), pickerSection);
                setAccepting(false);
                setPickerOpen(false);
              }}
            >
              {accepting && <Loader2 className="w-3.5 h-3.5 ml-1.5 animate-spin" />}
              {language === "en" ? "Accept & merge on export" : "اعتمد ودمج عند التصدير"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CVChatPanel;
