import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  

  const contextSummaryRef = useRef<string>("");
  const interviewIdRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const lastQuestionRef = useRef(false);

  const totalQuestions = overrideTotalQuestions ?? settings.questions_per_type[type] ?? 8;
  const timerDuration = settings.time_per_question[type] ?? 300;

  const startInterview = useCallback(async (job: string) => {
    if (!user) return;
    setSelectedJob(job);
    setIsLoading(true);
    contextSummaryRef.current = "";

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
    interviewIdRef.current = interview.id;

    const vacancyId = searchParams.get("vacancy_id");
    if (vacancyId) {
      await supabase
        .from("job_applications")
        .update({ interview_id: interview.id, status: "interviewing" } as any)
        .eq("vacancy_id", vacancyId)
        .eq("user_id", user.id);
    }

    const systemMsg: Msg = {
      role: "system",
      content: `أنت محاور وظيفي محترف يعمل في السعودية. الوظيفة: ${job}. اطرح ${totalQuestions} أسئلة. سؤال واحد فقط في كل مرة. أقل من 80 كلمة. لا تساعد المرشح.`,
    };

    try {
      const resp = await supabase.functions.invoke("chat", {
        body: {
          messages: [systemMsg],
          job_position: job,
          interview_type: type,
          vacancy_id: vacancyId,
          user_id: user.id,
        },
      });
      if (resp.error) throw resp.error;
      const aiReply = resp.data?.choices?.[0]?.message?.content || "مرحباً! دعنا نبدأ المقابلة.";
      setMessages([{ role: "assistant", content: aiReply }]);
      setQuestionCount(1);
    } catch {
      toast.error("حدث خطأ في الاتصال بمحرك واكب للذكاء الاصطناعي");
    }
    setIsLoading(false);
  }, [user, type, totalQuestions, searchParams]);

  // Auto-start
  useEffect(() => {
    const jobParam = searchParams.get("job");
    if (jobParam && user && !selectedJob && !isLoading && !settingsLoading) {
      startInterview(jobParam);
    }
  }, [user, settingsLoading]);

  // beforeunload warning during active interview
  useEffect(() => {
    if (!interviewId || isCompleted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [interviewId, isCompleted]);

  // Cleanup on unmount — use sendBeacon to mark interview as completed
  useEffect(() => {
    return () => {
      const id = interviewIdRef.current;
      if (id && !completedRef.current) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-interview`;
        const body = JSON.stringify({ interview_id: id });
        navigator.sendBeacon(url, body);
      }
    };
  }, []);

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

    // Update context summary
    contextSummaryRef.current += `\nسؤال ${questionCount}: ${messages[messages.length - 1]?.content?.substring(0, 100) || ""}\nإجابة: ${answerText.trim().substring(0, 150)}`;

    const vacancyId = searchParams.get("vacancy_id");

    try {
      // Use optimized path: context_summary + last_answer
      const resp = await supabase.functions.invoke("chat", {
        body: {
          context_summary: contextSummaryRef.current,
          last_answer: answerText.trim(),
          job_position: selectedJob,
          interview_type: type,
          vacancy_id: vacancyId,
          user_id: user?.id,
        },
      });
      if (resp.error) throw resp.error;
      let aiReply = resp.data?.choices?.[0]?.message?.content || "";
      const isFollowUp = aiReply.startsWith("[FOLLOW_UP]");
      aiReply = aiReply.replace(/^\[(NEW_Q|FOLLOW_UP)\]\s*/, "");
      setMessages((prev) => [...prev, { role: "assistant", content: aiReply }]);
      if (!isFollowUp) {
        setQuestionCount((c) => c + 1);
      }

      // Auto-end when last question is answered
      if (lastQuestionRef.current) {
        lastQuestionRef.current = false;
        setIsLoading(false);
        await confirmEnd();
        return;
      }

      // Mark if the next answer will be the last
      if (!isFollowUp && questionCount + 1 >= totalQuestions) {
        lastQuestionRef.current = true;
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
    setIsLoading(false);
  }, [messages, isLoading, interviewId, selectedJob, questionCount, totalQuestions, type, searchParams]);

  const confirmEnd = useCallback(async () => {
    if (!interviewId || !user) return;

    setIsCompleted(true);
    completedRef.current = true;
    toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم في الخلفية...");
    navigate("/dashboard");

    // Fire-and-forget: update DB and run evaluation in background
    (async () => {
      try {
        await supabase
          .from("interviews")
          .update({ status: "completed" as any })
          .eq("id", interviewId);

        const vacancyId = searchParams.get("vacancy_id");
        if (vacancyId) {
          await supabase
            .from("job_applications")
            .update({ status: "interviewed" } as any)
            .eq("vacancy_id", vacancyId)
            .eq("user_id", user.id);
        }

        await supabase.functions.invoke("evaluate-interview", {
          body: { interview_id: interviewId },
        });
      } catch (err) {
        console.error("Background evaluation failed:", err);
      }
    })();
  }, [interviewId, user, searchParams, navigate]);

  const abort = useCallback(async () => {
    if (!interviewId) return;
    completedRef.current = true;
    await supabase
      .from("interviews")
      .update({ status: "completed" as any })
      .eq("id", interviewId);
    navigate("/dashboard");
  }, [interviewId, navigate]);

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
    confirmEnd,
    abort,
    setMessages,
  };
};
