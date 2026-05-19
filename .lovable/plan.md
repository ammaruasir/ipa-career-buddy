# Remove All Rate Limits From Every AI/API Edge Function

Strip rate-limit enforcement from every edge function so usage is unbounded — demo functions AND authenticated functions alike.

## Scope

All 20 functions that currently call `enforceIpRateLimit` or `checkRateLimit` + `rateLimitResponse`:

**Demo (auth-free, IP-limited):**
- `demo-candidate-bot`, `demo-chat`, `demo-wakeb-tts`, `demo-transcribe`, `demo-session`

**Authenticated AI/API (user-limited):**
- `wakeb-tts`, `wakeb-voices`
- `transcribe-audio`
- `suggest-cv-skills`, `generate-cv-bullets`, `improve-cv-summary`, `proofread-arabic`
- `generate-cover-letter`
- `chat-with-cv`, `cv-job-alignment`
- `analyze-video`
- `coach-response`, `evaluate-interview`
- `render-cv-pdf`

## What changes per function

In each `index.ts`:
1. Remove the `enforceIpRateLimit(...)` / `checkRateLimit(...)` call block (and the `rateLimitResponse(...)` short-circuit).
2. Remove the now-unused imports from `_shared/guards.ts` / `_shared/demo-guards.ts`.
3. Leave everything else untouched: auth checks (`verify_jwt`, user JWT validation), input validation, CORS, AI logic.

## Frontend copy

- `src/pages/Demo.tsx` — remove the "حدّ أقصى ٣٠ سؤال لكل جلسة" line.
- `src/contexts/DemoTourContext.tsx` — drop any hard question counter if one exists (verify during edit; otherwise no change).

## What stays

- `_shared/guards.ts` and `_shared/demo-guards.ts` files stay on disk (other helpers may live there) — only the *calls* are removed.
- The `check_rate_limit` Postgres function and `rate_limits` table stay (harmless, unused).
- Auth, RLS, input validation, CORS, all AI/business logic untouched.
- Pre-cached demo TTS MP3s stay.

## Risk

With no limits anywhere, any logged-in user (or any visitor on demo endpoints) can drive unlimited spend against `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, and `LOVABLE_API_KEY`. There is no global daily/monthly budget guard. A single abusive user or scraper could exhaust credits. You're accepting that.

## Files touched

20 edge function `index.ts` files + `src/pages/Demo.tsx` (+ `DemoTourContext.tsx` if applicable). No DB migration, no schema, no auth changes.
