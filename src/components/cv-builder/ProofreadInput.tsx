// ProofreadInput / ProofreadTextarea — wrappers that auto-proofread Arabic text on blur.
// - Single-option fixes apply silently (with a brief ✓ badge + console.debug).
// - Multi-option ambiguities open a Popover offering the choices + "write differently".
// - Silent failure on network/AI errors.

import { forwardRef, useCallback, useRef, useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, SparklesIcon, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

type ContextKind = "name" | "summary" | "bullet" | "general";

interface Correction {
  original: string;
  options: string[];
  type: "spelling" | "grammar" | "punctuation";
  explanation: string;
}

interface ProofreadResult {
  needs_correction: boolean;
  auto_corrected_text: string;
  corrections: Correction[];
}

// In-memory + sessionStorage cache to avoid re-checking identical text
const memoryCache = new Map<string, ProofreadResult>();
const cacheKey = (text: string, ctx: ContextKind) => `proofread:${ctx}:${text}`;

const getCached = (text: string, ctx: ContextKind): ProofreadResult | null => {
  const k = cacheKey(text, ctx);
  if (memoryCache.has(k)) return memoryCache.get(k)!;
  try {
    const stored = sessionStorage.getItem(k);
    if (stored) {
      const parsed = JSON.parse(stored) as ProofreadResult;
      memoryCache.set(k, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};

const setCached = (text: string, ctx: ContextKind, val: ProofreadResult) => {
  const k = cacheKey(text, ctx);
  memoryCache.set(k, val);
  try {
    sessionStorage.setItem(k, JSON.stringify(val));
  } catch {
    // sessionStorage may be full or unavailable
  }
};

async function runProofread(text: string, ctx: ContextKind): Promise<ProofreadResult> {
  const cached = getCached(text, ctx);
  if (cached) return cached;
  try {
    const { data, error } = await supabase.functions.invoke("proofread-arabic", {
      body: { text, context: ctx },
    });
    if (error) throw error;
    const result: ProofreadResult = data && typeof data === "object"
      ? {
          needs_correction: !!data.needs_correction,
          auto_corrected_text: typeof data.auto_corrected_text === "string"
            ? data.auto_corrected_text
            : text,
          corrections: Array.isArray(data.corrections) ? data.corrections : [],
        }
      : { needs_correction: false, auto_corrected_text: text, corrections: [] };
    setCached(text, ctx, result);
    return result;
  } catch (e) {
    console.debug("proofread silent fail:", e);
    return { needs_correction: false, auto_corrected_text: text, corrections: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// Hook shared by Input + Textarea wrappers
// ─────────────────────────────────────────────────────────────
function useProofread(
  value: string,
  onChange: (v: string) => void,
  context: ContextKind,
  enabled: boolean,
) {
  const [checking, setChecking] = useState(false);
  const [showFixed, setShowFixed] = useState(false);
  const [ambiguous, setAmbiguous] = useState<Correction[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const lastChecked = useRef<string>("");
  const fixedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBlur = useCallback(async () => {
    if (!enabled) return;
    const text = value?.trim() ?? "";
    if (!text || text.length < 3) return;
    if (text === lastChecked.current) return;
    lastChecked.current = text;

    setChecking(true);
    const result = await runProofread(text, context);
    setChecking(false);

    if (!result.needs_correction) return;

    // Apply single-option corrections silently
    const singles = result.corrections.filter((c) => c.options.length === 1);
    const multis = result.corrections.filter((c) => c.options.length > 1);

    if (singles.length > 0 && result.auto_corrected_text && result.auto_corrected_text !== value) {
      console.debug(
        `[proofread] applied ${singles.length} silent fix(es):`,
        singles.map((s) => `${s.original} → ${s.options[0]}`),
      );
      onChange(result.auto_corrected_text);
      lastChecked.current = result.auto_corrected_text;
      setShowFixed(true);
      if (fixedTimer.current) clearTimeout(fixedTimer.current);
      fixedTimer.current = setTimeout(() => setShowFixed(false), 3000);
    }

    if (multis.length > 0) {
      setAmbiguous(multis);
      setPopoverOpen(true);
    }
  }, [enabled, value, onChange, context]);

  const applyOption = useCallback(
    (correction: Correction, option: string) => {
      // Replace first occurrence of correction.original with the chosen option
      const idx = value.indexOf(correction.original);
      if (idx === -1) {
        // fallback: append? skip
        setAmbiguous((prev) => prev.filter((c) => c !== correction));
        return;
      }
      const next = value.slice(0, idx) + option + value.slice(idx + correction.original.length);
      onChange(next);
      lastChecked.current = next;
      setAmbiguous((prev) => prev.filter((c) => c !== correction));
    },
    [value, onChange],
  );

  const dismiss = useCallback((correction: Correction) => {
    setAmbiguous((prev) => prev.filter((c) => c !== correction));
  }, []);

  return {
    checking,
    showFixed,
    ambiguous,
    popoverOpen,
    setPopoverOpen,
    handleBlur,
    applyOption,
    dismiss,
  };
}

// ─────────────────────────────────────────────────────────────
// Status indicator + ambiguity popover (shared UI)
// ─────────────────────────────────────────────────────────────
const StatusOverlay = ({
  checking,
  showFixed,
  ambiguous,
  popoverOpen,
  setPopoverOpen,
  applyOption,
  dismiss,
}: {
  checking: boolean;
  showFixed: boolean;
  ambiguous: Correction[];
  popoverOpen: boolean;
  setPopoverOpen: (v: boolean) => void;
  applyOption: (c: Correction, opt: string) => void;
  dismiss: (c: Correction) => void;
}) => {
  const hasAmbiguous = ambiguous.length > 0;

  return (
    <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 pointer-events-none">
      {checking && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background/80 rounded px-1.5 py-0.5 backdrop-blur-sm pointer-events-auto">
          <Loader2 className="w-3 h-3 animate-spin" />
          تدقيق
        </span>
      )}
      {showFixed && !hasAmbiguous && (
        <Badge
          variant="outline"
          className="h-5 text-[10px] gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 pointer-events-auto"
        >
          <CheckCircle2 className="w-2.5 h-2.5" />
          صُحّح
        </Badge>
      )}
      {hasAmbiguous && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] border border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
            >
              <SparklesIcon className="w-2.5 h-2.5" />
              {ambiguous.length} اقتراح
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-80 p-3 space-y-3"
            dir="rtl"
          >
            <div className="text-xs font-semibold text-foreground border-b pb-2">
              اقتراحات تدقيق لغوي
            </div>
            {ambiguous.map((c, i) => (
              <div key={i} className="space-y-1.5">
                <div className="text-[11px] text-muted-foreground">
                  <span className="line-through text-destructive/80">{c.original}</span>
                  <span className="mx-1.5">←</span>
                  <span>{c.explanation}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.options.map((opt, oi) => (
                    <Button
                      key={oi}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs rounded-lg"
                      onClick={() => applyOption(c, opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-lg text-muted-foreground"
                    onClick={() => dismiss(c)}
                  >
                    <PencilLine className="w-3 h-3 ml-1" />
                    اكتب نصاً آخر
                  </Button>
                </div>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ProofreadInput
// ─────────────────────────────────────────────────────────────
interface ProofreadInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (v: string) => void;
  proofreadContext?: ContextKind;
  enableProofread?: boolean;
  containerClassName?: string;
}

export const ProofreadInput = forwardRef<HTMLInputElement, ProofreadInputProps>(
  ({ value, onChange, proofreadContext = "general", enableProofread = true, containerClassName, onBlur, ...rest }, ref) => {
    const p = useProofread(value, onChange, proofreadContext, enableProofread);

    return (
      <div className={cn("relative", containerClassName)}>
        <Input
          ref={ref}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onBlur={(e) => {
            onBlur?.(e);
            p.handleBlur();
          }}
          {...rest}
        />
        <StatusOverlay
          checking={p.checking}
          showFixed={p.showFixed}
          ambiguous={p.ambiguous}
          popoverOpen={p.popoverOpen}
          setPopoverOpen={p.setPopoverOpen}
          applyOption={p.applyOption}
          dismiss={p.dismiss}
        />
      </div>
    );
  },
);
ProofreadInput.displayName = "ProofreadInput";

// ─────────────────────────────────────────────────────────────
// ProofreadTextarea
// ─────────────────────────────────────────────────────────────
interface ProofreadTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onChange: (v: string) => void;
  proofreadContext?: ContextKind;
  enableProofread?: boolean;
  containerClassName?: string;
}

export const ProofreadTextarea = forwardRef<HTMLTextAreaElement, ProofreadTextareaProps>(
  ({ value, onChange, proofreadContext = "general", enableProofread = true, containerClassName, onBlur, ...rest }, ref) => {
    const p = useProofread(value, onChange, proofreadContext, enableProofread);

    return (
      <div className={cn("relative", containerClassName)}>
        <Textarea
          ref={ref}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          onBlur={(e) => {
            onBlur?.(e);
            p.handleBlur();
          }}
          {...rest}
        />
        <StatusOverlay
          checking={p.checking}
          showFixed={p.showFixed}
          ambiguous={p.ambiguous}
          popoverOpen={p.popoverOpen}
          setPopoverOpen={p.setPopoverOpen}
          applyOption={p.applyOption}
          dismiss={p.dismiss}
        />
      </div>
    );
  },
);
ProofreadTextarea.displayName = "ProofreadTextarea";

// ─────────────────────────────────────────────────────────────
// Standalone helper (used by chat flows that send-on-submit)
// ─────────────────────────────────────────────────────────────
export async function proofreadText(text: string, context: ContextKind = "general"): Promise<string> {
  if (!text || text.trim().length < 3) return text;
  const result = await runProofread(text.trim(), context);
  if (!result.needs_correction) return text;
  // Apply only single-option (silent) fixes; ambiguities stay as user wrote them.
  return result.auto_corrected_text || text;
}
