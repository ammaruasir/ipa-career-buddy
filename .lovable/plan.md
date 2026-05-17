# Improve Interview Voice: Latency + Arabic Quality

## Problems

1. **Latency** — Delay between candidate finishing and assistant replying, plus delay before TTS starts speaking.
2. **Arabic dialect quality** — Current default voice (River `SAz9YHcvj6GT2YYXdXww`) is an English-trained voice. It pronounces Arabic via the multilingual model but with a noticeable foreign accent and poor dialectal feel.

## Recommended Arabic Voice

After reviewing ElevenLabs' voice library, the best results for **natural Arabic (MSA + Gulf/Saudi dialect feel)** come from voices that were trained on native Arabic speakers, not English voices forced through the multilingual model.

Top picks (regardless of sex):

- **Haytham** — male, native Arabic, very natural MSA + Levantine/Gulf feel. Voice ID: `IES4nrmZdUBHByLBde0P`
- **Sana** — female, native Arabic. Voice ID: `mRdG9GYEjJmIzqbYTidv`
- **Mona** (community) — female, strong Saudi/Gulf tone. Voice ID: `tavIIPLplRB883FzWU0V`

Recommendation: default to **Haytham (male)** for best overall Arabic intelligibility and a professional interviewer tone. Keep voice configurable in admin settings as today.

> If the user prefers female (to keep "Noura" branding), use **Sana** or **Mona** — both clearly outperform River for Arabic.

## Latency Improvements

### 1. TTS model + streaming (`supabase/functions/elevenlabs-tts/index.ts`)

- Switch `model_id` from `eleven_multilingual_v2` → `**eleven_flash_v2_5**` (supports Arabic, ~75ms first-byte vs ~400ms+). Falls back to `eleven_turbo_v2_5` if needed.
- Use the `**/stream**` endpoint and pipe the response body directly back to the client (instead of buffering `arrayBuffer()` then returning). The browser starts playback as the first chunk arrives.
- Tune voice settings for speed: `stability: 0.4`, `similarity_boost: 0.8`, `style: 0.0`, `use_speaker_boost: false`, `speed: 1.05`.

### 2. Client playback (`src/hooks/useLiveInterview.ts`)

- Read the streamed response as a `ReadableStream` → `Blob` via `MediaSource` or simply `Response.blob()` once headers arrive (MP3 is playable progressively when set as `audio.src`). Set `audio.preload = "auto"` and call `audio.play()` as soon as `loadedmetadata` fires.
- Kick off the TTS request **in parallel** with the chat response: as soon as the first sentence of the assistant reply is available, start TTS for that sentence while the rest is still being generated (sentence-level streaming).

### 3. Faster turn-taking

- Lower `SILENCE_DURATION` from `1200ms` → `**800ms**` in `useLiveInterview.ts` (still safe for natural pauses, noticeably snappier).
- Start the STT (transcribe-audio) upload the moment silence is detected — no extra confirmation tick.

### 4. Chat model

- Confirm `chat` edge function uses `google/gemini-3-flash-preview` (already the project default per system settings) — fastest reasoning model available on the gateway. No change unless currently overridden.

## Files to change

- `supabase/functions/elevenlabs-tts/index.ts` — switch to flash v2.5, stream response, tune settings.
- `src/hooks/useLiveInterview.ts` — lower silence threshold to 800ms; play TTS progressively; (optional) sentence-level TTS streaming.
- `src/hooks/useSystemSettings.ts` — update `DEFAULT_SETTINGS.interviewer_voice` to Haytham (or chosen voice).
- Seed/update the `system_settings` row via migration so existing installs pick up the new voice.

## Question for you

Which interviewer voice should I set as default?

- **Haytham (male)** — best overall Arabic quality, professional interviewer tone
- **Sana (female)** — native Arabic female, keeps the "Noura" female persona
- **Mona (female)** — Saudi/Gulf dialect lean, keeps female persona

I'll proceed with **Haythm** and chnaged the  preserve the "Noura" branding to Male Haythm unless you say otherwise. And add the option to change the voice in the settings of the platform 