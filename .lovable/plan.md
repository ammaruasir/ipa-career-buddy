

## Problem

The current live interview uses **browser TTS** (`window.speechSynthesis`) for speaking Arabic text. Browser TTS has very poor Arabic support on most platforms — voices are robotic, often unavailable, or simply don't work.

## Solution: Replace Browser TTS with ElevenLabs TTS

Use ElevenLabs' `eleven_multilingual_v2` model, which has excellent Arabic support with natural-sounding voices.

### Changes

**1. Create `supabase/functions/elevenlabs-tts/index.ts`** — New edge function that:
- Accepts `{ text, voiceId }` in the request body
- Calls ElevenLabs API with `eleven_multilingual_v2` model
- Returns raw MP3 audio bytes
- Uses a male Arabic-suitable voice (e.g. George - `JBFqnCBsd6RMkjVDRZzb` or Daniel - `onwK4e9ZLuTAKqWW03F9`)

**2. Add `ELEVENLABS_API_KEY` secret** — Required for the ElevenLabs API. You'll need to provide your API key.

**3. Update `src/hooks/useLiveInterview.ts`** — Replace the `speakText` function:
- Instead of `window.speechSynthesis`, fetch audio from the `elevenlabs-tts` edge function
- Play the returned MP3 blob using `new Audio(URL.createObjectURL(blob))`
- Use the `audio.onended` event to resolve the promise (triggering mic auto-start)
- Set `isSpeaking` state based on audio playback

### How it works
```text
AI text → elevenlabs-tts edge function → MP3 audio blob → Audio playback → onended → auto-start mic
```

This replaces the broken browser TTS while keeping the exact same conversational loop flow.

