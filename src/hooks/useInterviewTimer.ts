import { useState, useEffect, useCallback, useRef } from "react";

interface UseInterviewTimerOptions {
  durationSeconds?: number;
  onExpire?: () => void;
  autoStart?: boolean;
}

export const useInterviewTimer = ({
  durationSeconds = 300, // 5 minutes default
  onExpire,
  autoStart = false,
}: UseInterviewTimerOptions = {}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [isRunning, clearTimer]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback((newDuration?: number) => {
    clearTimer();
    setTimeLeft(newDuration ?? durationSeconds);
    setIsRunning(false);
  }, [durationSeconds, clearTimer]);

  const restart = useCallback((newDuration?: number) => {
    clearTimer();
    setTimeLeft(newDuration ?? durationSeconds);
    setIsRunning(true);
  }, [durationSeconds, clearTimer]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isWarning = timeLeft <= 60 && timeLeft > 0;
  const isExpired = timeLeft <= 0;

  return { timeLeft, formatted, isRunning, isWarning, isExpired, start, pause, reset, restart, minutes, seconds };
};
