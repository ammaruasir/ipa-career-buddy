

## Fix: Add confirmation dialog for ending interview

The "إنهاء المقابلة" button in `LiveInterview.tsx` currently calls `live.endCall()` directly. We need to add a confirmation step.

### Changes in `src/components/interview/LiveInterview.tsx`

- Add a new state `showEndConfirm` 
- When clicking "إنهاء المقابلة", set `showEndConfirm = true` instead of calling `endCall` directly
- Add an `AlertDialog` asking "هل أنت متأكد من إنهاء المقابلة؟" with confirm/cancel
- On confirm: call `live.endCall()` which already marks the interview done and navigates

This reuses the existing `AlertDialog` components already imported via `ExitConfirmationDialog`. We'll add a second simple `AlertDialog` inline or reuse the same pattern.

### File modified
- `src/components/interview/LiveInterview.tsx` only

