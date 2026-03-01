import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 25 * 60 * 1000; // 25 minutes

export const useSessionTimeout = (signOut: () => Promise<void>, isAuthenticated: boolean) => {
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShownRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!isAuthenticated) return;
    clearTimers();
    warningShownRef.current = false;

    warningRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        toast.warning("ستنتهي جلستك خلال ٥ دقائق بسبب عدم النشاط", { duration: 10000 });
      }
    }, WARNING_MS);

    timeoutRef.current = setTimeout(async () => {
      toast.error("تم تسجيل الخروج تلقائياً بسبب عدم النشاط");
      await signOut();
      navigate("/login");
    }, TIMEOUT_MS);
  }, [isAuthenticated, signOut, navigate, clearTimers]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      return;
    }

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    const handleActivity = () => resetTimers();

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, [isAuthenticated, resetTimers, clearTimers]);
};
