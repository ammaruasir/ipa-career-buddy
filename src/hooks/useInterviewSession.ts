import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { stripPhaseTags } from "@/lib/arabic-utils";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type Phase = "intro" | "core" | "closing" | "end";
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
  const [currentPhase, setCurrentPhase] = useState<Phase>("intro");
  const [coreQuestionCount, setCoreQuestionCount] = useState(0);

  const contextSummaryRef = useRef<string>("");
  const interviewIdRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const lastQuestionRef = useRef(false);
  const currentPhaseRef = useRef<Phase>("intro");
  const coreQuestionCountRef = useRef(0);

  const totalQuestions = overrideTotalQuestions ?? settings.questions_per_type[type] ?? 8;
  const timerDuration = settings.time_per_question[type] ?? 300;
  const interviewer = settings.interviewer_voice;

  const startInterview = useCallback(async (job: string) => {
    if (!user) return;
    setSelectedJob(job);
    setIsLoading(true);
    contextSummaryRef.current = "";

    // P0.1: read practice flag from URL — defaults to assessment for legacy behavior
    const isPractice = searchParams.get("practice") === "true";
    const mode = isPractice ? "practice" : "assessment";
    const visibility = isPractice ? "private" : "hr";

    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({
        user_id: user.id,
        type: type as any,
        job_position: job,
        status: "in_progress" as any,
        mode: mode as any,
        visibility: visibility as any,
      })
      .select()
      .single();

    if (error || !interview) {
      toast.error("حدث خطأ في بدء المقابلة");
      setIsLoading(false);
      return;
    }

    setInterviewId(interview.id);
    interviewIdRef.current = interview.id;

    // P0.1: practice mode does not feed the hiring pipeline
    const vacancyId = searchParams.get("vacancy_id");
    if (vacancyId && !isPractice) {
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
          interviewer_name: interviewer?.name,
          interviewer_gender: interviewer?.gender,
          current_phase: "intro",
          core_question_count: 0,
          total_questions: totalQuestions,
        },
      });
      if (resp.error) throw resp.error;
      let aiReply = resp.data?.choices?.[0]?.message?.content || "مرحباً! دعنا نبدأ المقابلة.";
      aiReply = stripPhaseTags(aiReply).cleaned;
      setMessages([{ role: "assistant", content: aiReply }]);
      setQuestionCount(1);
      setCurrentPhase("intro");
      currentPhaseRef.current = "intro";
    } catch {
      toast.error("حدث خطأ في الاتصال بمحرك واكب للذكاء الاصطناعي");
    }
    setIsLoading(false);
  }, [user, type, totalQuestions, searchParams, interviewer]);

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
      // Send a trailing slice of conversation (last 10 turns) alongside the summary
      // so the AI has both global context and recent verbatim history.
      const recentTail = newMessages.slice(-10);
      const resp = await supabase.functions.invoke("chat", {
        body: {
          context_summary: contextSummaryRef.current,
          last_answer: answerText.trim(),
          messages: recentTail,
          job_position: selectedJob,
          interview_type: type,
          vacancy_id: vacancyId,
          user_id: user?.id,
          interviewer_name: interviewer?.name,
          interviewer_gender: interviewer?.gender,
          current_phase: currentPhaseRef.current,
          core_question_count: coreQuestionCountRef.current,
          total_questions: totalQuestions,
        },
      });
      if (resp.error) throw resp.error;
      const rawReply = resp.data?.choices?.[0]?.message?.content || "";
      const { cleaned: aiReply, phase: localPhase } = stripPhaseTags(rawReply);
      const phaseTag = (resp.data?.phase as string | undefined)?.toUpperCase() || localPhase || null;

      setMessages((prev) => [...prev, { role: "assistant", content: aiReply }]);

      const isFollowUp = phaseTag === "FOLLOW_UP";
      if (phaseTag === "INTRO") { setCurrentPhase("intro"); currentPhaseRef.current = "intro"; }
      else if (phaseTag === "CORE") {
        setCurrentPhase("core"); currentPhaseRef.current = "core";
        const next = coreQuestionCountRef.current + 1;
        coreQuestionCountRef.current = next;
        setCoreQuestionCount(next);
      } else if (phaseTag === "CLOSING") {
        setCurrentPhase("closing"); currentPhaseRef.current = "closing";
      }

      if (!isFollowUp) setQuestionCount((c) => c + 1);

      if (phaseTag === "END" || lastQuestionRef.current) {
        lastQuestionRef.current = false;
        setIsLoading(false);
        await confirmEnd();
        return;
      }

      if (!isFollowUp && questionCount + 1 >= totalQuestions) {
        lastQuestionRef.current = true;
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
    setIsLoading(false);
  }, [messages, isLoading, interviewId, selectedJob, questionCount, totalQuestions, type, searchParams, interviewer]);

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
    currentPhase,
    coreQuestionCount,
    startInterview,
    sendAnswer,
    confirmEnd,
    abort,
    setMessages,
  };
};
