import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AntiCheatOptions {
  enableTabDetection?: boolean;
  enablePasteDetection?: boolean;
  /**
   * When provided, tab-switch events are persisted to `cheat_events` so the
   * proctor view + post-interview admin review can see them. Without this,
   * detection is local-only (toast warning).
   */
  interviewId?: string | null;
  /**
   * Practice sessions intentionally skip event persistence — they should be
   * safe-to-fail. Pass `mode === "practice"` to opt out of DB writes.
   */
  mode?: "practice" | "assessment" | "mock_final" | null;
}

export const useAntiCheat = ({
  enableTabDetection = true,
  enablePasteDetection = false,
  interviewId = null,
  mode = null,
}: AntiCheatOptions = {}) => {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  const interviewIdRef = useRef<string | null>(interviewId);
  useEffect(() => { interviewIdRef.current = interviewId; }, [interviewId]);
  const modeRef = useRef<typeof mode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const logEvent = useCallback(
    async (eventType: string, details: string) => {
      const id = interviewIdRef.current;
      if (!id) return;
      // Practice mode is opt-out — anti-cheat data isn't meaningful for safe-to-fail
      // self-training sessions.
      if (modeRef.current === "practice") return;
      try {
        await supabase
          .from("cheat_events")
          .insert({ interview_id: id, event_type: eventType, details });
      } catch (err) {
        // Best-effort; don't block UX if DB write fails.
        console.warn("[AntiCheat] failed to log event:", err);
      }
    },
    [],
  );

  // Tab switch detection
  useEffect(() => {
    if (!enableTabDetection) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        setTabSwitchCount((c) => c + 1);
        setShowWarning(true);
        toast.warning("⚠️ تحذير: تم اكتشاف مغادرة نافذة المقابلة. يتم تسجيل هذا السلوك.", {
          duration: 5000,
        });
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setShowWarning(false), 8000);
      } else if (hiddenAtRef.current) {
        const durationMs = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        // Persist with duration so admin can distinguish quick alt-tabs from
        // sustained absences.
        const seconds = Math.round(durationMs / 1000);
        void logEvent("tab_switch", `غادر المرشح النافذة لمدة ${seconds} ث`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [enableTabDetection, logEvent]);

  // Paste detection handler
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!enablePasteDetection) return;
      e.preventDefault();
      toast.error("⚠️ النسخ واللصق غير مسموح أثناء المقابلة", { duration: 3000 });
      void logEvent("paste_attempt", "حاول المرشح اللصق في حقل الإجابة");
    },
    [enablePasteDetection, logEvent],
  );

  return { tabSwitchCount, showWarning, handlePaste };
};
