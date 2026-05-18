## Root cause

The interviewer is silent because the **`wakeb-tts` edge function is not deployed** (returns 404).

Evidence:
- Console: repeated `TypeError: Failed to fetch` in `useLiveInterview.ts` at the TTS call.
- Supabase analytics for `wakeb-tts`:
  ```
  OPTIONS | 404 | https://…supabase.co/functions/v1/wakeb-tts
  OPTIONS | 404 | …
  ```
- `edge_function_logs` for `wakeb-tts`: **No logs found** (function never boots).
- All other functions (transcribe-audio, chat, evaluate-interview, etc.) boot and respond fine.

So every TTS request from the live interview fails CORS preflight with 404 → the browser surfaces `Failed to fetch` → the client falls back to browser TTS, but browser TTS on this preview environment isn't producing audible Arabic output, so the interviewer appears mute.

The function source (`supabase/functions/wakeb-tts/index.ts`) is correct and unchanged. It just needs to be redeployed.

## Fix

1. **Redeploy `wakeb-tts`** (touch the file with a no-op comment edit to trigger the auto-deploy pipeline, or use the deploy tool directly).
2. After deploy, verify with `curl_edge_functions` (OPTIONS + a small POST) that it returns 200 and audio bytes.
3. Confirm in the live interview that Noura speaks again.

## Out of scope

- No client code changes — `speakText` in `useLiveInterview.ts` is already correct (uses session access token, valid headers).
- No changes to the function logic — only the deployment is missing.

If after redeploy the function still 404s, escalate to the platform (deployment pipeline issue), since the source is committed and other functions in the same project deploy normally.
