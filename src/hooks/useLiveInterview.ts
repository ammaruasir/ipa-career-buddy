import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import fixWebmDuration from "fix-webm-duration";

interface TranscriptEntry {
  role: "assistant" | "user";
  text: string;
}

interface UseLiveInterviewOptions {
  type: "voice" | "video";
  jobPosition: string;
  totalQuestions: number;
  interviewerName?: string;
  interviewerGender?: "male" | "female";
  interviewerVoiceId?: string;
}

export const useLiveInterview = ({
  type,
  jobPosition,
  totalQuestions,
  interviewerName = "نورة",
  interviewerGender = "female",
  interviewerVoiceId,
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
  const [currentPhase, setCurrentPhase] = useState<"intro" | "core" | "closing" | "end">("intro");
  const [coreQuestionCount, setCoreQuestionCount] = useState(0);

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
  const isEndingRef = useRef(false);
  const lastQuestionRef = useRef(false);
  const endInterviewRef = useRef<(() => Promise<void>) | null>(null);
  
  // Session recording refs
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionChunksRef = useRef<Blob[]>([]);
  const partialUploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUploadedChunkIndexRef = useRef(0);
  const partialUploadFnRef = useRef<(() => Promise<void>) | null>(null);

  // Audio mixing refs — to merge candidate mic + TTS into one recording stream
  const mixingCtxRef = useRef<AudioContext | null>(null);
  const mixedDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Track recording start time for WebM duration fix
  const sessionRecordingStartRef = useRef<number>(0);

  const userRef = useRef(user);

  // Sync refs
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { interviewIdRef.current = interviewId; }, [interviewId]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { questionCountRef.current = questionCount; }, [questionCount]);

  const currentPhaseRef = useRef<"intro" | "core" | "closing" | "end">("intro");
  const coreQuestionCountRef = useRef(0);
  useEffect(() => { currentPhaseRef.current = currentPhase; }, [currentPhase]);
  useEffect(() => { coreQuestionCountRef.current = coreQuestionCount; }, [coreQuestionCount]);

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
            body: JSON.stringify({ text: cleanedText, voiceId: interviewerVoiceId }),
          }
        );

        if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.crossOrigin = "anonymous";
        currentAudioRef.current = audio;

        // Connect TTS audio to the mixed recording destination (if available)
        let ttsSource: MediaElementAudioSourceNode | null = null;
        if (mixingCtxRef.current && mixedDestRef.current) {
          try {
            ttsSource = mixingCtxRef.current.createMediaElementSource(audio);
            ttsSource.connect(mixedDestRef.current); // → recording
            ttsSource.connect(mixingCtxRef.current.destination); // → speakers
          } catch (e) {
            console.warn("[AudioMix] Could not connect TTS to mixing context:", e);
          }
        }

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

      // Always get next AI response — the AI handles phase transitions via tags
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

  // Get next question from AI - latency optimized with phase tracking
  const getNextAIResponse = useCallback(async (lastAnswer?: string) => {
    if (!activeRef.current || stoppedManuallyRef.current) return;
    
    setIsProcessing(true);
    try {
      const body: any = {
        job_position: jobPosition,
        interview_type: type,
        vacancy_id: vacancyIdRef.current,
        user_id: user?.id,
        current_question: questionCountRef.current + 1,
        total_questions: totalQuestions,
        interviewer_name: interviewerName,
        interviewer_gender: interviewerGender,
        current_phase: currentPhaseRef.current,
        core_question_count: coreQuestionCountRef.current,
      };

      if (lastAnswer && contextSummaryRef.current) {
        body.context_summary = contextSummaryRef.current;
        body.last_answer = lastAnswer;
      } else {
        body.messages = conversationRef.current;
      }

      const { data, error } = await supabase.functions.invoke("chat", { body });

      if (error) throw error;

      let aiText = data?.choices?.[0]?.message?.content || data?.content || "";
      if (!aiText) throw new Error("Empty AI response");

      // Parse phase tag from response
      const phaseMatch = aiText.match(/^\[(INTRO|CORE|FOLLOW_UP|CLOSING|END)\]/);
      const phaseTag = phaseMatch ? phaseMatch[1] : null;
      
      // Remove phase tag from display text
      aiText = aiText.replace(/^\[(INTRO|CORE|FOLLOW_UP|CLOSING|END)\]\s*/, "");

      // Handle [END] — interview complete
      if (phaseTag === "END") {
        setIsProcessing(false);
        const endEntry: TranscriptEntry = { role: "assistant", text: aiText };
        setTranscript(prev => [...prev, endEntry]);
        conversationRef.current.push({ role: "assistant", content: aiText });
        setCurrentPhase("end");
        await speakText(aiText);
        if (endInterviewRef.current) await endInterviewRef.current();
        return;
      }

      // Update phase tracking
      if (phaseTag === "INTRO") {
        setCurrentPhase("intro");
      } else if (phaseTag === "CORE") {
        setCurrentPhase("core");
        const newCoreCount = coreQuestionCountRef.current + 1;
        setCoreQuestionCount(newCoreCount);
        coreQuestionCountRef.current = newCoreCount;
        
        // If all core questions done, next response should be closing
        if (newCoreCount >= totalQuestions) {
          lastQuestionRef.current = true;
        }
      } else if (phaseTag === "CLOSING") {
        setCurrentPhase("closing");
      }

      // Increment general question count for non-follow-ups
      const isFollowUp = phaseTag === "FOLLOW_UP";
      if (!isFollowUp) {
        const newCount = questionCountRef.current + 1;
        setQuestionCount(newCount);
        questionCountRef.current = newCount;
      }

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
  }, [jobPosition, type, speakText, startListening, totalQuestions]);

  // End interview and evaluate
  const endInterview = useCallback(async () => {
    activeRef.current = false;
    stoppedManuallyRef.current = true;
    isEndingRef.current = true;
    setIsActive(false);
    setIsCompleted(true);
    setIsListening(false);
    setIsSpeaking(false);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(rafRef.current);
    // Stop partial upload interval
    if (partialUploadIntervalRef.current) {
      clearInterval(partialUploadIntervalRef.current);
      partialUploadIntervalRef.current = null;
    }

    const currentId = interviewIdRef.current;
    if (!currentId) return;

    // Safety: upload partial immediately before stopping recorder
    if (partialUploadFnRef.current) {
      try { await partialUploadFnRef.current(); } catch (e) { console.error("[Recording] Safety partial upload error:", e); }
    }

    // Stop session recorder and wait for onstop event to ensure all chunks are collected
    if (sessionRecorderRef.current?.state === "recording") {
      await new Promise<void>((resolve) => {
        const recorder = sessionRecorderRef.current!;
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
    
    const rawSessionBlob = new Blob(sessionChunksRef.current, { type: "video/webm" });
    console.log(`[Recording] Session blob size: ${rawSessionBlob.size} bytes, chunks: ${sessionChunksRef.current.length}`);
    
    if (rawSessionBlob.size > 0 && user) {
      // Fix WebM duration metadata before upload
      const duration = Date.now() - (sessionRecordingStartRef.current || Date.now());
      let sessionBlob = rawSessionBlob;
      try {
        sessionBlob = await fixWebmDuration(rawSessionBlob, duration);
        console.log(`[Recording] Fixed WebM duration: ${duration}ms`);
      } catch (e) {
        console.warn("[Recording] fixWebmDuration failed, uploading raw blob:", e);
      }

      const fileName = `${user.id}/${currentId}_full.webm`;
      let uploaded = false;
      
      for (let attempt = 0; attempt < 2 && !uploaded; attempt++) {
        try {
          const { error: uploadErr } = await supabase.storage
            .from("interview-recordings")
            .upload(fileName, sessionBlob, { contentType: "video/webm", upsert: true });
          
          if (uploadErr) {
            console.error(`[Recording] Upload attempt ${attempt + 1} failed:`, uploadErr);
          } else {
            console.log("[Recording] Upload successful:", fileName);
            await supabase
              .from("interviews")
              .update({ recording_url: fileName } as any)
              .eq("id", currentId);
            uploaded = true;
            // Delete partial file since full is uploaded
            await supabase.storage
              .from("interview-recordings")
              .remove([`${user.id}/${currentId}_partial.webm`]);
          }
        } catch (err) {
          console.error(`[Recording] Upload attempt ${attempt + 1} error:`, err);
        }
      }
      
      // If full upload failed, set recording_url to partial
      if (!uploaded) {
        await supabase
          .from("interviews")
          .update({ recording_url: `${user.id}/${currentId}_partial.webm` } as any)
          .eq("id", currentId);
      }
    } else {
      console.warn("[Recording] No recording data to upload — blob size:", rawSessionBlob.size);
      // Try to set partial as fallback
      if (user) {
        await supabase
          .from("interviews")
          .update({ recording_url: `${user.id}/${currentId}_partial.webm` } as any)
          .eq("id", currentId);
      }
    }

    // Now stop streams after upload is complete
    streamRef.current?.getTracks().forEach(t => t.stop());
    videoStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close().catch(() => {});
    mixingCtxRef.current?.close().catch(() => {});
    mixingCtxRef.current = null;
    mixedDestRef.current = null;

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
      }
    } catch {
      toast.error("حدث خطأ في التقييم");
    }
    setIsEvaluating(false);
    navigate("/dashboard");
  }, [navigate, user]);

  // Keep ref in sync so getNextAIResponse can call endInterview
  useEffect(() => { endInterviewRef.current = endInterview; }, [endInterview]);

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

      // --- Create audio mixing context for recording ---
      const mixingCtx = new AudioContext();
      mixingCtxRef.current = mixingCtx;
      const mixedDest = mixingCtx.createMediaStreamDestination();
      mixedDestRef.current = mixedDest;

      // Get recording source stream
      const rawRecordingStream = type === "video" && videoStreamRef.current
        ? videoStreamRef.current
        : await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

      if (rawRecordingStream) {
        // Connect mic/camera audio tracks to the mixed destination
        try {
          const micSource = mixingCtx.createMediaStreamSource(rawRecordingStream);
          micSource.connect(mixedDest);
        } catch (e) {
          console.warn("[AudioMix] Could not connect mic to mixing context:", e);
        }

        // Build the combined stream: mixed audio tracks + video tracks (if any)
        const combinedStream = new MediaStream();
        // Add mixed audio tracks
        mixedDest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
        // Add video tracks from original stream (for video interviews)
        if (type === "video") {
          rawRecordingStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        }

        try {
          const sessionRecorder = new MediaRecorder(combinedStream, { 
            mimeType: type === "video" ? "video/webm" : "audio/webm" 
          });
          sessionChunksRef.current = [];
          sessionRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) sessionChunksRef.current.push(e.data);
          };
          sessionRecorder.start(5000);
          sessionRecorderRef.current = sessionRecorder;
          sessionRecordingStartRef.current = Date.now();
          console.log("[AudioMix] Session recorder started with mixed stream");
        } catch (err) {
          console.error("Failed to start session recorder:", err);
        }
      }

      // Start periodic partial upload every 60 seconds
      lastUploadedChunkIndexRef.current = 0;
      const partialUploadFn = async () => {
        const chunks = sessionChunksRef.current;
        if (chunks.length === 0 || !interviewIdRef.current || !user) return;
        try {
          const blob = new Blob(chunks, { type: type === "video" ? "video/webm" : "audio/webm" });
          if (blob.size < 1000) return; // skip tiny blobs
          const partialPath = `${user.id}/${interviewIdRef.current}_partial.webm`;
          await supabase.storage
            .from("interview-recordings")
            .upload(partialPath, blob, { contentType: blob.type, upsert: true });
          console.log("[Recording] Partial upload OK:", partialPath, blob.size, "bytes");
        } catch (err) {
          console.error("[Recording] Partial upload error:", err);
        }
      };
      partialUploadFnRef.current = partialUploadFn;
      partialUploadIntervalRef.current = setInterval(partialUploadFn, 20000);

      // Link to job application if vacancy_id present
      if (vacancyId) {
        await supabase
          .from("job_applications")
          .update({ interview_id: interview.id, status: "interviewing" } as any)
          .eq("vacancy_id", vacancyId)
          .eq("user_id", user.id);
      }

      // Build conversational system prompt - uses chat function's prompt, just a lightweight version for greeting
      const isFemale = interviewerGender === "female";
      const systemPrompt = `CRITICAL INSTRUCTION: You MUST speak ONLY in Arabic (العربية). Never use English.
اسمك "${interviewerName}" و${isFemale ? "أنتِ محاورة وظيفية ودودة ومحترفة" : "أنت محاور وظيفي ودود ومحترف"} ${isFemale ? "تعملين" : "تعمل"} في السعودية.
الوظيفة: ${jobPosition}. ${isFemale ? "تتكلمين" : "تتكلم"} بلهجة سعودية مهنية ودودة.
ابدأ ردك بـ [INTRO].`;

      // Fetch dynamic opening from AI
      conversationRef.current = [
        { role: "system", content: systemPrompt },
      ];

      let firstMessage = "";
      try {
        const { data: greetData, error: greetErr } = await supabase.functions.invoke("chat", {
          body: {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `ابدأ المقابلة بتحية ودية ومختلفة كل مرة. عرّف نفسك (اسمك ${interviewerName}، ${isFemale ? "محاورة" : "محاور"} واكب ${isFemale ? "الذكية" : "الذكي"})، اذكر الوظيفة (${jobPosition}). لا تذكر عدد الأسئلة. اجعلها دافئة وطبيعية. لا تكرر نفس الصيغة. ابدأ بـ [INTRO].` },
            ],
            job_position: jobPosition,
            interview_type: type,
            interviewer_name: interviewerName,
            interviewer_gender: interviewerGender,
            current_phase: "intro",
            core_question_count: 0,
            total_questions: totalQuestions,
            user_id: user?.id,
          },
        });
        if (!greetErr && greetData?.choices?.[0]?.message?.content) {
          firstMessage = greetData.choices[0].message.content.replace(/^\[(INTRO|NEW_Q|FOLLOW_UP)\]\s*/, "");
        }
      } catch {}
      
      if (!firstMessage) {
        firstMessage = `هلا والله! أنا ${interviewerName} من ${isFemale ? "محاورة" : "محاور"} واكب ${isFemale ? "الذكية" : "الذكي"}، بكون معك اليوم في المقابلة لوظيفة ${jobPosition}. خلّها دردشة عادية. جاهز نبدأ؟ عرّفني على نفسك.`;
      }

      conversationRef.current.push({ role: "assistant", content: firstMessage });

      const firstEntry: TranscriptEntry = { role: "assistant", text: firstMessage };
      setTranscript([firstEntry]);
      setQuestionCount(1);
      questionCountRef.current = 1;
      setCurrentPhase("intro");
      setCoreQuestionCount(0);
      coreQuestionCountRef.current = 0;

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


  // beforeunload warning during active interview
  useEffect(() => {
    if (!isActive || isCompleted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive, isCompleted]);

  // Cleanup on unmount — use sendBeacon to mark interview as completed
  useEffect(() => {
    return () => {
      if (isEndingRef.current) return;

      activeRef.current = false;
      stoppedManuallyRef.current = true;
      if (partialUploadIntervalRef.current) {
        clearInterval(partialUploadIntervalRef.current);
        partialUploadIntervalRef.current = null;
      }
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
      mixingCtxRef.current?.close().catch(() => {});
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // Last-chance partial upload before abandoning
      if (partialUploadFnRef.current) {
        try { partialUploadFnRef.current(); } catch (e) { console.error("[Recording] Cleanup partial upload error:", e); }
      }

      const id = interviewIdRef.current;
      if (id && !isCompleted) {
        // Set recording_url to partial before abandoning
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-interview`;
        const body = JSON.stringify({ 
          interview_id: id,
          recording_url: userRef.current ? `${userRef.current.id}/${id}_partial.webm` : undefined,
        });
        navigator.sendBeacon(url, body);
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
    currentPhase,
    coreQuestionCount,
    startCall,
    endCall,
    submitAnswer,
    videoStream: videoStreamRef.current,
    videoElementRef,
  };
};
