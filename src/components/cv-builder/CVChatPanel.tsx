import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessagesSquare, Send, Loader2, Lightbulb, Sparkles, User2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import JustificationCard, { type Justification } from "./JustificationCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Lang = "ar" | "en";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  justifications?: Justification[];
  suggested_actions?: string[];
  created_at?: string;
}

interface CVChatPanelProps {
  cvDocumentId: string;
  language?: Lang;
}

const TEXT = {
  ar: {
    title: "تحدّث مع AI حول سيرتك",
    intro:
      "اطرح أي سؤال عن سيرتك ('ما الذي يجب تحسينه في خبراتي؟' / 'أعد كتابة الملخّص' / 'لماذا هذا البند ضعيف؟'). AI سيشرح لك المنطق وراء كل ملاحظة.",
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
    title: "Chat with AI about your CV",
    intro:
      "Ask any question about your CV ('What should I improve in my experience?' / 'Rewrite the summary' / 'Why is this bullet weak?'). AI will explain the reasoning behind every observation.",
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

const CVChatPanel = ({ cvDocumentId, language = "ar" }: CVChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = TEXT[language];
  const dir = language === "ar" ? "rtl" : "ltr";

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);

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
            <Button onClick={() => send()} disabled={!input.trim() || loading} size="sm" className="rounded-xl">
              <Send className="w-3.5 h-3.5 ml-1.5" />
              {t.send}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CVChatPanel;
