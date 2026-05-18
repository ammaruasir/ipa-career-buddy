import { useEffect, useState } from "react";
import { useTourEngine } from "@/contexts/DemoTourContext";

type Rect = { top: number; left: number; width: number; height: number };

export function DemoSpotlight() {
  const { currentStep, status } = useTourEngine();
  const [rect, setRect] = useState<Rect | null>(null);

  const selector = currentStep?.spotlight?.selector ?? null;
  const label = currentStep?.spotlight?.label;
  const visible = status === "running" || status === "paused";

  useEffect(() => {
    if (!visible || !selector) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    update();
    const t = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector, visible]);

  if (!visible || !rect) return null;
  const pad = 8;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/55 transition-opacity"
        style={{
          clipPath: `polygon(
            0 0, 100% 0, 100% 100%, 0 100%, 0 0,
            ${rect.left - pad}px ${rect.top - pad}px,
            ${rect.left - pad}px ${rect.top + rect.height + pad}px,
            ${rect.left + rect.width + pad}px ${rect.top + rect.height + pad}px,
            ${rect.left + rect.width + pad}px ${rect.top - pad}px,
            ${rect.left - pad}px ${rect.top - pad}px
          )`,
        }}
      />
      <div
        className="absolute rounded-xl ring-2 ring-primary shadow-[0_0_0_4px_rgba(0,0,0,0.25)]"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
      {label && (
        <div
          className="absolute bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg"
          style={{ top: rect.top - pad - 32, left: rect.left - pad }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
