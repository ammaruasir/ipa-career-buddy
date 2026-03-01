import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Send, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant" | "system"; content: string };

const JOBS = [
  "محلل أعمال",
  "أخصائي موارد بشرية",
  "مدير مشاريع",
  "محاسب",
  "مطور برمجيات",
  "أخصائي تسويق",
];

const TextInterview = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const startInterview = async (job: string) => {
    if (!user) return;
    setSelectedJob(job);
    setIsLoading(true);

    // Create interview record
    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({ user_id: user.id, type: "text" as any, job_position: job, status: "in_progress" as any })
      .select()
      .single();

    if (error || !interview) {
      toast.error("حدث خطأ في بدء المقابلة");
      setIsLoading(false);
      return;
    }

    setInterviewId(interview.id);

    // Get first question from AI
    const systemMsg: Msg = {
      role: "system",
      content: `أنت محاور ذكي متخصص في إجراء مقابلات وظيفية باللغة العربية لمعهد الإدارة العامة في المملكة العربية السعودية. الوظيفة المطلوبة: ${job}. اسأل المرشح 5 أسئلة متنوعة تغطي المهارات التقنية والشخصية والتواصل. اطرح سؤالاً واحداً في كل مرة. ابدأ بتحية المرشح ثم اطرح السؤال الأول.`,
    };

    try {
      const resp = await supabase.functions.invoke("chat", {
        body: { messages: [systemMsg] },
      });

      if (resp.error) throw resp.error;

      const aiReply = resp.data?.choices?.[0]?.message?.content || "مرحباً! دعنا نبدأ المقابلة.";
      setMessages([{ role: "assistant", content: aiReply }]);
      setQuestionCount(1);
    } catch (e) {
      toast.error("حدث خطأ في الاتصال بالذكاء الاصطناعي");
    }
    setIsLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !interviewId) return;

    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Save response
    await supabase.from("responses").insert({
      interview_id: interviewId,
      question_text: messages[messages.length - 1]?.content || "",
      answer_text: userMsg.content,
    });

    const systemMsg: Msg = {
      role: "system",
      content: `أنت محاور ذكي. الوظيفة: ${selectedJob}. السؤال رقم ${questionCount} من 5. ${
        questionCount >= 5
          ? "هذا كان آخر سؤال. اشكر المرشح وأخبره أن التقييم سيكون جاهزاً قريباً. لا تطرح أسئلة إضافية."
          : "اطرح السؤال التالي بعد التعليق بإيجاز على الإجابة."
      }`,
    };

    try {
      const resp = await supabase.functions.invoke("chat", {
        body: { messages: [systemMsg, ...newMessages] },
      });

      if (resp.error) throw resp.error;

      const aiReply = resp.data?.choices?.[0]?.message?.content || "";
      setMessages((prev) => [...prev, { role: "assistant", content: aiReply }]);
      setQuestionCount((c) => c + 1);

      // End interview after 5 questions
      if (questionCount >= 5) {
        await supabase
          .from("interviews")
          .update({ status: "completed" as any })
          .eq("id", interviewId);
        toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم...");
      }
    } catch (e) {
      toast.error("حدث خطأ في الاتصال");
    }
    setIsLoading(false);
  };

  if (!selectedJob) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto flex items-center gap-3 py-4 px-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/dashboard")}>
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold">المقابلة النصية</h2>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <h2 className="text-2xl font-bold text-foreground">اختر الوظيفة المستهدفة</h2>
            <p className="text-muted-foreground">سيتم توليد أسئلة مخصصة بناءً على الوظيفة التي تختارها</p>
            <div className="grid grid-cols-2 gap-4">
              {JOBS.map((job) => (
                <Button
                  key={job}
                  variant="outline"
                  className="rounded-2xl py-6 text-lg shadow-lg hover:shadow-xl hover:border-primary/30 transition-all"
                  onClick={() => startInterview(job)}
                >
                  {job}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/dashboard")}>
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-bold">مقابلة: {selectedJob}</h2>
          </div>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            السؤال {Math.min(questionCount, 5)} من 5
          </span>
        </div>
      </header>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="container mx-auto max-w-2xl space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
              <Card
                className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border shadow-md rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </Card>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-end">
              <Card className="p-4 rounded-2xl bg-card border shadow-md rounded-bl-sm">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      {questionCount <= 5 && (
        <div className="border-t border-border bg-card p-4">
          <div className="container mx-auto max-w-2xl flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="اكتب إجابتك هنا..."
              className="rounded-xl flex-1"
              disabled={isLoading || questionCount > 5}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="rounded-xl"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextInterview;
