

## Fix: WebM Recording Only Plays ~15 Seconds

### Root Cause
This is a well-known browser bug: `MediaRecorder` generates WebM files **without duration metadata** in the file header. When played back, the browser can't determine the total length, so it only plays the first cluster (~15 seconds) and the seek bar doesn't work properly.

### Solution
Use the `fix-webm-duration` library to patch the WebM blob with correct duration metadata before uploading to storage. This fixes both the session recording and the cheat camera recording.

### Files to Change

| File | Change |
|------|--------|
| `package.json` | Add `fix-webm-duration` dependency |
| `src/hooks/useLiveInterview.ts` | Patch session recording blob with duration before upload |
| `src/hooks/useCheatCamera.ts` | Patch cheat camera blob with duration before upload |

### How It Works
1. Track recording start time when `MediaRecorder.start()` is called
2. When recording stops, calculate `duration = Date.now() - startTime`
3. Run `fixWebmDuration(blob, duration)` to inject correct metadata into the WebM header
4. Upload the fixed blob instead of the raw one

```typescript
import fixWebmDuration from "fix-webm-duration";

// Before upload:
const duration = Date.now() - recordingStartTime;
const fixedBlob = await fixWebmDuration(sessionBlob, duration);
// Upload fixedBlob instead of sessionBlob
```

This is a small, targeted fix — no UI changes needed. Existing recordings won't be affected, but all new recordings will have proper duration and full seekable playback.

