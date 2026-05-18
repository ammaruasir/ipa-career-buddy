/**
 * Batch repair of legacy interview recordings.
 *
 * Iterates every interviews row whose recording_url is set but is not yet a
 * chunked recording (recording_chunks_path IS NULL) and whose
 * recording_status is not 'complete'. Invokes the repair-recording edge
 * function per row with concurrency of 3. Idempotent: re-running skips rows
 * already marked complete.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/repair-all-recordings.ts [--dry-run] [--limit=50]
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface InterviewRow {
  id: string;
  user_id: string;
  type: string;
  recording_url: string | null;
  recording_chunks_path: string | null;
  recording_status: string | null;
}

async function fetchCandidates(): Promise<InterviewRow[]> {
  const { data, error } = await supabase
    .from("interviews")
    .select("id, user_id, type, recording_url, recording_chunks_path, recording_status")
    .not("recording_url", "is", null)
    .is("recording_chunks_path", null)
    .or("recording_status.is.null,recording_status.neq.complete")
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InterviewRow[];
}

async function repairOne(row: InterviewRow): Promise<{ id: string; ok: boolean; reason?: string }> {
  if (dryRun) {
    return { id: row.id, ok: true, reason: "dry-run" };
  }
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/repair-recording`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ interview_id: row.id }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { id: row.id, ok: false, reason: body?.error ?? `HTTP ${resp.status}` };
    }
    if (body?.skipped) {
      return { id: row.id, ok: true, reason: `skipped: ${body.reason}` };
    }
    return { id: row.id, ok: true };
  } catch (e) {
    return { id: row.id, ok: false, reason: (e as Error).message };
  }
}

async function processQueue(queue: InterviewRow[]) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const total = queue.length;

  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) break;
        const result = await repairOne(row);
        processed++;
        if (result.ok) {
          if (result.reason?.startsWith("skipped") || result.reason === "dry-run") skipped++;
          else succeeded++;
        } else {
          failed++;
        }
        const status = result.ok ? (result.reason ?? "ok") : `FAIL: ${result.reason}`;
        console.log(`[${processed}/${total}] ${row.id} → ${status}`);
      }
    })());
  }
  await Promise.all(workers);

  console.log("");
  console.log("=== Summary ===");
  console.log(`Total candidates: ${total}`);
  console.log(`Repaired:        ${succeeded}`);
  console.log(`Skipped:         ${skipped}`);
  console.log(`Failed:          ${failed}`);
}

async function main() {
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"} · limit=${limit}`);
  const candidates = await fetchCandidates();
  console.log(`Found ${candidates.length} candidate(s) for repair.`);
  if (candidates.length === 0) {
    console.log("Nothing to do.");
    return;
  }
  await processQueue(candidates);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
