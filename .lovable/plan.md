# Fix Live Proctor visibility + missing recording columns

## What I found

### 1. Live Proctor exists but is unreachable
- Routes are wired in `src/App.tsx`:
  - `/admin/proctor` → `pages/admin/LiveProctor.tsx` (list of in-progress interviews)
  - `/admin/proctor/:interviewId` → `pages/admin/LiveProctorSession.tsx` (live view)
- **There is no link to either route anywhere in the UI.** `AppNav` hides itself for admin/HR, and neither `AdminDashboard.tsx` nor `HRDashboard.tsx` exposes a button or card pointing to `/admin/proctor`.
- The list page also queries the DB for `recording_status` and `recording_chunk_count` — see issue #2.

### 2. Recording columns + bucket size were never migrated
Querying the live DB:
- `interviews.recording_url` exists, but `recording_chunks_path`, `recording_duration_ms`, `recording_chunk_count`, `recording_status`, `flagged_by`, `flagged_reason`, `flagged_at`, `end_reason` **do not exist**.
- `supabase_migrations.schema_migrations` is missing rows for `20260518130000_chunked_recording.sql` and `20260518130100_live_proctor.sql` (the migration files exist on disk; they just never ran on this DB).
- Side effect: `interview-recordings` bucket is still capped at the old size limit, which is what caused the original "playback truncated at ~90s / partial file" symptom the chunked-recording PR was meant to fix.

Consequences:
- `pages/admin/LiveProctor.tsx` `.select("id, ..., recording_status, recording_chunk_count")` → 400 / empty list on this DB.
- `pages/admin/LiveProctorSession.tsx` query and MSE backfill (which read `recording_chunks_path`) → broken.
- `hooks/useLiveInterview.ts` finalize step writes `recording_chunks_path`, `recording_status`, etc. — these silently fail, so even newly finished video interviews never get a playable manifest stored, which is exactly why the candidate detail page shows nothing for this candidate's `interview_id=7ed7fc3c…` (`recording_url=null`, `status=in_progress`).

The candidate you opened (`7ed7fc3c-d559-4394-a1f4-c9db4f905457`) is itself an interview row in `status='in_progress'` with `recording_url=null` and no chunk metadata — so even after the schema fix, that specific row will only show a playable video if the candidate actually completes a new interview. The fix below stops new interviews from hitting the same dead end.

## Changes

### a) Re-run the two missing migrations
Apply (via migration tool, not direct SQL):
- `20260518130000_chunked_recording.sql` — adds `recording_chunks_path`, `recording_duration_ms`, `recording_chunk_count`, `recording_status` (+ index), raises `interview-recordings` bucket to 500 MB.
- `20260518130100_live_proctor.sql` — `proctor_sessions` policies+indexes (table already exists; `CREATE TABLE IF NOT EXISTS` and `CREATE POLICY` are safe — wrap each `CREATE POLICY` in `DROP POLICY IF EXISTS` first to make it idempotent), adds `flagged_by/flagged_reason/flagged_at/end_reason` to `interviews`, adds `responses`, `cheat_events`, `interviews` to `supabase_realtime` publication (guarded with `IF NOT EXISTS`-style DO block since `ADD TABLE` errors if already in publication).

Both will be authored as a single new migration file so we don't try to mutate the existing migration history.

### b) Expose Live Proctor in the admin UI
In `pages/AdminDashboard.tsx`, add a primary action card / button alongside the existing "إدارة المقابلات" and "الإعدادات" entries that links to `/admin/proctor` (label: "المراقبة المباشرة" with the `Eye` or `ScanSearch` icon). Same addition in `pages/HRDashboard.tsx` so HR can also open the live view (the route component already filters by `has_role` admin/hr/instructor).

No changes to `AppNav` (admin/HR don't see it).

### c) No code change needed in `VideoPlayback.tsx` or `CandidateDetail.tsx`
They already read the chunked columns via `(interview as any).recording_chunks_path` etc. Once the columns exist and new interviews finalize correctly, the playback panel will render.

## Verification

1. After the migration runs, `\d interviews` (via `read_query` on `information_schema.columns`) shows the four new recording columns and the four proctor columns.
2. `select file_size_limit from storage.buckets where id='interview-recordings'` returns `524288000`.
3. Load `/admin/dashboard` as admin → new "المراقبة المباشرة" card is visible and links to `/admin/proctor`; the page loads without a 400.
4. Have the candidate finish a short video interview → `interviews.recording_status='complete'` and `recording_chunks_path` is set → candidate detail page renders the chunked player.
