

## Plan: Switch TTS from ElevenLabs to OpenAI

The chat and evaluation already use OpenAI GPT-4. The TTS (text-to-speech) still calls ElevenLabs. This plan replaces it with OpenAI's TTS API, which uses the same `OPENAI_API_KEY` already configured — no new secrets needed.

### Changes

**1. `supabase/functions/elevenlabs-tts/index.ts`** — Rewrite to call OpenAI TTS:
- Use `https://api.openai.com/v1/audio/speech` with model `gpt-4o-mini-tts`
- Use voice `ash` (good for Arabic)
- Use `OPENAI_API_KEY` (already configured) instead of `ELEVENLABS_API_KEY`
- Return MP3 audio binary as before — no client changes needed
- Keep the same endpoint name so `useLiveInterview.ts` works without modification

**2. `src/hooks/useLiveInterview.ts`** — No changes needed (already calls the same edge function URL and handles the audio blob response identically).

### Technical Detail
OpenAI TTS API request:
```
POST https://api.openai.com/v1/audio/speech
{
  "model": "gpt-4o-mini-tts",
  "input": text,
  "voice": "ash",
  "response_format": "mp3",
  "speed": 0.95
}
```
Returns raw MP3 binary — same format as ElevenLabs, so the client code stays the same.

### Files Modified
- `supabase/functions/elevenlabs-tts/index.ts` (rewrite internals, keep endpoint name)

