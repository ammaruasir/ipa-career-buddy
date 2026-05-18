## Why the demo voice is silent

The console shows the same error on every TTS attempt:

```
NotSupportedError: Failed to load because no supported source was found.
```

That means the blob handed to `new Audio(...)` is not audio. Tracing the call:

1. `/demo` is a **public, unauthenticated** route.
2. `useDemoVoice.speak()` (and `useDemoCandidate.askSara()`) call the production `elevenlabs-tts` edge function with `Authorization: Bearer <anon publishable key>` as a fallback when no session exists.
3. `supabase/functions/elevenlabs-tts/index.ts` (lines 50–69) requires a real signed-in user — `auth.getUser(token)` fails for the anon key and returns **401 JSON** (`{"error":"Unauthorized"}`).
4. The client wraps that JSON body in an audio element → `NotSupportedError`.

`demo-chat`, `demo-candidate-bot`, and `demo-transcribe` already follow the correct pattern (no JWT, IP-rate-limited via `enforceIpRateLimit`). The TTS path was the one piece left routed through the gated production function — which is also the cost-isolation issue called out in the earlier review.

## Plan

### 1. New edge function: `demo-elevenlabs-tts`

`supabase/functions/demo-elevenlabs-tts/index.ts` — clone of `elevenlabs-tts` with these differences:

- No `getUser`/auth gate. Public, like the other `demo-*` functions.
- Rate-limit by IP using `enforceIpRateLimit(req, "demo-elevenlabs-tts", 120, 3600, corsHeaders)` (≈ enough for one full 39-step tour plus retries; tunable).
- Hard-cap text length (e.g. 1500 chars, same as production).
- Whitelist `voiceId` to the three known demo voices (`presenterVoiceId`, `candidateVoiceId`, `interviewerVoiceId` — all currently the same fallback ID). Any other ID → 400. This prevents demo traffic from being used as a free TTS proxy for arbitrary voices.
- Same ElevenLabs streaming call + `eleven_flash_v2_5` → `eleven_multilingual_v2` fallback as production.
- Same CORS headers as the other `demo-*` functions.

Add a `[functions.demo-elevenlabs-tts]` block with `verify_jwt = false` in `supabase/config.toml` (matching the other demo functions).

### 2. Point the demo hooks at it

- `src/hooks/useDemoVoice.ts` — change the `fetch` URL from `/functions/v1/elevenlabs-tts` to `/functions/v1/demo-elevenlabs-tts`, drop the `Authorization` header and the `supabase.auth.getSession()` call. Keep `apikey: VITE_SUPABASE_PUBLISHABLE_KEY` for gateway routing.
- `src/hooks/useDemoCandidate.ts` — same swap for Sara's TTS call. Drop the session lookup.

### 3. Improve `cleanTextForTTS` (small, while we're here)

The current one-liner only collapses repeated chars. For the demo it should also strip markdown/HTML so Lina doesn't read `**bold**` aloud:

```ts
const cleanTextForTTS = (t: string) =>
  t.replace(/<[^>]+>/g, " ")
   .replace(/[*_`#>]+/g, "")
   .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
   .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
   .replace(/(.)\1{2,}/g, "$1")
   .replace(/\s+/g, " ")
   .trim();
```

Move it to a shared `src/demo/clean-tts.ts` and import from both hooks.

### 4. Verify

- Deploy `demo-elevenlabs-tts`.
- `curl` it with a sample Arabic string and confirm `Content-Type: audio/mpeg` + non-zero body.
- Open `/demo` in an incognito tab, press "ابدأ الجولة", confirm Lina speaks and Sara's answers play.
- Confirm production interview flows (which still use `elevenlabs-tts` with a real session) are unaffected.

## Out of scope

- Voice cloning / Khaleeji voice procurement (Phase B.5).
- Pre-cached MP3 generation (`scripts/precache-demo-tts.ts`) — already exists and will keep working; it should be re-pointed at `demo-elevenlabs-tts` in a follow-up so pre-caching doesn't need a service-role token.
