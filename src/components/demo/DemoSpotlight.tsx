import { useEffect, useRef, useState } from "react";
import { useTourEngine } from "@/contexts/DemoTourContext";

type Rect = { top: number; left: number; width: number; height: number };

// If a spotlight target covers more than this fraction of the viewport area,
// treat the selector as "too generic" and render a compact banner instead of
// a useless full-page rectangle (e.g. selector="main" on a long page).
const OVERSIZE_AREA_THRESHOLD = 0.7;

// Smooth-scroll settle time before we measure. Browsers don't expose a
// completion callback for scrollIntoView({behavior:"smooth"}); empirically
// 350ms is enough for typical page-height scrolls without feeling sluggish.
const SCROLL_SETTLE_MS = 350;

// Padding around the spotlit element (px).
const PAD = 8;

function findStickyHeaderHeight(): number {
  const header = document.querySelector("header") as HTMLElement | null;
  if (!header) return 0;
  const cs = window.getComputedStyle(header);
  if (cs.position === "sticky" || cs.position === "fixed") {
    return header.getBoundingClientRect().height;
  }
  return 0;
}

export function DemoSpotlight() {
  const { currentStep, status } = useTourEngine();
  const [rect, setRect] = useState<Rect | null>(null);
  const [oversize, setOversize] = useState(false);
  const lastWarnedRef = useRef<string | null>(null);

  const selector = currentStep?.spotlight?.selector ?? null;
  const label = currentStep?.spotlight?.label;
  const stepId = currentStep?.id ?? null;
  const visible = status === "running" || status === "paused";

  useEffect(() => {
    if (!visible || !selector) {
      setRect(null);
      setOversize(false);
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const measure = (el: HTMLElement) => {
      if (cancelled) return;
      const r = el.getBoundingClientRect();
      const stickyOffset = findStickyHeaderHeight();
      // Clamp top so the spotlight doesn't slip under a sticky header.
      const top = Math.max(r.top, stickyOffset + 4);
      const heightAdjust = top - r.top;
      const height = Math.max(0, r.height - heightAdjust);

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const area = (r.width * r.height) / (vw * vh);
      setOversize(area > OVERSIZE_AREA_THRESHOLD);
      setRect({ top, left: r.left, width: r.width, height });
    };

    const initialize = async () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        if (lastWarnedRef.current !== stepId) {
          // One warning per step makes the missing data-tour easy to spot in QA.
          console.warn(`[DemoSpotlight] selector "${selector}" matched nothing for step "${stepId}"`);
          lastWarnedRef.current = stepId;
        }
        setRect(null);
        setOversize(false);
        return;
      }

      // Bring the target into view BEFORE the first measure, then wait for
      // the smooth scroll to settle so getBoundingClientRect reflects the
      // final position. The DemoTourContext also pre-scrolls, but doing it
      // here too is idempotent and tolerant to manual repositioning.
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((r) => setTimeout(r, SCROLL_SETTLE_MS));
      if (cancelled) return;

      measure(el);

      // Re-measure on layout shifts (lazy-loaded images, async content).
      resizeObserver = new ResizeObserver(() => measure(el));
      resizeObserver.observe(el);
    };

    initialize();

    // Lightweight poll for transitions that don't trigger ResizeObserver
    // (e.g. parent scroll, modal open underneath).
    const poll = window.setInterval(() => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) measure(el);
    }, 400);

    const onResize = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) measure(el);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.clearInterval(poll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [selector, visible, stepId]);

  if (!visible) return null;

  // Oversize fallback: target is huge (selector="main" etc.) → don't draw a
  // useless full-page rectangle; show a top banner with the label instead.
  if (oversize) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-3">
        {label && (
          <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg max-w-md text-center">
            {label}
          </div>
        )}
      </div>
    );
  }

  if (!rect) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/55 transition-opacity"
        style={{
          clipPath: `polygon(
            0 0, 100% 0, 100% 100%, 0 100%, 0 0,
            ${rect.left - PAD}px ${rect.top - PAD}px,
            ${rect.left - PAD}px ${rect.top + rect.height + PAD}px,
            ${rect.left + rect.width + PAD}px ${rect.top + rect.height + PAD}px,
            ${rect.left + rect.width + PAD}px ${rect.top - PAD}px,
            ${rect.left - PAD}px ${rect.top - PAD}px
          )`,
        }}
      />
      <div
        className="absolute rounded-xl ring-2 ring-primary shadow-[0_0_0_4px_rgba(0,0,0,0.25)]"
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }}
      />
      {label && (
        <div
          className="absolute bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg max-w-[280px]"
          style={{
            top: Math.max(8, rect.top - PAD - 32),
            left: Math.max(8, Math.min(rect.left - PAD, window.innerWidth - 300)),
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
