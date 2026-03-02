

## Problem

Two issues cause the interview to break when the candidate scrolls:

1. **Anti-cheat `window.blur` listener** (line 33-38 in `useAntiCheat.ts`) fires on scroll — especially in iframe contexts. This is a false positive; scrolling within the interview page is not tab-switching. The blur event can also cause the browser to suspend `AudioContext` and pause `Audio` playback on some browsers.

2. **No recovery for interrupted audio** in `speakText` — if the browser pauses the TTS audio (on blur/scroll), neither `onended` nor `onerror` fires, so the flow gets stuck. Or worse, on some browsers `onerror` fires immediately, resolving the promise and triggering `startListening` before the AI has finished speaking.

Both voice and video interviews share the same `useLiveInterview` hook and `LiveInterview` component, so the fix applies to both.

## Fix

### 1. `src/hooks/useAntiCheat.ts` — Remove `window.blur` listener

Keep only `document.visibilitychange` for tab detection. The `blur` event is too aggressive — it fires on scroll, iframe focus changes, and clicking within the page. `visibilitychange` is the correct API for detecting actual tab/window switches.

### 2. `src/hooks/useLiveInterview.ts` — Add audio resilience

- Store the `Audio` element in a ref so it can be managed across the lifecycle
- Add a `pause` event handler that automatically resumes playback if the interview is still active (prevents browser auto-pause from breaking the flow)
- Add a `visibilitychange` listener during playback that resumes audio + `AudioContext` when the page becomes visible again

