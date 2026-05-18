## Plan

1. Fix the demo voice cache check in `useDemoVoice`
   - Validate the cached `/demo-audio/*.mp3` response before treating it as audio.
   - Reject HTML/app-shell responses and non-audio `Content-Type` values so the hook does not pass invalid blobs to `Audio`.
   - Only use the cached file when it is a real audio response.

2. Preserve a reliable fallback to live demo TTS
   - When the cached file is missing or invalid, continue to `demo-elevenlabs-tts` instead of attempting to play the bad response.
   - Add clearer error handling so failed TTS or non-audio responses reset state cleanly instead of silently failing.

3. Verify the startup path actually works
   - Test the first tour steps (`act1-intro`, `act1-landing`, etc.) to confirm they now play through the live TTS fallback when cached MP3s are absent.
   - Confirm the browser no longer receives HTML as “audio” for playback and that the initial demo narration is audible.

## Technical details

- Root cause found: `public/demo-audio/` is effectively empty (`.gitkeep` only), but `useDemoVoice` treats any `fetch('/demo-audio/<step>.mp3')` with `response.ok` as valid audio.
- In preview, missing files are being rewritten to the SPA HTML shell with status `200`, so the hook creates an `Audio` object from HTML, which triggers `NotSupportedError`.
- The fix is frontend-only and scoped to the demo audio flow; no backend or database changes are needed.