import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type InterviewType = "text" | "voice" | "video";

interface UseInterviewSessionOptions {
  type: InterviewType;
  totalQuestions?: number;
}

export const useInterviewSession = ({ type, totalQuestions = 5 }: UseInterviewSessionOptions) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

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
      content: `أنت محاور ذكي متخصص في إجراء مقابلات وظيفية باللغة العربية لمعهد الإدارة العامة في المملكة العربية السعودية. الوظيفة المطلوبة: ${job}. اسأل المرشح ${totalQuestions} أسئلة متنوعة تغطي المهارات التقنية والشخصية والتواصل. اطرح سؤالاً واحداً في كل مرة. ابدأ بتحية المرشح ثم اطرح السؤال الأول.`,
    };

    try {
      const resp = await supabase.functions.invoke("chat", {
        body: { messages: [systemMsg] },
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

    const systemMsg: Msg = {
      role: "system",
      content: `أنت محاور ذكي. الوظيفة: ${selectedJob}. السؤال رقم ${questionCount} من ${totalQuestions}. ${
        questionCount >= totalQuestions
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

      if (questionCount >= totalQuestions) {
        await supabase
          .from("interviews")
          .update({ status: "completed" as any })
          .eq("id", interviewId);
        setIsCompleted(true);
        toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم...");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
    setIsLoading(false);
  }, [messages, isLoading, interviewId, selectedJob, questionCount, totalQuestions]);

  return {
    user,
    navigate,
    selectedJob,
    messages,
    isLoading,
    interviewId,
    questionCount,
    totalQuestions,
    isCompleted,
    startInterview,
    sendAnswer,
    setMessages,
  };
};
