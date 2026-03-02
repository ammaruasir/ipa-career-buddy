import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

interface AntiCheatOptions {
  enableTabDetection?: boolean;
  enablePasteDetection?: boolean;
}

export const useAntiCheat = ({
  enableTabDetection = true,
  enablePasteDetection = false,
}: AntiCheatOptions = {}) => {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab switch detection
  useEffect(() => {
    if (!enableTabDetection) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((c) => c + 1);
        setShowWarning(true);
        toast.warning("⚠️ تحذير: تم اكتشاف مغادرة نافذة المقابلة. يتم تسجيل هذا السلوك.", {
          duration: 5000,
        });
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setShowWarning(false), 8000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [enableTabDetection]);

  // Paste detection handler
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!enablePasteDetection) return;
      e.preventDefault();
      toast.error("⚠️ النسخ واللصق غير مسموح أثناء المقابلة", { duration: 3000 });
    },
    [enablePasteDetection]
  );

  return { tabSwitchCount, showWarning, handlePaste };
};
