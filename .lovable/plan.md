## Fix: ElevenLabs voice silent in voice/video interviews

### Diagnosis
The edge function `elevenlabs-tts` works correctly — direct test returned 200 with valid MP3 bytes. The issue is client-side in `src/hooks/useLiveInterview.ts`.

When the interview starts, the code creates an `AudioContext` (`mixingCtx`) for recording (line 748). Then in `speakText` it wires the TTS `<audio>` element through `createMediaElementSource(audio)` and connects it to both `mixedDest` (recording) and `mixingCtx.destination` (speakers).

**The problem**: once an `HTMLMediaElement` is bound to a `MediaElementAudioSourceNode`, all its sound is routed through the `AudioContext` and **stops playing through the default output**. If the `AudioContext` is in `suspended` state (browser autoplay policy — common when the context is created inside an async chain rather than directly in the click handler), `audio.play()` succeeds but **no audio is heard**.

That's exactly why the user hears nothing during voice/video interviews but text-mode/`AdminSettings` preview works fine.

### Fix
In `src/hooks/useLiveInterview.ts`:

1. **After creating the mixing context** (line ~749), immediately call:
   ```ts
   await mixingCtx.resume().catch(() => {});
   ```

2. **Inside `speakText`**, before `audio.play()`, resume the context if it's still suspended:
   ```ts
   if (mixingCtxRef.current?.state === "suspended") {
     await mixingCtxRef.current.resume().catch(() => {});
   }
   ```

3. **Set `audio.crossOrigin = "anonymous"` BEFORE** the `new Audio(audioUrl)` line is moot for blob URLs, but also wrap the `createMediaElementSource` call so that if it throws (e.g., element already attached), we fall back to playing the audio without mixing — that way at least the candidate hears the AI even if the recording loses the TTS track:
   ```ts
   let mixedSuccessfully = false;
   if (mixingCtxRef.current && mixedDestRef.current) {
     try {
       const ttsSource = mixingCtxRef.current.createMediaElementSource(audio);
       ttsSource.connect(mixedDestRef.current);
       ttsSource.connect(mixingCtxRef.current.destination);
       mixedSuccessfully = true;
     } catch (e) {
       console.warn("[AudioMix] mix failed, playing direct:", e);
     }
   }
   // If mixing failed, audio still plays through default output normally.
   ```

### Files touched
- `src/hooks/useLiveInterview.ts` (only)

### Verification
After the fix, start a voice interview as `student1@test.com` → AI greeting should be audible. Recording should still capture both mic and TTS.