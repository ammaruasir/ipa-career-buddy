// Shared text cleaner for demo TTS so Lina/Sara don't read markdown aloud.
export const cleanTextForTTS = (t: string): string =>
  t
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
