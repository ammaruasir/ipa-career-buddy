

## Problem

The live interview gets stuck at "Listening to you..." because the silence detection never triggers `recorder.stop()`. Two likely causes:

1. **No maximum recording duration** — If ambient noise keeps the RMS above the threshold (15), the recording runs forever with no fallback timeout.
2. **Threshold too low** — A threshold of 15 on `getByteFrequencyData` RMS is very low; ambient room noise can easily exceed it, meaning "silence" is never detected.
3. **No `timeslice` on `MediaRecorder.start()`** — `ondataavailable` only fires on `stop()`, which never comes if silence isn't detected.

## Fix

### Update `src/hooks/useLiveInterview.ts`

1. **Add a maximum recording timeout** (e.g., 45 seconds) — if silence detection hasn't stopped the recording by then, force-stop it as a fallback.

2. **Raise the silence threshold** from 15 to ~30 and reduce silence duration from 2500ms to 2000ms for more reliable detection.

3. **Use `recorder.start(1000)` with a timeslice** so `ondataavailable` fires periodically, ensuring chunks are captured even if stop is delayed.

4. **Add console.log statements** for key events (recording started, RMS levels periodically, silence detected, recording stopped) to aid future debugging.

5. **Add a "require speech first" guard** — only start silence detection after the user has actually spoken (RMS exceeded a "speech detected" threshold at least once), preventing premature cutoff on ambient silence.

```text
Flow after fix:
AI speaks → onended → startListening() → recorder.start(1000) →
  wait 1.5s → begin silence check loop →
    wait for speech (RMS > 30 at least once) →
      then detect 2s of silence → stop recorder →
        handleRecordingComplete(blob) →
          transcribe → chat → speakText → loop

Fallback: max 45s timeout force-stops recording
```

