/**
 * Latency profiler for the demo Q&A round-trip.
 * Target: <4s viewer-stops → AI-starts.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... npx tsx scripts/demo-latency-profile.ts
 */
import { featureSpec } from "../src/demo/feature-spec.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY required");
  process.exit(1);
}

const SAMPLE_QUESTIONS = [
  "كم طريقة لبناء السيرة الذاتية؟",
  "هل بياناتي محفوظة بأمان؟",
  "هل أقدر أبدّل اللغة في أي وقت؟",
  "كم سؤال في المقابلة التدريبية؟",
  "هل المنصّة مجّانية؟",
];

const headers = { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY! };

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const t0 = performance.now();
  const result = await fn();
  return { ms: Math.round(performance.now() - t0), result };
}

async function profileLlm(question: string): Promise<number> {
  const { ms } = await timeIt(async () => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/demo-chat`, {
      method: "POST", headers,
      body: JSON.stringify({
        question, currentStepId: "act1-intro",
        recentTranscript: [], featureSpec, stepIds: ["act1-intro"],
      }),
    });
    if (!resp.ok) throw new Error(`demo-chat ${resp.status}`);
    return resp.json();
  });
  return ms;
}

async function profileTtsFirstByte(): Promise<number> {
  const t0 = performance.now();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ text: "مرحباً، هذا اختبار زمن استجابة." }),
  });
  if (!resp.ok) throw new Error(`elevenlabs-tts ${resp.status}`);
  const reader = resp.body!.getReader();
  await reader.read();
  await reader.cancel();
  return Math.round(performance.now() - t0);
}

function summary(samples: number[]): { p50: number; p95: number; mean: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    mean: Math.round(sorted.reduce((s, n) => s + n, 0) / sorted.length),
  };
}

async function main() {
  console.log("Demo Q&A latency profile\n");
  const llmSamples: number[] = [];
  for (const q of SAMPLE_QUESTIONS) {
    const ms = await profileLlm(q);
    console.log(`  LLM (${q.slice(0, 28)}…): ${ms}ms`);
    llmSamples.push(ms);
  }
  const ttsSamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const ms = await profileTtsFirstByte();
    console.log(`  TTS first-byte run ${i + 1}: ${ms}ms`);
    ttsSamples.push(ms);
  }
  const llmStats = summary(llmSamples);
  const ttsStats = summary(ttsSamples);
  const totalP95 = llmStats.p95 + ttsStats.p95;
  console.log("\nSummary:");
  console.log(`  LLM       p50=${llmStats.p50}ms  p95=${llmStats.p95}ms  mean=${llmStats.mean}ms`);
  console.log(`  TTS first p50=${ttsStats.p50}ms  p95=${ttsStats.p95}ms  mean=${ttsStats.mean}ms`);
  console.log(`  LLM + TTS p95 total: ${totalP95}ms  (target <4000ms)`);
  if (totalP95 > 4000) {
    console.error("\n⚠ p95 latency exceeds target");
    process.exit(2);
  } else {
    console.log("\n✓ p95 within target");
  }
}

main().catch((e) => {
  console.error("profile failed:", e);
  process.exit(1);
});
