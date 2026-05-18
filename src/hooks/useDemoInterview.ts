import { useCallback, useRef, useState } from "react";
import {
  useDemoCandidate,
  type CandidateContext,
  type CandidateTurn,
} from "@/hooks/useDemoCandidate";

type RunOptions = {
  context: CandidateContext;
  questions: string[];
  onQuestion?: (question: string, index: number) => Promise<void> | void;
  onAnswer?: (answer: string, index: number) => Promise<void> | void;
};

/**
 * Demo interview orchestrator. Iterates a question list, has Sara answer each
 * via demo-candidate-bot + second-voice TTS. Independent of LiveInterview so
 * it can be exercised standalone for testing.
 */
export function useDemoInterview() {
  const candidate = useDemoCandidate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  const stop = useCallback(() => {
    cancelRef.current = true;
    candidate.stopAnswering();
    setRunning(false);
  }, [candidate]);

  const run = useCallback(
    async ({ context, questions, onQuestion, onAnswer }: RunOptions) => {
      cancelRef.current = false;
      setRunning(true);
      setTotalQuestions(questions.length);
      const history: CandidateTurn[] = [];
      try {
        for (let i = 0; i < questions.length; i++) {
          if (cancelRef.current) break;
          const q = questions[i];
          setCurrentIndex(i + 1);
          if (onQuestion) await onQuestion(q, i + 1);
          if (cancelRef.current) break;
          const answer = await candidate.askSara({
            question: q,
            history,
            context,
            questionIndex: i + 1,
            totalQuestions: questions.length,
          });
          if (cancelRef.current) break;
          if (onAnswer) await onAnswer(answer, i + 1);
          history.push({ q, a: answer });
        }
      } finally {
        setRunning(false);
        cancelRef.current = false;
      }
      return history;
    },
    [candidate],
  );

  return {
    run,
    stop,
    running,
    currentIndex,
    totalQuestions,
    isThinking: candidate.isThinking,
    isAnswering: candidate.isAnswering,
  };
}
