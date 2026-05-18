import { useCallback, useRef, useState } from "react";
import { candidateVoiceId } from "@/demo/voices";
import { demoCandidate } from "@/demo/demo-candidate";
import { cleanTextForTTS } from "@/demo/clean-tts";

export type CandidateContext = "cv_chat" | "practice_interview" | "assessment_interview";
export type CandidateTurn = { q: string; a: string };

type AskSaraInput = {
  question: string;
  history: CandidateTurn[];
  context: CandidateContext;
  questionIndex: number;
  totalQuestions: number;
};

export function useDemoCandidate() {
  const [isThinking, setIsThinking] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAnswering = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsAnswering(false);
  }, []);

  const askSara = useCallback(
    async ({ question, history, context, questionIndex, totalQuestions }: AskSaraInput): Promise<string> => {
      setIsThinking(true);

      const llmResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-candidate-bot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            question, history, context, questionIndex, totalQuestions,
            persona: demoCandidate,
          }),
        }
      );
      setIsThinking(false);

      if (!llmResp.ok) throw new Error(`demo-candidate-bot failed: ${llmResp.status}`);
      const data = (await llmResp.json()) as { answer?: string };
      const answer = (data.answer ?? "").trim();
      if (!answer) return "";

      setIsAnswering(true);
      try {
        const ttsResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-wakeb-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ text: cleanTextForTTS(answer), voiceId: candidateVoiceId }),
          }
        );

        if (!ttsResp.ok) {
          setIsAnswering(false);
          return answer;
        }

        const blob = await ttsResp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve) => {
          const cleanup = () => {
            URL.revokeObjectURL(url);
            if (audioRef.current === audio) audioRef.current = null;
            setIsAnswering(false);
            resolve();
          };
          audio.onended = cleanup;
          audio.onerror = cleanup;
          audio.play().catch(cleanup);
        });
      } catch (e) {
        console.error("Sara TTS failed:", e);
        setIsAnswering(false);
      }

      return answer;
    },
    []
  );

  return { askSara, stopAnswering, isThinking, isAnswering };
}
