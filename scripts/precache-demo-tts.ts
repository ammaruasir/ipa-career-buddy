/**
 * Pre-cache fixed demo narration as static MP3s so the frontend serves them
 * without hitting the TTS API. Drops per-session cost ~70%.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... \
 *     npx tsx scripts/precache-demo-tts.ts [--force]
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tourScript } from "../src/demo/tour-script.js";
import { presenterVoiceId } from "../src/demo/voices.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY env vars are required");
  process.exit(1);
}

const force = process.argv.slice(2).includes("--force");
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outDir = join(__dirname, "..", "public", "demo-audio");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const cleanText = (t: string) => t.replace(/(.)\1{2,}/g, "$1");

async function tts(text: string): Promise<ArrayBuffer> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY!,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text: cleanText(text), voiceId: presenterVoiceId }),
  });
  if (!resp.ok) throw new Error(`TTS ${resp.status}: ${await resp.text()}`);
  return resp.arrayBuffer();
}

async function main() {
  let generated = 0, skipped = 0, failed = 0;
  for (const step of tourScript) {
    const outPath = join(outDir, `${step.id}.mp3`);
    if (existsSync(outPath) && !force) { skipped++; continue; }
    try {
      console.log(`[precache] ${step.id} (${step.narration.length} chars)…`);
      const buf = await tts(step.narration);
      writeFileSync(outPath, Buffer.from(buf));
      generated++;
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      failed++;
      console.error(`[precache] ${step.id} FAILED:`, e);
    }
  }
  console.log(`[precache] done. generated=${generated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main();
