const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Convert Western digits to Arabic-Indic numerals: 1234 → ١٢٣٤ */
export const toArabicNumerals = (value: string | number): string => {
  return String(value).replace(/\d/g, (d) => arabicDigits[parseInt(d)]);
};

/** Format a number with Arabic numerals and proper separators: 1,234.56 → ١٬٢٣٤٫٥٦ */
export const formatArabicNumber = (num: number, decimals = 0): string => {
  const formatted = num.toLocaleString("ar-SA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return formatted;
};

/** Format percentage with Arabic numerals: 85 → ٨٥٪ */
export const formatArabicPercent = (num: number): string => {
  return `${toArabicNumerals(Math.round(num))}٪`;
};

/**
 * Detect a phase tag anywhere in the first ~40 chars of an assistant reply,
 * and return the cleaned text with ALL tag occurrences (bracketed or bare)
 * stripped globally. The model occasionally emits a tag mid-sentence or twice,
 * so a leading-only regex isn't enough — anything that looks like a phase
 * label must be scrubbed before it reaches TTS or the chat bubble.
 */
const PHASE_TAG_GLOBAL = /\[?\s*(INTRO|CORE|FOLLOW_UP|NEW_Q|CLOSING|END)\s*\]?\s*:?\s*/gi;

export type InterviewPhaseTag = "INTRO" | "CORE" | "FOLLOW_UP" | "NEW_Q" | "CLOSING" | "END";

export const stripPhaseTags = (text: string): { cleaned: string; phase: InterviewPhaseTag | null } => {
  if (!text) return { cleaned: "", phase: null };
  const head = text.slice(0, 40);
  const leading = head.match(/\[?\s*(INTRO|CORE|FOLLOW_UP|NEW_Q|CLOSING|END)\s*\]?/i);
  const phase = (leading ? leading[1].toUpperCase() : null) as InterviewPhaseTag | null;
  const cleaned = text.replace(PHASE_TAG_GLOBAL, "").replace(/\s{2,}/g, " ").trim();
  return { cleaned, phase };
};
