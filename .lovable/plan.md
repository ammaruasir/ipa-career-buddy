# Demo Mode Deployment

All files from commit `170e0ba` are present in the tree. Execute the runbook in order.

## Step 1 — Deploy 4 edge functions
Single `deploy_edge_functions` call with:
`["demo-chat", "demo-candidate-bot", "demo-transcribe", "demo-session"]`

(All four directories exist under `supabase/functions/`. Required secrets `OPENAI_API_KEY`, `LOVABLE_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are already provisioned — no `add_secret` needed.)

## Step 2 — Apply migration
Run `supabase--migration` with the contents of `supabase/migrations/20260518160000_demo_mode_scaffold.sql` exactly as committed.

Effects (per file header):
- Adds `is_demo boolean default false` to: `profiles`, `interviews`, `responses`, `evaluations`, `cv_drafts`, `cohorts`, `enrollments`, `job_vacancies`, `question_templates`.
- Creates `public.is_demo_account()` helper (SECURITY DEFINER).
- Adds symmetric RESTRICTIVE RLS policies on the 9 tables: hide `is_demo=true` from regular users; restrict demo accounts to `is_demo=true` only.

Safe: RESTRICTIVE composes via AND with existing permissive policies; no existing rows modified.

After approval+execution, run `supabase--linter` to confirm zero new warnings.

## Step 3 — Seed demo data
Run `node scripts/seed-demo-data.ts` via `code--exec`. Idempotent. Creates 5 accounts (`demo-candidate`, `demo-candidate2`, `demo-admin`, `demo-hr`, `demo-instructor` @ `ipa-training.sa`), plus demo vacancy, 5 question-bank rows, and a demo cohort with both candidates enrolled — all `is_demo=true`.

Uses `SUPABASE_SERVICE_ROLE_KEY` from env. Default passwords are hardcoded in `demo-session/index.ts`.

If the script needs `tsx`/`ts-node`, fall back to `bunx tsx scripts/seed-demo-data.ts`.

## Step 4 — Verify
Use `browser--navigate_to_sandbox` to `/demo`, then `browser--act` to tick the mic-consent box and click "ابدأ الجولة". Confirm Lina speaks Arabic and the tour auto-navigates through admin/HR/instructor acts. Capture console + network if anything fails.

## Step 5 — Optional post-checks
Only if Step 4 passes, run via `code--exec`:
- `node scripts/precache-demo-tts.ts`
- `node scripts/demo-rls-audit.ts`
- `node scripts/demo-latency-profile.ts`

Report results inline.

## Notes
- No source code changes; pure deploy + data ops.
- If migration approval is declined, stop and surface back to user.
- If seed fails on a duplicate, treat as already-seeded (idempotent) and continue.
