import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputButton,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { MessagesSquare, Lightbulb, CheckCircle2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Lang = "ar" | "en";

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
    placeholder: "اكتب سؤالك... (Enter للإرسال، Shift+Enter لسطر جديد)",
    thinking: "واكب AI يفكّر...",
    you: "أنت",
    coach: "واكب AI",
    attach: "إرفاق ملف",
    useAsImprovement: "اعتمد كتحسين على السيرة",
    suggestionsHeader: "جرّب أحد هذه:",
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
      "Ask any question about your CV ('What should I improve?' / 'Rewrite the summary' / 'Why is this weak?'). Wakeb AI will explain every observation.",
    placeholder: "Type your question... (Enter to send, Shift+Enter for newline)",
    thinking: "Wakeb AI is thinking...",
    you: "You",
    coach: "Wakeb AI",
    attach: "Attach file",
    useAsImprovement: "Use as improvement",
    suggestionsHeader: "Try one of these:",
    suggestionsPrompts: [
      "What are my CV's top 3 weaknesses?",
      "How do I improve the experience section?",
      "Is my CV suitable for a government role?",
      "Rewrite the summary in a stronger style",
    ],
  },
};

// Extract the actionable improvement text from a chatty AI reply.
const extractImprovementFromReply = (text: string): string => {
  if (!text) return "";
  const trimmed = text.trim();
  const fence = trimmed.match(/```[a-zA-Z]*\n?([\s\S]+?)```/);
  if (fence?.[1]?.trim()) return fence[1].trim();
  const labelRe =
    /(?:النص\s*المحسّن|النسخة\s*المحسّنة|المحسّن|المقترح|Improved(?:\s*version)?|Rewrite|Suggested)\s*[:：\-—]\s*([\s\S]+?)(?:\n\s*\n|$)/i;
  const labelled = trimmed.match(labelRe);
  if (labelled?.[1]?.trim()) {
    return labelled[1].replace(/^["'""«»]+|["'""«»]+$/g, "").trim();
  }
  const quoted =
    trimmed.match(/"{3}([\s\S]+?)"{3}/) ||
    trimmed.match(/"([^"]{40,})"/) ||
    trimmed.match(/«([^»]{20,})»/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  const paragraphs = trimmed.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const long = paragraphs.filter((p) => p.length > 40);
  if (long.length) {
    long.sort((a, b) => b.length - a.length);
    return long[0];
  }
  return "";
};

const messageText = (m: UIMessage): string =>
  (m.parts ?? [])
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("\n");

// Attachment button + thumbnails – mounted INSIDE <PromptInput>
const AttachmentControls = ({ label }: { label: string }) => {
  const att = usePromptInputAttachments();
  return (
    <>
      <PromptInputButton
        type="button"
        variant="ghost"
        size="icon-sm"
        tooltip={label}
        onClick={() => att.openFileDialog()}
      >
        <Paperclip className="w-4 h-4" />
      </PromptInputButton>
      {att.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {att.files.map((f: any) => (
            <div
              key={f.id}
              className="flex items-center gap-1.5 rounded-md border bg-muted/40 pl-2 pr-1 py-1 text-[11px]"
            >
              <Paperclip className="w-3 h-3 text-muted-foreground" />
              <span className="max-w-[140px] truncate">{f.filename || "file"}</span>
              <button
                type="button"
                onClick={() => att.remove(f.id)}
                className="hover:bg-destructive/15 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const CVChatPanel = ({
  cvDocumentId,
  language = "ar",
  onAcceptImprovement,
}: CVChatPanelProps) => {
  const t = TEXT[language];
  const dir = language === "ar" ? "rtl" : "ltr";

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerImproved, setPickerImproved] = useState("");
  const [pickerOriginal, setPickerOriginal] = useState("");
  const [pickerSection, setPickerSection] = useState("other");
  const [accepting, setAccepting] = useState(false);

  // Fetch fresh access token for the streaming function
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthToken(data.session?.access_token ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthToken(session?.access_token ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const transport = useRef<DefaultChatTransport<UIMessage> | null>(null);
  if (!transport.current && authToken) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cv-chat-stream`;
    transport.current = new DefaultChatTransport({
      api: url,
      headers: () => ({
        Authorization: `Bearer ${authToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      }),
      body: () => ({
        cv_document_id: cvDocumentId,
        language,
      }),
    });
  }

  const { messages, sendMessage, status, stop, error } = useChat({
    id: `cv-chat-${cvDocumentId}`,
    transport: transport.current ?? undefined,
    onError: (e) => {
      console.error("chat error:", e);
      toast.error(
        language === "en"
          ? "Connection issue. Please try again."
          : "تعذّر الاتصال. حاول مرة أخرى.",
      );
    },
  });

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

  const handleSubmit = (msg: PromptInputMessage) => {
    const text = (msg.text ?? "").trim();
    const files = msg.files ?? [];
    if (!text && files.length === 0) return;
    sendMessage({ text, files });
  };

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <Card className="rounded-2xl shadow-lg flex flex-col h-[600px] overflow-hidden" dir={dir}>
      <CardHeader className="pb-3 border-b shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MessagesSquare className="w-5 h-5 text-primary" />
          {t.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3" dir={dir}>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.intro}</p>
                <p className="text-xs font-semibold text-muted-foreground pt-2">
                  {t.suggestionsHeader}
                </p>
                <div className="space-y-1.5">
                  {t.suggestionsPrompts.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={isBusy || !authToken}
                      onClick={() => sendMessage({ text: p })}
                      className="w-full text-start text-sm p-2.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Lightbulb className="w-3.5 h-3.5 inline-block mx-1.5 text-amber-500" />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const isAssistant = m.role === "assistant";
              const fullText = messageText(m);
              return (
                <div key={m.id} className="space-y-1.5" dir={dir}>
                  <Message from={m.role as any}>
                    <MessageContent
                      className={cn(
                        isAssistant
                          ? "bg-transparent p-0 text-foreground border-0"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {(m.parts ?? []).map((part: any, i: number) => {
                        if (part.type === "text") {
                          return (
                            <MessageResponse key={i}>{part.text}</MessageResponse>
                          );
                        }
                        if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                          return (
                            <img
                              key={i}
                              src={part.url}
                              alt={part.filename ?? "attachment"}
                              className="max-w-[240px] rounded-md mt-1.5 border"
                            />
                          );
                        }
                        if (part.type === "file") {
                          return (
                            <div
                              key={i}
                              className="inline-flex items-center gap-1.5 rounded-md border bg-background/50 px-2 py-1 text-xs mt-1.5"
                            >
                              <Paperclip className="w-3 h-3" />
                              {part.filename ?? "file"}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </MessageContent>
                  </Message>

                  {isAssistant && onAcceptImprovement && fullText && status !== "streaming" && (
                    <div className="flex justify-start ps-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => {
                          setPickerImproved(extractImprovementFromReply(fullText));
                          setPickerOriginal("");
                          setPickerSection("other");
                          setPickerOpen(true);
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3 ml-1" />
                        {t.useAsImprovement}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="ps-1 pt-1">
                <Shimmer>{t.thinking}</Shimmer>
              </div>
            )}

            {error && status === "error" && (
              <p className="text-xs text-destructive ps-1">
                {language === "en" ? "Failed to reach AI. Try again." : "تعذّر الوصول للذكاء الاصطناعي. حاول مجدداً."}
              </p>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t shrink-0 p-3">
          <PromptInput
            onSubmit={handleSubmit}
            accept="image/*,application/pdf"
            multiple
            maxFiles={3}
            maxFileSize={8 * 1024 * 1024}
            onError={(err) =>
              toast.error(
                err.code === "max_file_size"
                  ? language === "en"
                    ? "File too large (max 8MB)"
                    : "الملف كبير جداً (الحد ٨ ميجا)"
                  : err.message,
              )
            }
          >
            <PromptInputTextarea
              placeholder={t.placeholder}
              dir={dir}
              disabled={!authToken}
            />
            <PromptInputFooter className="justify-between">
              <AttachmentControls label={t.attach} />
              <PromptInputSubmit
                status={status}
                onStop={stop}
                disabled={!authToken}
                size="icon-sm"
                className="rounded-full h-9 w-9"
              />
            </PromptInputFooter>
          </PromptInput>
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
                    ? "Paste or edit the improved version here."
                    : "الصق أو عدّل النسخة المحسّنة هنا."
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
              {language === "en" ? "Accept & merge on export" : "اعتمد ودمج عند التصدير"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CVChatPanel;
