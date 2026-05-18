import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import fixWebmDuration from "fix-webm-duration";
import { useProctorChannel, type ChunkReadyEvent } from "@/hooks/useProctorChannel";
import { stripPhaseTags } from "@/lib/arabic-utils";

const CHUNK_DURATION_MS = 30_000;
const CHUNK_MIME_TYPE = "video/webm;codecs=vp8,opus";
const AUDIO_CHUNK_MIME_TYPE = "audio/webm;codecs=opus";

interface ChunkMeta {
  index: number;
  path: string;
  duration_ms: number;
  size_bytes: number;
}

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
  interviewerName = "عبدالله",
  interviewerGender = "male",
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
  const interviewerVoiceIdRef = useRef<string | undefined>(interviewerVoiceId);
  useEffect(() => { interviewerVoiceIdRef.current = interviewerVoiceId; }, [interviewerVoiceId]);
  const interviewerNameRef = useRef<string>(interviewerName);
  const interviewerGenderRef = useRef<"male" | "female">(interviewerGender);
  useEffect(() => { interviewerNameRef.current = interviewerName; }, [interviewerName]);
  useEffect(() => { interviewerGenderRef.current = interviewerGender; }, [interviewerGender]);
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
  const endInterviewRef = useRef<(() => Promise<void>) | null>(null);
  
  // Chunked session recording refs.
  // The session is recorded as a sequence of ~30s WebM files. Each chunk is
  // self-contained (has its own Cues + Duration via fix-webm-duration), is
  // uploaded as {user_id}/{interview_id}/chunk_NNN.webm, and broadcast on
  // the proctor channel so the admin live-viewer can pick it up.
  const currentChunkRecorderRef = useRef<MediaRecorder | null>(null);
  const currentChunkDataRef = useRef<Blob[]>([]);
  const currentChunkStartRef = useRef<number>(0);
  const chunkRotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunkIndexRef = useRef(0);
  const chunksMetaRef = useRef<ChunkMeta[]>([]);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const recordingActiveRef = useRef(false);
  const chunkRotationInFlightRef = useRef<Promise<void> | null>(null);
  const forceEndedRef = useRef<{ reason: string; by_name: string } | null>(null);

  // Audio mixing refs — to merge candidate mic + TTS into one recording stream
  const mixingCtxRef = useRef<AudioContext | null>(null);
  const mixedDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Track session start time (used to derive end-of-stream wall clock).
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

  // Live proctor state visible to the candidate.
  const [activeProctors, setActiveProctors] = useState<{ role: string; name?: string }[]>([]);
  const [proctorMessages, setProctorMessages] = useState<{ text: string; from: string; at: string }[]>([]);

  const { broadcastChunkReady } = useProctorChannel({
    interviewId,
    userId: user?.id ?? null,
    enabled: !!interviewId && !!user?.id,
    role: "trainee",
    onPresenceChange: (proctors) => setActiveProctors(proctors),
    onAdminMessage: (event) => {
      setProctorMessages((prev) => [...prev, { text: event.text, from: event.from_name, at: event.at }]);
      toast.info(`${event.from_name}: ${event.text}`, { duration: 8000 });
    },
    onForceEnd: (event) => {
      // Idempotent: ignore repeat force-end broadcasts while the first drain
      // is still in flight (e.g. admin double-clicks "End").
      if (isEndingRef.current || forceEndedRef.current) return;
      forceEndedRef.current = { reason: event.reason, by_name: event.by_name };
      toast.warning(`تم إنهاء المقابلة من قبل ${event.by_name}: ${event.reason}`);
      // Fire-and-forget intentionally: endInterview awaits chunk drain + final
      // broadcast internally before navigating, so the proctor view receives
      // the last chunk-ready event over the still-open realtime channel.
      void endInterviewRef.current?.();
    },
  });

  // Keep the broadcast function reachable from rotateChunk (which runs in a closure that predates this hook call).
  useEffect(() => {
    broadcastChunkReadyRef.current = broadcastChunkReady;
  }, [broadcastChunkReady]);

  // Speak text using the Wakeb AI Engine TTS and resolve when done.
  // Fallback: use the browser's SpeechSynthesis API.
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

  // Speak text using the Wakeb AI Engine TTS with browser fallback
  const speakText = useCallback((text: string): Promise<void> => {
    const cleanedText = cleanTextForTTS(text);
    return new Promise(async (resolve) => {
      setIsSpeaking(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token
          ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wakeb-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ text: cleanedText, voiceId: interviewerVoiceIdRef.current }),
          }
        );

        if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.crossOrigin = "anonymous";
        currentAudioRef.current = audio;

        // Try to wire TTS into the mixing graph so it gets recorded.
        // If this fails (e.g. context suspended or element already attached),
        // we still play the audio normally through default speakers.
        let mixed = false;
        if (mixingCtxRef.current && mixedDestRef.current) {
          try {
            if (mixingCtxRef.current.state === "suspended") {
              await mixingCtxRef.current.resume().catch(() => {});
            }
            const ttsSource = mixingCtxRef.current.createMediaElementSource(audio);
            ttsSource.connect(mixedDestRef.current); // → recording
            ttsSource.connect(mixingCtxRef.current.destination); // → speakers
            mixed = true;
          } catch (e) {
            console.warn("[AudioMix] Could not connect TTS to mixing context, playing direct:", e);
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

        // Final guard: ensure mixing context is running before play (audio routes through it when mixed)
        if (mixed && mixingCtxRef.current?.state === "suspended") {
          await mixingCtxRef.current.resume().catch(() => {});
        }
        await audio.play();
      } catch (error) {
        console.error("Wakeb AI Engine TTS failed, falling back to browser TTS:", error);
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
      // For video interviews, reuse existing video stream's audio track. For
      // voice interviews, reuse the cached mic stream across turns — calling
      // getUserMedia every turn re-prompts the OS indicator and wastes 50-200ms.
      let stream: MediaStream;
      if (type === "video" && videoStreamRef.current) {
        const audioTrack = videoStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          stream = new MediaStream([audioTrack]);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } else {
        const cached = streamRef.current;
        const stillLive =
          cached && cached.getAudioTracks().some((t) => t.readyState === "live");
        stream = stillLive
          ? cached!
          : await navigator.mediaDevices.getUserMedia({ audio: true });
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
        // Keep the mic stream alive across turns so the next startListening
        // doesn't re-acquire. The stream is released in endInterview /
        // unmount cleanup.
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
      const SILENCE_DURATION = 800;

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

      const { data: sessionData } = await supabase.auth.getSession();
      const userToken = sessionData.session?.access_token;
      if (!userToken) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${userToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
      // Hard-cap CORE: once we've overshot the configured count, hint the AI
      // to wrap up. Prevents infinite [CORE] loops if the model never emits
      // [CLOSING] on its own.
      const overrunCore =
        currentPhaseRef.current === "core" &&
        coreQuestionCountRef.current >= totalQuestions;

      const body: any = {
        job_position: jobPosition,
        interview_type: type,
        vacancy_id: vacancyIdRef.current,
        user_id: user?.id,
        current_question: questionCountRef.current + 1,
        total_questions: totalQuestions,
        interviewer_name: interviewerNameRef.current,
        interviewer_gender: interviewerGenderRef.current,
        // Force closing if core has overrun; otherwise pass the tracked phase.
        current_phase: overrunCore ? "closing" : currentPhaseRef.current,
        core_question_count: coreQuestionCountRef.current,
        force_closing: overrunCore || undefined,
      };

      // Always send the trailing message slice so the AI sees recent verbatim
      // history, not just the truncated summary. The chat function will merge
      // it with the system prompt + phase context.
      const recentTail = conversationRef.current.slice(-12);
      body.messages = recentTail;
      if (lastAnswer && contextSummaryRef.current) {
        body.context_summary = contextSummaryRef.current;
        body.last_answer = lastAnswer;
      }

      const { data, error } = await supabase.functions.invoke("chat", { body });

      if (error) throw error;

      const rawAi = data?.choices?.[0]?.message?.content || data?.content || "";
      if (!rawAi) throw new Error("Empty AI response");

      // Prefer server-returned phase metadata; fall back to scanning text.
      const { cleaned, phase: localPhase } = stripPhaseTags(rawAi);
      const phaseTag = (data?.phase as string | undefined)?.toUpperCase() || localPhase || null;
      const aiText = cleaned;

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
        currentPhaseRef.current = "intro";
      } else if (phaseTag === "CORE") {
        setCurrentPhase("core");
        currentPhaseRef.current = "core";
        const newCoreCount = coreQuestionCountRef.current + 1;
        setCoreQuestionCount(newCoreCount);
        coreQuestionCountRef.current = newCoreCount;

        // Hard ceiling: if we've already passed totalQuestions + 1 cores,
        // promote the local phase to "closing" so the next user answer
        // triggers a [CLOSING] prompt. Without this the interview can loop
        // forever if the AI never switches phase.
        if (newCoreCount > totalQuestions) {
          currentPhaseRef.current = "closing";
          setCurrentPhase("closing");
        }
      } else if (phaseTag === "CLOSING") {
        setCurrentPhase("closing");
        currentPhaseRef.current = "closing";
      }

      // Increment general question count for non-follow-ups
      const isFollowUp = phaseTag === "FOLLOW_UP";
      if (!isFollowUp) {
        const newCount = questionCountRef.current + 1;
        setQuestionCount(newCount);
        questionCountRef.current = newCount;
      }

      setIsProcessing(false);

      conversationRef.current.push({ role: "assistant", content: aiText });

      // Show the transcript entry IMMEDIATELY so the candidate can read along
      // while TTS plays. Previously the text only appeared after audio ended,
      // which left the screen blank for 5-15s every turn.
      transcriptRef.current = [...transcriptRef.current, { role: "assistant", text: aiText }];
      setTranscript([...transcriptRef.current]);

      await speakText(aiText);
      if (activeRef.current && !stoppedManuallyRef.current) {
        await startListening();
      }
    } catch (error) {
      console.error("AI response error:", error);
      setIsProcessing(false);
      toast.error("حدث خطأ في الحصول على السؤال التالي");
    }
  }, [jobPosition, type, speakText, startListening, totalQuestions]);

  // ============================================================
  // Chunked recording helpers
  //
  // The session is recorded as a sequence of ~30-second WebM chunks. Each
  // chunk is uploaded to storage and broadcast on the proctor channel as
  // soon as it's ready. This fixes the long-recording playback bug (WebM
  // metadata gets fixed per chunk so HTML5 video can seek), keeps every
  // upload safely under the bucket size limit, and powers the live proctor
  // view as a natural side effect.
  // ============================================================

  const broadcastChunkReadyRef = useRef<((event: ChunkReadyEvent) => Promise<void>) | null>(null);

  const uploadChunk = useCallback(async (blob: Blob, index: number, durationMs: number): Promise<ChunkMeta | null> => {
    const u = userRef.current;
    const interviewId = interviewIdRef.current;
    if (!u || !interviewId || blob.size === 0) return null;

    let fixedBlob = blob;
    try {
      fixedBlob = await fixWebmDuration(blob, durationMs);
    } catch (e) {
      console.warn(`[Recording] fixWebmDuration failed on chunk ${index}, uploading raw:`, e);
    }

    const padded = String(index).padStart(3, "0");
    const path = `${u.id}/${interviewId}/chunk_${padded}.webm`;

    try {
      const { error } = await supabase.storage
        .from("interview-recordings")
        .upload(path, fixedBlob, {
          contentType: type === "video" ? "video/webm" : "audio/webm",
          upsert: true,
        });
      if (error) {
        console.error(`[Recording] Chunk ${index} upload failed:`, error);
        return null;
      }
    } catch (err) {
      console.error(`[Recording] Chunk ${index} upload threw:`, err);
      return null;
    }

    const meta: ChunkMeta = {
      index,
      path,
      duration_ms: durationMs,
      size_bytes: fixedBlob.size,
    };
    chunksMetaRef.current.push(meta);
    console.log(`[Recording] Chunk ${index} uploaded (${(fixedBlob.size / 1024).toFixed(1)} KB, ${durationMs} ms)`);

    // Broadcast to any live proctors watching this session.
    try {
      await broadcastChunkReadyRef.current?.(meta);
    } catch (e) {
      console.warn("[Recording] chunk-ready broadcast failed:", e);
    }

    return meta;
  }, [type]);

  // Forward declaration via ref so rotateChunk can call startNextChunk.
  const startNextChunkRef = useRef<(() => void) | null>(null);

  const rotateChunk = useCallback(async (): Promise<void> => {
    const recorder = currentChunkRecorderRef.current;
    if (!recorder) return;

    const indexAtStop = chunkIndexRef.current;
    const startedAt = currentChunkStartRef.current;

    // Capture the chunk's data via the recorder's onstop event.
    const chunkBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const mime = type === "video" ? "video/webm" : "audio/webm";
        const data = currentChunkDataRef.current;
        currentChunkDataRef.current = [];
        resolve(new Blob(data, { type: mime }));
      };
      if (recorder.state === "recording") {
        try { recorder.stop(); } catch { /* ignore */ }
      } else {
        // Not recording — flush whatever's buffered.
        const mime = type === "video" ? "video/webm" : "audio/webm";
        const data = currentChunkDataRef.current;
        currentChunkDataRef.current = [];
        resolve(new Blob(data, { type: mime }));
      }
    });

    const duration = Math.max(1, Date.now() - (startedAt || Date.now()));
    currentChunkRecorderRef.current = null;

    await uploadChunk(chunkBlob, indexAtStop, duration);

    chunkIndexRef.current = indexAtStop + 1;

    // If we're still meant to be recording, immediately start the next chunk.
    if (recordingActiveRef.current) {
      startNextChunkRef.current?.();
    }
  }, [type, uploadChunk]);

  const startNextChunk = useCallback(() => {
    const stream = combinedStreamRef.current;
    if (!stream || !recordingActiveRef.current) return;

    const hasVideo = stream.getVideoTracks().length > 0;
    const mimeType = hasVideo ? CHUNK_MIME_TYPE : AUDIO_CHUNK_MIME_TYPE;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (e) {
      // Fall back to default codec selection if the pinned mime type is unsupported.
      console.warn(`[Recording] Pinned mime type ${mimeType} rejected, falling back:`, e);
      try {
        recorder = new MediaRecorder(stream, { mimeType: hasVideo ? "video/webm" : "audio/webm" });
      } catch (err) {
        console.error("[Recording] MediaRecorder construction failed:", err);
        return;
      }
    }

    currentChunkDataRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) currentChunkDataRef.current.push(e.data);
    };

    try {
      recorder.start(1000); // 1s timeslice — many small data events, smoother chunk
    } catch (e) {
      console.error("[Recording] recorder.start failed:", e);
      return;
    }

    currentChunkRecorderRef.current = recorder;
    currentChunkStartRef.current = Date.now();

    // Schedule rotation. We don't await this — onstop handler in rotateChunk
    // is the source of truth for chunk completion.
    chunkRotationTimerRef.current = setTimeout(() => {
      chunkRotationInFlightRef.current = rotateChunk();
    }, CHUNK_DURATION_MS);
  }, [rotateChunk]);

  // Register startNextChunk with the forward-declared ref.
  useEffect(() => {
    startNextChunkRef.current = startNextChunk;
  }, [startNextChunk]);

  // End interview and evaluate
  const endInterview = useCallback(async () => {
    // Idempotency guard: endInterview can be called from (a) user "End" button,
    // (b) admin force-end broadcast, (c) [END] phase tag, (d) closing flow.
    // Without this guard, two paths can each post a "completed" update and
    // double-invoke evaluate-interview.
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    activeRef.current = false;
    stoppedManuallyRef.current = true;
    setIsActive(false);
    setIsCompleted(true);
    setIsListening(false);
    setIsSpeaking(false);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(rafRef.current);

    // Stop chunk rotation: cancel any pending timer and let the current
    // chunk drain (its onstop handler still fires and uploads).
    recordingActiveRef.current = false;
    if (chunkRotationTimerRef.current) {
      clearTimeout(chunkRotationTimerRef.current);
      chunkRotationTimerRef.current = null;
    }

    const currentId = interviewIdRef.current;
    if (!currentId) return;

    // Wait for any in-flight chunk rotation, then drain the current chunk
    // so the final piece of the interview gets uploaded.
    try {
      if (chunkRotationInFlightRef.current) await chunkRotationInFlightRef.current;
    } catch (e) {
      console.warn("[Recording] In-flight chunk rotation error:", e);
    }
    if (currentChunkRecorderRef.current) {
      try { await rotateChunk(); } catch (e) { console.warn("[Recording] Final chunk drain error:", e); }
    }

    // Determine final recording status.
    const chunkCount = chunksMetaRef.current.length;
    const totalDuration = chunksMetaRef.current.reduce((sum, c) => sum + c.duration_ms, 0);
    const finalStatus: "complete" | "incomplete" | "failed" =
      chunkCount === 0 ? "failed" : "complete";

    // Mark interview as completed, with end_reason and recording metadata.
    const endReason = forceEndedRef.current ? "terminated_by_proctor" : "completed";
    const bgUser = userRef.current;
    const chunksPath = bgUser ? `${bgUser.id}/${currentId}/` : null;
    const manifestPath = bgUser ? `${bgUser.id}/${currentId}/manifest.json` : null;

    await supabase
      .from("interviews")
      .update({
        status: "completed",
        recording_chunks_path: chunksPath,
        recording_url: manifestPath,
        recording_duration_ms: totalDuration,
        recording_chunk_count: chunkCount,
        recording_status: finalStatus,
        end_reason: endReason,
      } as any)
      .eq("id", currentId);

    // P0.1: practice mode does not update the hiring pipeline
    const isPracticeRun = searchParams.get("practice") === "true";
    if (vacancyIdRef.current && user && !isPracticeRun) {
      await supabase
        .from("job_applications")
        .update({ status: "interviewed" } as any)
        .eq("vacancy_id", vacancyIdRef.current)
        .eq("user_id", user.id);
    }

    // Stop streams immediately
    streamRef.current?.getTracks().forEach(t => t.stop());
    videoStreamRef.current?.getTracks().forEach(t => t.stop());
    combinedStreamRef.current?.getTracks().forEach(t => t.stop());
    combinedStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    mixingCtxRef.current?.close().catch(() => {});
    mixingCtxRef.current = null;
    mixedDestRef.current = null;

    toast.success("تمت المقابلة بنجاح! يتم إعداد التقييم في الخلفية...");

    // Snapshot data for background work, then navigate.
    const manifestChunks = [...chunksMetaRef.current];
    chunksMetaRef.current = [];
    navigate("/dashboard");

    // Run manifest write + evaluation in background (fire-and-forget).
    (async () => {
      try {
        if (bgUser && manifestChunks.length > 0 && manifestPath) {
          const manifest = {
            version: 1,
            interview_id: currentId,
            total_duration_ms: totalDuration,
            chunk_count: manifestChunks.length,
            mime_type: type === "video" ? "video/webm" : "audio/webm",
            chunks: manifestChunks,
            completed_at: new Date().toISOString(),
          };
          const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
          const { error: manifestErr } = await supabase.storage
            .from("interview-recordings")
            .upload(manifestPath, manifestBlob, { contentType: "application/json", upsert: true });
          if (manifestErr) {
            console.error("[Recording] Manifest upload failed:", manifestErr);
            await supabase
              .from("interviews")
              .update({ recording_status: "incomplete" } as any)
              .eq("id", currentId);
          } else {
            console.log("[Recording] Manifest uploaded:", manifestPath);
          }
        }

        // Evaluate
        await supabase.functions.invoke("evaluate-interview", {
          body: { interview_id: currentId },
        });
        console.log("[Interview] Background evaluation completed");
      } catch (err) {
        console.error("[Interview] Background manifest/evaluation error:", err);
      }
    })();
  }, [navigate, user, rotateChunk, type, searchParams]);

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

      // P0.1: read practice flag from URL — defaults to assessment for legacy behavior
      const isPractice = searchParams.get("practice") === "true";
      const mode = isPractice ? "practice" : "assessment";
      const visibility = isPractice ? "private" : "hr";

      const { data: interview, error } = await supabase
        .from("interviews")
        .insert({
          user_id: user.id,
          type: type as any,
          job_position: jobPosition,
          status: "in_progress" as any,
          mode: mode as any,
          visibility: visibility as any,
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
      // Ensure context is running so MediaElementSource audio is audible
      await mixingCtx.resume().catch(() => {});
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

        // Build the combined stream: mixed audio tracks + video tracks (if any).
        // This stream persists across chunk recorder restarts.
        const combinedStream = new MediaStream();
        mixedDest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
        if (type === "video") {
          rawRecordingStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        }
        combinedStreamRef.current = combinedStream;

        // Initialize chunked recording state and kick off the first chunk.
        chunksMetaRef.current = [];
        chunkIndexRef.current = 0;
        currentChunkDataRef.current = [];
        recordingActiveRef.current = true;
        sessionRecordingStartRef.current = Date.now();
        forceEndedRef.current = null;

        // Mark interview as recording in DB so admins can see it's live.
        supabase
          .from("interviews")
          .update({ recording_status: "recording" } as any)
          .eq("id", interview.id)
          .then(() => undefined, () => undefined);

        startNextChunk();
        console.log("[Recording] Chunked session recorder started (30s chunks)");
      }

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
              { role: "user", content: `ابدأ المقابلة بتحية ودية ومختلفة كل مرة. عرّف نفسك (اسمك ${interviewerName}، ${isFemale ? "محاورة" : "محاور"} واكب ${isFemale ? "الذكية" : "الذكي"})، اذكر الوظيفة (${jobPosition}). خاطب المرشح باسمه إذا توفر في بياناته. لا تذكر عدد الأسئلة. اجعلها دافئة وطبيعية. لا تكرر نفس الصيغة. ابدأ بـ [INTRO].` },
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
          firstMessage = greetData.choices[0].message.content
            .replace(/^\[?(INTRO|CORE|NEW_Q|FOLLOW_UP|CLOSING|END)\]?\s*:?\s*/i, "")
            .replace(/\b(INTRO|CORE|NEW_Q|FOLLOW_UP|CLOSING|END)\b\s*:?\s*/gi, "").trim();
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

  // Cleanup on unmount — abandoned session is recoverable from already-uploaded chunks.
  useEffect(() => {
    return () => {
      if (isEndingRef.current) return;

      activeRef.current = false;
      stoppedManuallyRef.current = true;
      recordingActiveRef.current = false;

      if (chunkRotationTimerRef.current) {
        clearTimeout(chunkRotationTimerRef.current);
        chunkRotationTimerRef.current = null;
      }

      // Stop current chunk recorder if still running. Its onstop handler may
      // still fire after unmount but we don't await — already-uploaded chunks
      // are enough for admin playback of the partial session.
      if (currentChunkRecorderRef.current?.state === "recording") {
        try { currentChunkRecorderRef.current.stop(); } catch { /* ignore */ }
      }

      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      combinedStreamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
      mixingCtxRef.current?.close().catch(() => {});
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // Tell the backend the session ended unexpectedly so the admin gets a
      // clear "incomplete" banner instead of an interview stuck in_progress.
      const id = interviewIdRef.current;
      if (id && !isCompleted) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-interview`;
        const body = JSON.stringify({
          interview_id: id,
          recording_status: "incomplete",
          end_reason: "disconnected",
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

  /** Inject a candidate answer as plain text — bypasses microphone capture
   *  and STT. Used by the demo presenter so an AI candidate persona can drive
   *  the interview turn-by-turn against the real interviewer pipeline. Mirrors
   *  the state mutations handleRecordingComplete performs after a real
   *  transcription, minus the audio handling. */
  const submitAnswerText = useCallback(async (userText: string): Promise<void> => {
    const text = (userText ?? "").trim();
    if (!text || !activeRef.current || stoppedManuallyRef.current) return;

    const userEntry: TranscriptEntry = { role: "user", text };
    setTranscript((prev) => [...prev, userEntry]);
    conversationRef.current.push({ role: "user", content: text });

    if (interviewIdRef.current) {
      const lastAssistant = conversationRef.current
        .filter((m) => m.role === "assistant")
        .pop();
      try {
        await supabase.from("responses").insert({
          interview_id: interviewIdRef.current,
          question_text: lastAssistant?.content || "",
          answer_text: text,
        });
      } catch (e) {
        console.warn("submitAnswerText: response insert failed (non-fatal):", e);
      }
    }

    contextSummaryRef.current += `\nسؤال ${questionCountRef.current}: ${
      conversationRef.current
        .filter((m) => m.role === "assistant")
        .pop()
        ?.content?.substring(0, 100) || ""
    }\nإجابة مختصرة: ${text.substring(0, 150)}`;

    await getNextAIResponse(text);
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
    currentPhase,
    coreQuestionCount,
    startCall,
    endCall,
    submitAnswer,
    submitAnswerText,
    videoStream: videoStreamRef.current,
    videoElementRef,
    activeProctors,
    proctorMessages,
  };
};
