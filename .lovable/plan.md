

## Problem

Two issues with the Vapi real-time interview:

1. **Vapi only says "one" and stops** — The inline assistant configuration passed to `vapi.start()` has issues: the ElevenLabs voice ID (`pNInz6obpgDQGcFmaJgB`) is "Adam" which doesn't support Arabic well, and the model/transcriber config may not be structured correctly for the Vapi SDK's expected format.

2. **Not truly real-time** — When the system setting `interview_engine` is `"vapi"`, the code *does* render `VapiLiveInterview` (which is real-time WebRTC). But if the setting is not `"vapi"`, the fallback is the record-based built-in engine. Need to verify the setting is correct.

## Plan

### 1. Fix `useVapiInterview.ts` — Correct the Vapi assistant configuration

- **Use a proper Arabic voice**: Switch from ElevenLabs voice ID "Adam" to an Arabic-native voice. Use Azure voice provider with an Arabic voice (`ar-SA-HamedNeural`) which natively supports Arabic speech.
- **Fix model config**: Use `gpt-4o` instead of `gpt-4o-mini` for better Arabic language support in real-time conversation.
- **Strengthen system prompt**: Add explicit instructions to ONLY speak Arabic, never English, and to maintain a natural conversational flow.
- **Fix `firstMessage`**: Ensure the Arabic greeting is properly set.
- **Add `serverUrl` silencing** and proper assistant name.

### 2. Fix question counting logic

Currently every assistant transcript message increments `questionCount`, which over-counts (comments between questions also count). Fix to only count when the assistant actually asks a question by tracking Q&A pairs properly.

### 3. Verify system settings

Check that the `interview_engine` setting in the database is set to `"vapi"` so users get routed to the real-time path, not the record-based fallback.

### Files Changed

- `src/hooks/useVapiInterview.ts` — Fix voice provider, model, system prompt, and question counting

