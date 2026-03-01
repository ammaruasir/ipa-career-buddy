import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSystemSettings } from "@/hooks/useSystemSettings";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type InterviewType = "text" | "voice" | "video";

interface UseInterviewSessionOptions {
  type: InterviewType;
  totalQuestions?: number;
}

export const useInterviewSession = ({ type, totalQuestions: overrideTotalQuestions }: UseInterviewSessionOptions) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Use dynamic question count from settings, with override fallback
  const totalQuestions = overrideTotalQuestions ?? settings.questions_per_type[type] ?? 8;
  const timerDuration = settings.time_per_question[type] ?? 300;

  const startInterview = useCallback(async (job: string) => {
    if (!user) return;
    setSelectedJob(job);
    setIsLoading(true);

    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({ user_id: user.id, type: type as any, job_position: job, status: "in_progress" as any })
      .select()
      .single();

    if (error || !interview) {
      toast.error("حدث خطأ في بدء المقابلة");
      setIsLoading(false);
      return;
    }

    setInterviewId(interview.id);

    const systemMsg: Msg = {
      role: "system",
      content: `أنت محاور ذكي متخصص في إجراء مقابلات وظيفية احترافية باللغة العربية.
الوظيفة المطلوبة: ${job}.
اسأل المرشح ${totalQuestions} أسئلة بالترتيب التالي:
- السؤال 1-2: أسئلة سلوكية (مثال: حدثنا عن موقف واجهت فيه ضغطاً كبيراً)
- السؤال 3-5: أسئلة تقنية متعلقة بـ ${job} (تتدرج من سهل إلى صعب)
- السؤال 6-7: أسئلة موقفية (ماذا ستفعل إذا...)
- السؤال 8: سؤال توافق ثقافي مع قيم المؤسسة (التميز، الابتكار، الاحترافية)

اطرح سؤالاً واحداً في كل مرة. ابدأ بتحية المرشح ثم اطرح السؤال الأول.`,
    };

    try {
      const resp = await supabase.functions.invoke("chat", {
        body: { messages: [systemMsg], job_position: job, interview_type: type },
      });
      if (resp.error) throw resp.error;
      const aiReply = resp.data?.choices?.[0]?.message?.content || "مرحباً! دعنا نبدأ المقابلة.";
      setMessages([{ role: "assistant", content: aiReply }]);
      setQuestionCount(1);
    } catch {
      toast.error("حدث خطأ في الاتصال بالذكاء الاصطناعي");
    }
    setIsLoading(false);
  }, [user, type, totalQuestions]);

  const sendAnswer = useCallback(async (answerText: string) => {
    if (!answerText.trim() || isLoading || !interviewId) return;

    const userMsg: Msg = { role: "user", content: answerText.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    await supabase.from("responses").insert({
      interview_id: interviewId,
      question_text: messages[messages.length - 1]?.content || "",
      answer_text: userMsg.content,
    });

    const questionCategories = ["سلوكي", "سلوكي", "تقني", "تقني", "تقني", "موقفي", "موقفي", "توافق ثقافي"];
    const currentCategory = questionCategories[questionCount - 1] || "عام";
    const systemMsg: Msg = {
      role: "system",
      content: `أنت محاور ذكي. الوظيفة: ${selectedJob}. السؤال رقم ${questionCount} من ${totalQuestions} (نوع: ${currentCategory}). ${
        questionCount >= totalQuestions
          ? "هذا كان آخر سؤال. اشكر المرشح وأخبره أن التقييم سيكون جاهزاً قريباً. لا تطرح أسئلة إضافية."
          : `اطرح السؤال التالي (${questionCategories[questionCount] || "عام"}) بعد التعليق بإيجاز على الإجابة.`
      }`,
    };

    try {
      const resp = await supabase.functions.invoke("chat", {
        body: { messages: [systemMsg, ...newMessages], job_position: selectedJob, interview_type: type },
      });
      if (resp.error) throw resp.error;
      const aiReply = resp.data?.choices?.[0]?.message?.content || "";
      setMessages((prev) => [...prev, { role: "assistant", content: aiReply }]);
      setQuestionCount((c) => c + 1);

      if (questionCount >= totalQuestions) {
        await supabase
          .from("interviews")
          .update({ status: "completed" as any })
          .eq("id", interviewId);
        setIsCompleted(true);
        toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم...");
        
        setIsEvaluating(true);
        try {
          const evalResp = await supabase.functions.invoke("evaluate-interview", {
            body: { interview_id: interviewId },
          });
          if (evalResp.error) {
            console.error("Evaluation error:", evalResp.error);
            toast.error("حدث خطأ في التقييم، يمكنك المحاولة لاحقاً");
          } else {
            toast.success("تم إعداد التقييم بنجاح!");
            navigate(`/interview/${interviewId}/results`);
          }
        } catch (e) {
          console.error("Evaluation error:", e);
          toast.error("حدث خطأ في التقييم");
        }
        setIsEvaluating(false);
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
    setIsLoading(false);
  }, [messages, isLoading, interviewId, selectedJob, questionCount, totalQuestions, type]);

  return {
    user,
    navigate,
    selectedJob,
    messages,
    isLoading,
    interviewId,
    questionCount,
    totalQuestions,
    timerDuration,
    isCompleted,
    isEvaluating,
    settingsLoading,
    startInterview,
    sendAnswer,
    setMessages,
  };
};
