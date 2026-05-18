// CVDateInput — date input with Hijri ↔ Gregorian display toggle.
//
// Storage: stays as free-text (no schema change). The component:
//   - Accepts a free-text date (YYYY-MM-DD, MM/YYYY, "حتى الآن", etc.)
//   - Tries to parse as Gregorian YYYY-MM-DD and shows its Hijri equivalent
//   - Tries to parse as Hijri YYYY-MM-DD and shows its Gregorian equivalent
//   - Toggle pill lets the user switch which calendar they're typing in
//   - Helper text shows the conversion below the input
//
// Uses Intl.DateTimeFormat with the islamic-umalqura calendar (built-in to
// modern browsers / V8). No extra dependency required.

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Calendar = "gregory" | "hijri";

interface CVDateInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** Default calendar the user is typing in. Defaults to Gregorian. */
  defaultCalendar?: Calendar;
}

const HIJRI_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const GREGORY_FMT = new Intl.DateTimeFormat("en-CA-u-ca-gregory", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Parse YYYY-MM-DD or YYYY/MM/DD or YYYY-MM into a Date.
// Returns null if not parseable.
function parseDateLoose(text: string): Date | null {
  const t = (text || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3] || "1", 10);
  if (!y || !mo || !d) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

// Convert a Hijri YYYY-MM-DD into a Gregorian Date by iterating nearby
// Gregorian days and checking which one formats back to that Hijri date.
// Sufficient for CV-grade precision (one-day error tolerance).
function hijriToGregorian(hijri: string): Date | null {
  const m = hijri.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (!m) return null;
  const targetY = m[1].padStart(4, "0");
  const targetMo = m[2].padStart(2, "0");
  const targetD = (m[3] || "01").padStart(2, "0");
  const target = `${targetY}-${targetMo}-${targetD}`;

  // The Hijri year H ≈ Gregorian year G where G = H + 622 - (H/33).
  // Use that as a starting point, then iterate ±5 years to find a match.
  const hY = parseInt(targetY, 10);
  const approxG = hY + 622 - Math.floor(hY / 33);
  for (let dy = 0; dy < 365 * 6; dy++) {
    for (const sign of [1, -1]) {
      const g = new Date(Date.UTC(approxG, 0, 1));
      g.setUTCDate(g.getUTCDate() + sign * dy);
      const hijriFromG = HIJRI_FMT.format(g);
      // Intl returns "DD/MM/YYYY" in Arabic-Saudi locale with Latin digits
      const parts = hijriFromG.split("/").map((s) => s.trim());
      if (parts.length === 3) {
        const formattedH = `${parts[2].padStart(4, "0")}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        if (formattedH === target) return g;
      }
      if (dy === 0) break;
    }
  }
  return null;
}

function formatHijriFromGregorian(g: Date): string {
  const parts = HIJRI_FMT.format(g).split("/").map((s) => s.trim());
  if (parts.length === 3) {
    return `${parts[2].padStart(4, "0")}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")} هـ`;
  }
  return "";
}

function formatGregorianFromGregorian(g: Date): string {
  // en-CA produces YYYY-MM-DD which is exactly what we want
  return GREGORY_FMT.format(g) + " م";
}

const CVDateInput = ({
  value,
  onChange,
  placeholder,
  className,
  defaultCalendar = "gregory",
}: CVDateInputProps) => {
  const [calendar, setCalendar] = useState<Calendar>(defaultCalendar);

  const conversion = useMemo(() => {
    const trimmed = (value || "").trim();
    if (!trimmed) return null;

    if (calendar === "gregory") {
      const g = parseDateLoose(trimmed);
      if (g) return formatHijriFromGregorian(g);
      return null;
    }
    // Hijri input
    const g = hijriToGregorian(trimmed);
    if (g) return formatGregorianFromGregorian(g);
    return null;
  }, [value, calendar]);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ??
            (calendar === "gregory" ? "YYYY-MM-DD (ميلادي)" : "YYYY-MM-DD (هجري)")
          }
          dir="ltr"
        />
        <div className="flex rounded-md border border-input overflow-hidden text-[10px] shrink-0">
          <button
            type="button"
            onClick={() => setCalendar("gregory")}
            className={cn(
              "px-2 py-1 transition-colors",
              calendar === "gregory"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted text-muted-foreground",
            )}
            aria-label="ميلادي"
            title="ميلادي"
          >
            م
          </button>
          <button
            type="button"
            onClick={() => setCalendar("hijri")}
            className={cn(
              "px-2 py-1 transition-colors border-r border-input",
              calendar === "hijri"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted text-muted-foreground",
            )}
            aria-label="هجري"
            title="هجري"
          >
            هـ
          </button>
        </div>
      </div>
      {conversion && (
        <p className="text-[10px] text-muted-foreground" dir="ltr">
          ≈ {conversion}
        </p>
      )}
    </div>
  );
};

export default CVDateInput;
