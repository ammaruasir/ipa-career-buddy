import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();

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
  const contextSummaryRef = useRef<string>("");
  const vacancyIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);
  const stoppedManuallyRef = useRef(false);
  
  // Session recording refs
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionChunksRef = useRef<Blob[]>([]);

  // Sync refs
  useEffect(() => { interviewIdRef.current = interviewId; }, [interviewId]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { questionCountRef.current = questionCount; }, [questionCount]);

  // Speak text using ElevenLabs TTS and resolve when done
  // Fallback: use browser SpeechSynthesis
  const speakWithBrowserTTS = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ar-SA";
      utterance.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(v => v.lang.startsWith("ar") && v.localService)
        || voices.find(v => v.lang.startsWith("ar"));
      if (arabicVoice) utterance.voice = arabicVoice;
      utterance.onend = () => { setIsSpeaking(false); resolve(); };
      utterance.onerror = () => { setIsSpeaking(false); resolve(); };
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // Clean repeated characters for smoother TTS (e.g. "مررررررة" → "مرة")
  const cleanTextForTTS = (text: string): string => {
    return text.replace(/(.)\1{2,}/g, '$1');
  };

  // Speak text using ElevenLabs TTS with browser fallback
  const speakText = useCallback((text: string): Promise<void> => {
    const cleanedText = cleanTextForTTS(text);
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
            body: JSON.stringify({ text: cleanedText }),
          }
        );

        if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        const cleanup = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setIsSpeaking(false);
          document.removeEventListener("visibilitychange", handleVisibility);
        };

        audio.addEventListener("pause", () => {
          if (activeRef.current && !stoppedManuallyRef.current && !audio.ended) {
            audio.play().catch(() => {});
          }
        });

        const handleVisibility = () => {
          if (!document.hidden && activeRef.current && !stoppedManuallyRef.current) {
            if (audio.paused && !audio.ended) {
              audio.play().catch(() => {});
            }
          }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); resolve(); };

        await audio.play();
      } catch (error) {
        console.error("ElevenLabs TTS failed, falling back to browser TTS:", error);
        currentAudioRef.current = null;
        setIsSpeaking(false);
        // Fallback to browser TTS
        await speakWithBrowserTTS(text);
        resolve();
      }
    });
  }, [speakWithBrowserTTS]);

  // Start recording microphone with silence detection
  const startListening = useCallback(async () => {
    if (!activeRef.current || stoppedManuallyRef.current) return;
    
    try {
      // For video interviews, reuse existing video stream's audio track
      let stream: MediaStream;
      if (type === "video" && videoStreamRef.current) {
        const audioTrack = videoStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          stream = new MediaStream([audioTrack]);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Don't stop video tracks, only stop audio-only streams
        if (type !== "video") {
          stream.getTracks().forEach(t => t.stop());
        }
        ctx.close().catch(() => {});
        setIsListening(false);
        cancelAnimationFrame(rafRef.current);
        if (maxRecordingTimer) clearTimeout(maxRecordingTimer);
        if (blob.size > 0 && activeRef.current && !stoppedManuallyRef.current) {
          handleRecordingComplete(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsListening(true);

      const maxRecordingTimer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 45000);

      // Silence detection
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;
      let speechDetected = false;
      const SILENCE_THRESHOLD = 30;
      const SILENCE_DURATION = 1200;

      const checkSilence = () => {
        if (!activeRef.current || stoppedManuallyRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length);

        if (!speechDetected) {
          if (rms > SILENCE_THRESHOLD) speechDetected = true;
          rafRef.current = requestAnimationFrame(checkSilence);
          return;
        }

        if (rms < SILENCE_THRESHOLD) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart > SILENCE_DURATION) {
            if (recorder.state === "recording") recorder.stop();
            return;
          }
        } else {
          silenceStart = null;
        }

        rafRef.current = requestAnimationFrame(checkSilence);
      };

      setTimeout(() => {
        if (activeRef.current && !stoppedManuallyRef.current) {
          rafRef.current = requestAnimationFrame(checkSilence);
        }
      }, 600);

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
      let responseId: string | null = null;
      if (interviewIdRef.current) {
        const lastAssistant = conversationRef.current.filter(m => m.role === "assistant").pop();
        const { data: respData } = await supabase.from("responses").insert({
          interview_id: interviewIdRef.current,
          question_text: lastAssistant?.content || "",
          answer_text: userText,
        }).select("id").single();
        responseId = respData?.id || null;
      }

      // Capture and analyze video frames for video interviews
      if (type === "video" && responseId && videoElementRef.current) {
        captureAndAnalyzeFrames(responseId, userText, conversationRef.current.filter(m => m.role === "assistant").pop()?.content || "");
      }

      // Update context summary with key points
      contextSummaryRef.current += `\nسؤال ${questionCountRef.current}: ${conversationRef.current.filter(m => m.role === "assistant").pop()?.content?.substring(0, 100) || ""}\nإجابة مختصرة: ${userText.substring(0, 150)}`;

      // Get next AI response - question count will be updated based on [NEW_Q]/[FOLLOW_UP] tag
      await getNextAIResponse(userText);

    } catch (error) {
      console.error("Recording processing error:", error);
      setIsTranscribing(false);
      toast.error("حدث خطأ في معالجة الإجابة");
      if (activeRef.current && !stoppedManuallyRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, [totalQuestions]);

  // Capture frames from video and send to analyze-video (fire and forget)
  const captureAndAnalyzeFrames = useCallback((responseId: string, answerText: string, questionText: string) => {
    try {
      const video = videoElementRef.current;
      if (!video || video.videoWidth === 0) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Capture single frame (the end of the answer)
      ctx.drawImage(video, 0, 0);
      const frame = canvas.toDataURL("image/jpeg", 0.6);

      // Fire and forget - don't block interview flow
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          response_id: responseId,
          frames: [frame],
          answer_text: answerText,
          question_text: questionText,
        }),
      }).catch(err => console.error("Video analysis failed:", err));
    } catch (err) {
      console.error("Frame capture error:", err);
    }
  }, []);

  // Get next question from AI - latency optimized
  const getNextAIResponse = useCallback(async (lastAnswer?: string) => {
    if (!activeRef.current || stoppedManuallyRef.current) return;
    
    setIsProcessing(true);
    try {
      const body: any = {
        job_position: jobPosition,
        interview_type: type,
        vacancy_id: vacancyIdRef.current,
      };

      if (lastAnswer && contextSummaryRef.current) {
        // Optimized: send only summary + last answer
        body.context_summary = contextSummaryRef.current;
        body.last_answer = lastAnswer;
      } else {
        // First call or fallback: send full messages
        body.messages = conversationRef.current;
      }

      const { data, error } = await supabase.functions.invoke("chat", { body });

      if (error) throw error;

      let aiText = data?.choices?.[0]?.message?.content || data?.content || "";
      if (!aiText) throw new Error("Empty AI response");

      // Handle [NEW_Q]/[FOLLOW_UP] tags
      const isFollowUp = aiText.startsWith("[FOLLOW_UP]");
      aiText = aiText.replace(/^\[(NEW_Q|FOLLOW_UP)\]\s*/, "");

      setIsProcessing(false);

      // Stream text character by character while speaking
      const streamTextToTranscript = (): Promise<void> => {
        return new Promise((resolve) => {
          const entryIndex = transcriptRef.current.length;
          const emptyEntry: TranscriptEntry = { role: "assistant", text: "" };
          transcriptRef.current = [...transcriptRef.current, emptyEntry];
          setTranscript([...transcriptRef.current]);

          let charIndex = 0;
          const interval = setInterval(() => {
            charIndex++;
            if (charIndex <= aiText.length) {
              const updated = [...transcriptRef.current];
              updated[entryIndex] = { role: "assistant", text: aiText.slice(0, charIndex) };
              transcriptRef.current = updated;
              setTranscript([...updated]);
            } else {
              clearInterval(interval);
              resolve();
            }
          }, 30);
        });
      };

      conversationRef.current.push({ role: "assistant", content: aiText });

      // Only increment question count for new questions
      if (!isFollowUp) {
        const newCount = questionCountRef.current + 1;
        setQuestionCount(newCount);
        questionCountRef.current = newCount;

        if (newCount >= totalQuestions) {
          await speakText(aiText);
          transcriptRef.current = [...transcriptRef.current, { role: "assistant", text: aiText }];
          setTranscript([...transcriptRef.current]);
          await getClosingResponse();
          return;
        }
      }

      // Speak first, then show text after audio finishes
      await speakText(aiText);
      transcriptRef.current = [...transcriptRef.current, { role: "assistant", text: aiText }];
      setTranscript([...transcriptRef.current]);
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
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(rafRef.current);

    const currentId = interviewIdRef.current;
    if (!currentId) return;

    // Stop session recorder and wait for onstop event to ensure all chunks are collected
    if (sessionRecorderRef.current?.state === "recording") {
      await new Promise<void>((resolve) => {
        const recorder = sessionRecorderRef.current!;
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
    
    const sessionBlob = new Blob(sessionChunksRef.current, { type: "video/webm" });
    console.log(`[Recording] Session blob size: ${sessionBlob.size} bytes, chunks: ${sessionChunksRef.current.length}`);
    
    if (sessionBlob.size > 0 && user) {
      try {
        const fileName = `${user.id}/${currentId}_full.webm`;
        const { error: uploadErr } = await supabase.storage
          .from("interview-recordings")
          .upload(fileName, sessionBlob, { contentType: "video/webm", upsert: true });
        
        if (uploadErr) {
          console.error("[Recording] Upload failed:", uploadErr);
        } else {
          console.log("[Recording] Upload successful:", fileName);
          const { data: urlData } = supabase.storage
            .from("interview-recordings")
            .getPublicUrl(fileName);
          
          await supabase
            .from("interviews")
            .update({ recording_url: urlData.publicUrl } as any)
            .eq("id", currentId);
        }
      } catch (err) {
        console.error("[Recording] Failed to upload session recording:", err);
      }
    } else {
      console.warn("[Recording] No recording data to upload — blob size:", sessionBlob.size);
    }

    await supabase
      .from("interviews")
      .update({ status: "completed" as any })
      .eq("id", currentId);

    // Update job application status
    if (vacancyIdRef.current) {
      await supabase
        .from("job_applications")
        .update({ status: "interviewed" } as any)
        .eq("vacancy_id", vacancyIdRef.current)
        .eq("user_id", user.id);
    }

    setIsCompleted(true);
    toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم...");

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
  }, [navigate, user]);

  // Get closing response from AI before ending
  const getClosingResponse = useCallback(async () => {
    if (!activeRef.current || stoppedManuallyRef.current) return;
    
    setIsProcessing(true);
    try {
      const closingPrompt = "هذا كان آخر سؤال. اشكر المرشح على وقته وإجاباته، أخبره إن التقييم بيوصله قريب، وتمنّى له التوفيق. خلّها جملة ودية قصيرة.";
      
      conversationRef.current.push({ role: "user", content: closingPrompt });

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          job_position: jobPosition,
          interview_type: type,
          messages: conversationRef.current,
        },
      });

      if (error) throw error;

      const closingText = data?.choices?.[0]?.message?.content || data?.content || "شكراً لك على وقتك وإجاباتك الرائعة! بيوصلك التقييم قريب إن شاء الله. بالتوفيق!";
      
      setIsProcessing(false);

      const closingEntry: TranscriptEntry = { role: "assistant", text: closingText };
      setTranscript(prev => [...prev, closingEntry]);

      await speakText(closingText);
      await endInterview();
    } catch (error) {
      console.error("Closing response error:", error);
      setIsProcessing(false);
      const fallback = "شكراً لك على وقتك! بيوصلك التقييم قريب إن شاء الله. بالتوفيق!";
      const fallbackEntry: TranscriptEntry = { role: "assistant", text: fallback };
      setTranscript(prev => [...prev, fallbackEntry]);
      await speakText(fallback);
      await endInterview();
    }
  }, [jobPosition, type, speakText, endInterview]);

  // Start the live interview
  const startCall = useCallback(async () => {
    if (!user || !jobPosition) return;
    setIsStarting(true);
    stoppedManuallyRef.current = false;
    contextSummaryRef.current = "";

    // Get vacancy_id from URL params
    const vacancyId = searchParams.get("vacancy_id");
    vacancyIdRef.current = vacancyId;

    try {
      // For video interviews, request camera + mic upfront
      if (type === "video") {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          videoStreamRef.current = videoStream;
        } catch {
          toast.error("لم يتم السماح بالوصول إلى الكاميرا");
          setIsStarting(false);
          return;
        }
      }

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

      // Start session recording
      const recordingStream = type === "video" && videoStreamRef.current
        ? videoStreamRef.current
        : await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      
      if (recordingStream) {
        try {
          const sessionRecorder = new MediaRecorder(recordingStream, { 
            mimeType: type === "video" ? "video/webm" : "audio/webm" 
          });
          sessionChunksRef.current = [];
          sessionRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) sessionChunksRef.current.push(e.data);
          };
          sessionRecorder.start(5000);
          sessionRecorderRef.current = sessionRecorder;
        } catch (err) {
          console.error("Failed to start session recorder:", err);
        }
      }

      // Link to job application if vacancy_id present
      if (vacancyId) {
        await supabase
          .from("job_applications")
          .update({ interview_id: interview.id, status: "interviewing" } as any)
          .eq("vacancy_id", vacancyId)
          .eq("user_id", user.id);
      }

      // Build conversational system prompt
      const systemPrompt = `CRITICAL INSTRUCTION: You MUST speak ONLY in Arabic (العربية). Never use English.

اسمك "أحمد" وأنت محاور وظيفي ودود ومحترف تعمل في السعودية.
- الوظيفة: ${jobPosition}
- تتكلم بلهجة سعودية مهنية ودودة.
- علّق بجملة قصيرة على إجابة المرشح قبل السؤال التالي (مثل: "حلو"، "ممتاز"، "فهمت عليك").
- استخدم انتقالات طبيعية: "طيب"، "حلو خلنا نشوف"، "تمام، بسألك الحين عن...".
- اطرح سؤالاً واحداً فقط. أقصى 2-3 جمل. أبقِ الرد أقل من 80 كلمة.
- لا تلخص إجابة المرشح. لا تكرر ما قاله.
- عدّل الصعوبة ديناميكياً بناءً على جودة الإجابة.
- لا تساعد المرشح. لا تقدم تلميحات.
- اطرح ${totalQuestions} أسئلة متنوعة (سلوكية، تقنية، موقفية، توافق ثقافي).
- نوّع أسلوبك: أحياناً اسأل مباشرة، أحياناً اطرح موقف.`;

      const firstMessage = `هلا والله! أنا أحمد، بكون معك اليوم في المقابلة لوظيفة ${jobPosition}. عندنا ${totalQuestions} أسئلة، بس لا تشيل هم — خلّها دردشة عادية. جاهز نبدأ؟`;

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

      await speakText(firstMessage);
      if (activeRef.current && !stoppedManuallyRef.current) {
        await startListening();
      }
    } catch (error) {
      console.error("Failed to start live interview:", error);
      toast.error("فشل في بدء المقابلة المباشرة");
      setIsStarting(false);
    }
  }, [user, type, jobPosition, totalQuestions, speakText, startListening, searchParams]);

  const endCall = useCallback(() => { endInterview(); }, [endInterview]);

  // Cleanup on unmount — mark interview as completed if still in progress
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stoppedManuallyRef.current = true;
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // Mark interview as completed if still in progress (user left or navigated away)
      const id = interviewIdRef.current;
      if (id && !isCompleted) {
        supabase
          .from("interviews")
          .update({ status: "completed" as any })
          .eq("id", id)
          .then(() => {});
      }
    };
  }, [isCompleted]);

  const submitAnswer = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

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
    submitAnswer,
    videoStream: videoStreamRef.current,
    videoElementRef,
  };
};
