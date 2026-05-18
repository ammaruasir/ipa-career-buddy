import { useEffect, useState } from "react";
import { useTourEngine } from "@/contexts/DemoTourContext";

/**
 * Visible "ghost cursor" that follows the AI demo's interactions so the viewer
 * can see where the bot is about to click or type. Hidden during navigation
 * and during AI-vs-AI interview turns where Sara and the candidate are talking.
 *
 * The user's native cursor remains visible — this overlay is additive, not a
 * replacement, so take-over mode still works.
 */
export function DemoCursor() {
  const { cursor, status } = useTourEngine();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  if (status === "idle" || status === "finished" || !cursor.visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[10000]"
      style={{
        transform: `translate3d(${cursor.x - 14}px, ${cursor.y - 8}px, 0)`,
        transition: reduceMotion ? "none" : "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
      }}
    >
      <div className="relative">
        {/* Click ripple */}
        {cursor.clicking && (
          <span
            className="absolute rounded-full border-2 border-primary"
            style={{
              top: -10,
              left: -10,
              width: 44,
              height: 44,
              animation: "demo-cursor-ping 600ms ease-out forwards",
            }}
          />
        )}
        {/* Cursor arrow + AI label badge */}
        <svg
          width="28"
          height="32"
          viewBox="0 0 28 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}
        >
          <path
            d="M4 2 L4 24 L10 18 L13 26 L17 24 L14 16 L22 16 Z"
            fill="hsl(var(--primary))"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="absolute -top-2 left-7 select-none rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md"
          style={{ letterSpacing: "0.05em" }}
        >
          AI
        </span>
        <style>{`
          @keyframes demo-cursor-ping {
            0%   { transform: scale(0.4); opacity: 0.9; }
            100% { transform: scale(1.6); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}
