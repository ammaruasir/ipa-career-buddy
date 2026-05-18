## Goal
Voice interviews (both practice/training and assessment) should not request or use the camera. Currently the cheat-detection camera is activated whenever a voice call is live.

## Where it happens
`src/components/interview/LiveInterview.tsx` (lines ~52-54, 207-215):
- `useCheatCamera({ enabled: type === "voice" && live.isCallActive, ... })` requests `getUserMedia({ video })` for voice mode.
- A picture-in-picture `<video>` element renders the candidate's webcam during voice mode.

`useLiveInterview.ts` already only requests `video: true` when `type === "video"`, so no change needed there.

`TextInterview.tsx` also uses the cheat camera — left untouched since the user's request targets voice mode only.

## Changes
1. **`src/components/interview/LiveInterview.tsx`**
   - Remove the `useCheatCamera` call (and its import) — it was only used for voice mode cheat detection.
   - Remove the voice-mode PiP `<video>` block (lines ~207-215).
   - Keep the video-mode PiP and all video-mode camera logic untouched.

## Result
- Voice mode (training and assessment): mic only, no camera permission prompt, no PiP.
- Video mode: unchanged (camera required as before).
- Text mode: unchanged (still uses cheat camera per existing behavior).
