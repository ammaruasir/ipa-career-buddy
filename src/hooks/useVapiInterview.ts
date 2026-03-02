import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Vapi from "@vapi-ai/web";

interface TranscriptEntry {
  role: "assistant" | "user";
  text: string;
}

interface UseVapiInterviewOptions {
  type: "voice" | "video";
  jobPosition: string;
  totalQuestions: number;
  onCompleted?: () => void;
}

export const useVapiInterview = ({
  type,
  jobPosition,
  totalQuestions,
  onCompleted,
}: UseVapiInterviewOptions) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const vapiRef = useRef<Vapi | null>(null);
  const interviewIdRef = useRef<string | null>(null);
  const questionCountRef = useRef(0);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  // Keep refs in sync
  useEffect(() => {
    interviewIdRef.current = interviewId;
  }, [interviewId]);

  useEffect(() => {
    questionCountRef.current = questionCount;
  }, [questionCount]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const startCall = useCallback(async () => {
    if (!user || !jobPosition) return;

    setIsConnecting(true);

    try {
      // Create interview record
      const { data: interview, error } = await supabase
        .from("interviews")
        .insert({
          user_id: user.id,
          type: type as any,
          job_position: jobPosition,
          status: "in_progress" as any,
        })
        .select()
        .single();

      if (error || !interview) {
        toast.error("حدث خطأ في بدء المقابلة");
        setIsConnecting(false);
        return;
      }

      setInterviewId(interview.id);
      interviewIdRef.current = interview.id;

      // Get Vapi public key
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("vapi-token");
      if (tokenError || !tokenData?.publicKey) {
        toast.error("فشل في الاتصال بخدمة المقابلة المباشرة");
        setIsConnecting(false);
        return;
      }

      const vapi = new Vapi(tokenData.publicKey);
      vapiRef.current = vapi;

      // Set up event listeners
      vapi.on("call-start", () => {
        setIsCallActive(true);
        setIsConnecting(false);
        setQuestionCount(1);
        questionCountRef.current = 1;
      });

      vapi.on("call-end", async () => {
        setIsCallActive(false);
        setIsSpeaking(false);
        await handleCallEnd();
      });

      vapi.on("speech-start", () => {
        setIsSpeaking(true);
      });

      vapi.on("speech-end", () => {
        setIsSpeaking(false);
      });

      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") {
          const entry: TranscriptEntry = {
            role: msg.role === "assistant" ? "assistant" : "user",
            text: msg.transcript,
          };
          setTranscript((prev) => [...prev, entry]);

          // Count questions by tracking Q&A pairs — only increment
          // when user answers (meaning a new question cycle completed)
          if (msg.role === "user") {
            setQuestionCount((prev) => {
              const newCount = prev + 1;
              questionCountRef.current = newCount;
              return newCount;
            });
          }
        }
      });

      vapi.on("error", (error: any) => {
        console.error("Vapi error:", error);
        toast.error("حدث خطأ في الاتصال");
      });

      // Build system prompt — strict Arabic-only with English meta-instruction
      const systemPrompt = `CRITICAL INSTRUCTION: You MUST speak ONLY in Arabic (العربية). Never use English under any circumstances. Every single word you say must be in Modern Standard Arabic (العربية الفصحى). If the user speaks English, still respond in Arabic.

أنت محاور ذكي متخصص في إجراء مقابلات وظيفية احترافية.

## تعليمات صارمة:
- تحدث باللغة العربية الفصحى فقط. لا تستخدم أي كلمة إنجليزية أبداً.
- أنت تجري مقابلة وظيفية لمنصب: ${jobPosition}.
- اطرح ${totalQuestions} أسئلة بالترتيب التالي:
  • السؤال 1-2: أسئلة سلوكية عن خبرات سابقة
  • السؤال 3-5: أسئلة تقنية متعلقة بـ ${jobPosition}
  • السؤال 6-7: أسئلة موقفية (ماذا ستفعل لو...)
  • السؤال 8: سؤال عن التوافق الثقافي والعمل الجماعي
- اطرح سؤالاً واحداً فقط في كل مرة.
- انتظر إجابة المرشح الكاملة قبل طرح السؤال التالي.
- علّق بإيجاز (جملة أو جملتين) على كل إجابة قبل الانتقال للسؤال التالي.
- حافظ على لهجة مهنية ودودة طوال المقابلة.
- بعد آخر سؤال، اشكر المرشح وأخبره أن التقييم سيكون جاهزاً قريباً.
- لا تكرر الأسئلة ولا تطرح أسئلة خارج نطاق الوظيفة.

REMEMBER: Every word must be in Arabic. No English at all.`;

      // Start the call with proper Arabic assistant config
      await vapi.start({
        name: "المحاور الآلي",
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }],
          language: "ar",
        },
        voice: {
          provider: "azure",
          voiceId: "ar-SA-HamedNeural",
          languageCode: "ar-SA",
        },
        firstMessage: `مرحباً بك! أنا المحاور الآلي وسأجري معك مقابلة لوظيفة ${jobPosition}. سأطرح عليك ${totalQuestions} أسئلة متنوعة. هل أنت مستعد للبدء؟`,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "ar",
        },
        inputMinCharacters: 2,
        responseDelaySeconds: 0.5,
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 1800,
      } as any);
    } catch (error) {
      console.error("Failed to start Vapi call:", error);
      toast.error("فشل في بدء المقابلة المباشرة");
      setIsConnecting(false);
    }
  }, [user, type, jobPosition, totalQuestions]);

  const handleCallEnd = useCallback(async () => {
    const currentInterviewId = interviewIdRef.current;
    const currentTranscript = transcriptRef.current;

    if (!currentInterviewId || currentTranscript.length === 0) return;

    // Save transcript entries as responses
    const questions: string[] = [];
    const answers: string[] = [];

    currentTranscript.forEach((entry) => {
      if (entry.role === "assistant") {
        questions.push(entry.text);
      } else {
        answers.push(entry.text);
      }
    });

    // Pair questions with answers
    const pairs = Math.min(questions.length, answers.length);
    for (let i = 0; i < pairs; i++) {
      await supabase.from("responses").insert({
        interview_id: currentInterviewId,
        question_text: questions[i],
        answer_text: answers[i],
      });
    }

    // Mark interview as completed
    await supabase
      .from("interviews")
      .update({ status: "completed" as any })
      .eq("id", currentInterviewId);

    setIsCompleted(true);
    toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم...");

    // Trigger evaluation
    setIsEvaluating(true);
    try {
      const evalResp = await supabase.functions.invoke("evaluate-interview", {
        body: { interview_id: currentInterviewId },
      });
      if (evalResp.error) {
        toast.error("حدث خطأ في التقييم");
      } else {
        toast.success("تم إعداد التقييم بنجاح!");
        navigate(`/interview/${currentInterviewId}/results`);
      }
    } catch {
      toast.error("حدث خطأ في التقييم");
    }
    setIsEvaluating(false);
    onCompleted?.();
  }, [navigate, onCompleted]);

  const endCall = useCallback(() => {
    vapiRef.current?.stop();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
    };
  }, []);

  return {
    isCallActive,
    isConnecting,
    isSpeaking,
    transcript,
    interviewId,
    questionCount,
    totalQuestions,
    isCompleted,
    isEvaluating,
    startCall,
    endCall,
  };
};
