import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TranscriptEntry {
  role: "assistant" | "user";
  text: string;
}

interface UseLiveInterviewOptions {
  type: "voice" | "video";
  jobPosition: string;
  totalQuestions: number;
}

export const useLiveInterview = ({
  type,
  jobPosition,
  totalQuestions,
}: UseLiveInterviewOptions) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const interviewIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const questionCountRef = useRef(0);
  const conversationRef = useRef<{ role: string; content: string }[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);
  const stoppedManuallyRef = useRef(false);

  // Sync refs
  useEffect(() => { interviewIdRef.current = interviewId; }, [interviewId]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { questionCountRef.current = questionCount; }, [questionCount]);

  // Speak text using ElevenLabs TTS and resolve when done
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      setIsSpeaking(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text }),
          }
        );

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          resolve();
        };

        await audio.play();
      } catch (error) {
        console.error("ElevenLabs TTS error:", error);
        setIsSpeaking(false);
        resolve();
      }
    });
  }, []);

  // Start recording microphone with silence detection
  const startListening = useCallback(async () => {
    if (!activeRef.current || stoppedManuallyRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        console.log("[LiveInterview] Recorder stopped, chunks:", chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
        setIsListening(false);
        cancelAnimationFrame(rafRef.current);
        if (maxRecordingTimer) clearTimeout(maxRecordingTimer);
        if (blob.size > 0 && activeRef.current && !stoppedManuallyRef.current) {
          handleRecordingComplete(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // timeslice: fire ondataavailable every 1s
      setIsListening(true);
      console.log("[LiveInterview] Recording started with 1s timeslice");

      // Max recording timeout fallback (45s)
      const maxRecordingTimer = setTimeout(() => {
        console.log("[LiveInterview] Max recording timeout (45s) reached, force-stopping");
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 45000);

      // Silence detection loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;
      let speechDetected = false;
      const SILENCE_THRESHOLD = 30;
      const SILENCE_DURATION = 2000; // ms
      let logCounter = 0;

      const checkSilence = () => {
        if (!activeRef.current || stoppedManuallyRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length);

        // Log RMS periodically (every ~60 frames ≈ 1s)
        logCounter++;
        if (logCounter % 60 === 0) {
          console.log("[LiveInterview] RMS:", rms.toFixed(1), "speechDetected:", speechDetected);
        }

        // Require speech before detecting silence
        if (!speechDetected) {
          if (rms > SILENCE_THRESHOLD) {
            speechDetected = true;
            console.log("[LiveInterview] Speech detected, RMS:", rms.toFixed(1));
          }
          rafRef.current = requestAnimationFrame(checkSilence);
          return;
        }

        if (rms < SILENCE_THRESHOLD) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart > SILENCE_DURATION) {
            console.log("[LiveInterview] Silence detected after speech, stopping recorder");
            if (recorder.state === "recording") {
              recorder.stop();
            }
            return;
          }
        } else {
          silenceStart = null;
        }

        rafRef.current = requestAnimationFrame(checkSilence);
      };

      // Wait a moment before starting silence detection
      setTimeout(() => {
        if (activeRef.current && !stoppedManuallyRef.current) {
          console.log("[LiveInterview] Starting silence detection loop");
          rafRef.current = requestAnimationFrame(checkSilence);
        }
      }, 1500);

    } catch {
      toast.error("لم يتم السماح بالوصول إلى الميكروفون");
      setIsListening(false);
    }
  }, []);

  // Process recorded audio
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    if (!activeRef.current || stoppedManuallyRef.current) return;
    
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Transcription failed");

      const data = await response.json();
      const userText = data.transcription?.trim();
      setIsTranscribing(false);

      if (!userText || userText.length < 2) {
        toast.warning("لم يتم التعرف على كلام، حاول مرة أخرى");
        // Re-listen
        if (activeRef.current && !stoppedManuallyRef.current) {
          setTimeout(() => startListening(), 500);
        }
        return;
      }

      // Add user response to transcript
      const userEntry: TranscriptEntry = { role: "user", text: userText };
      setTranscript(prev => [...prev, userEntry]);
      conversationRef.current.push({ role: "user", content: userText });

      // Save response to DB
      if (interviewIdRef.current) {
        const lastAssistant = conversationRef.current.filter(m => m.role === "assistant").pop();
        await supabase.from("responses").insert({
          interview_id: interviewIdRef.current,
          question_text: lastAssistant?.content || "",
          answer_text: userText,
        });
      }

      // Check if interview should end
      const newCount = questionCountRef.current + 1;
      setQuestionCount(newCount);
      questionCountRef.current = newCount;

      if (newCount >= totalQuestions) {
        await endInterview();
        return;
      }

      // Get next AI response
      await getNextAIResponse();

    } catch (error) {
      console.error("Recording processing error:", error);
      setIsTranscribing(false);
      toast.error("حدث خطأ في معالجة الإجابة");
      if (activeRef.current && !stoppedManuallyRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, [totalQuestions]);

  // Get next question from AI
  const getNextAIResponse = useCallback(async () => {
    if (!activeRef.current || stoppedManuallyRef.current) return;
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: conversationRef.current,
          job_position: jobPosition,
          interview_type: type,
        },
      });

      if (error) throw error;

      const aiText = data?.choices?.[0]?.message?.content || data?.content || "";
      if (!aiText) throw new Error("Empty AI response");

      setIsProcessing(false);

      const aiEntry: TranscriptEntry = { role: "assistant", text: aiText };
      setTranscript(prev => [...prev, aiEntry]);
      conversationRef.current.push({ role: "assistant", content: aiText });

      // Speak and then listen
      await speakText(aiText);
      if (activeRef.current && !stoppedManuallyRef.current) {
        await startListening();
      }
    } catch (error) {
      console.error("AI response error:", error);
      setIsProcessing(false);
      toast.error("حدث خطأ في الحصول على السؤال التالي");
    }
  }, [jobPosition, type, speakText, startListening]);

  // End interview and evaluate
  const endInterview = useCallback(async () => {
    activeRef.current = false;
    stoppedManuallyRef.current = true;
    setIsActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    // Stop any active recording
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(rafRef.current);

    const currentId = interviewIdRef.current;
    if (!currentId) return;

    // Mark completed
    await supabase
      .from("interviews")
      .update({ status: "completed" as any })
      .eq("id", currentId);

    setIsCompleted(true);
    toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم...");

    // Evaluate
    setIsEvaluating(true);
    try {
      const resp = await supabase.functions.invoke("evaluate-interview", {
        body: { interview_id: currentId },
      });
      if (resp.error) {
        toast.error("حدث خطأ في التقييم");
      } else {
        toast.success("تم إعداد التقييم بنجاح!");
        navigate(`/interview/${currentId}/results`);
      }
    } catch {
      toast.error("حدث خطأ في التقييم");
    }
    setIsEvaluating(false);
  }, [navigate]);

  // Start the live interview
  const startCall = useCallback(async () => {
    if (!user || !jobPosition) return;
    setIsStarting(true);
    stoppedManuallyRef.current = false;

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
        setIsStarting(false);
        return;
      }

      setInterviewId(interview.id);
      interviewIdRef.current = interview.id;

      // Build system prompt
      const systemPrompt = `CRITICAL INSTRUCTION: You MUST speak ONLY in Arabic (العربية). Never use English under any circumstances.

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

      const firstMessage = `مرحباً بك! أنا المحاور الآلي وسأجري معك مقابلة لوظيفة ${jobPosition}. سأطرح عليك ${totalQuestions} أسئلة متنوعة. هل أنت مستعد للبدء؟`;

      // Initialize conversation
      conversationRef.current = [
        { role: "system", content: systemPrompt },
        { role: "assistant", content: firstMessage },
      ];

      const firstEntry: TranscriptEntry = { role: "assistant", text: firstMessage };
      setTranscript([firstEntry]);
      setQuestionCount(1);
      questionCountRef.current = 1;

      activeRef.current = true;
      setIsActive(true);
      setIsStarting(false);

      // Speak first message, then start listening
      await speakText(firstMessage);
      if (activeRef.current && !stoppedManuallyRef.current) {
        await startListening();
      }
    } catch (error) {
      console.error("Failed to start live interview:", error);
      toast.error("فشل في بدء المقابلة المباشرة");
      setIsStarting(false);
    }
  }, [user, type, jobPosition, totalQuestions, speakText, startListening]);

  // End call manually
  const endCall = useCallback(() => {
    endInterview();
  }, [endInterview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stoppedManuallyRef.current = true;
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  return {
    isCallActive: isActive,
    isConnecting: isStarting,
    isSpeaking,
    isListening,
    isTranscribing,
    isProcessing,
    isEvaluating,
    isCompleted,
    transcript,
    interviewId,
    questionCount,
    startCall,
    endCall,
  };
};
