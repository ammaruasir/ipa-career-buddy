# Fix: Demo tour hangs at "tour is starting" + slow first launch

## Root cause analysis

The demo button stays stuck on **"الجولة قيد التشغيل…"** because of this chain in `src/contexts/DemoTourContext.tsx → start()`:

```
setStatus("running")        // button now shows "starting…"
await runStep(tourScript[0])
└── voice.speak(step.narration, undefined, step.id)
    ├── try cached /demo-audio/act1-intro.mp3  (no file in /public → falls through, correct)
    └── POST /functions/v1/demo-wakeb-tts
        └── if !response.ok → throws "TTS request failed: <status>"
```

If the TTS POST fails for any reason (IP rate-limit `429` after repeated tries, transient `5xx`, network timeout, autoplay block), `speak()` **throws**. The throw bubbles out of `runStep` → out of the `for` loop in `start()` → the final `setStatus("finished")` never runs, so `status` stays at `"running"` and the button label is frozen.

There is also **no timeout** on the TTS fetch, so a stalled upstream (ElevenLabs hiccup) hangs the entire tour indefinitely.

The "takes too much time to start" complaint is a separate but related issue: the very first step has no pre-cached audio, so after the click the user waits for `primeAudio + TTS roundtrip + first audio chunk` (~2–4 s) of silence before anything visible happens.

I verified `demo-wakeb-tts` itself responds in ~1.5 s with valid `audio/mpeg`, so the function is healthy — the client just isn't resilient to the cases where it isn't.

## Plan

### 1. Make `voice.speak` non-throwing + bounded
File: `src/hooks/useDemoVoice.ts`

- Wrap the `demo-wakeb-tts` POST with an `AbortController` and a **12 s timeout**.
- If the request fails or times out, log a `console.warn`, surface a one-time `toast.error` ("تعذّر تشغيل الصوت — تكمل الجولة بدون نطق")، **resolve** instead of throwing, and clear `isSpeaking`.
- Same treatment for the cache-fetch branch (already swallowed, keep as-is).
- Net effect: a TTS failure degrades to silent narration; the tour keeps moving.

### 2. Harden `start()` / `runStep` in the tour engine
File: `src/contexts/DemoTourContext.tsx`

- Wrap each `await runStep(tourScript[i])` in `try { … } catch (e) { console.warn(...) }` so one bad step never freezes the whole tour status.
- In `start()`, if the loop exits via `cancelRef`, leave status untouched; otherwise always end with `setStatus("finished")` (already the case once #1 stops the throw).
- Add a guard so `start()` is a no-op if `status === "running" | "qna"` (prevents the button from re-arming a second loop on accidental double-click).

### 3. Immediate visual feedback after click
File: `src/contexts/DemoTourContext.tsx` + `src/pages/Demo.tsx`

- Move `setStatus("running")` to **before** `voice.primeAudio()` so the `DemoOverlay` mounts instantly with a "جاري تجهيز الجولة…" indicator instead of the page sitting silent for 2–4 s.
- Update the Demo page button label: `status === "running" && stepIndex === 0 && !voice.isSpeaking` → show "جاري تجهيز الصوت…" (more honest than "قيد التشغيل").

### 4. Preload the first narration to eliminate the cold-start gap
File: `src/contexts/DemoTourContext.tsx`

- On `DemoTourProvider` mount, fire a low-priority `fetch` (no playback) to `demo-wakeb-tts` for the first step's narration, store the resulting `Blob` in a ref keyed by `tourScript[0].id`.
- Modify `voice.speak()` to accept an optional pre-fetched `Blob` and play it directly, skipping the network round-trip on the first step.
- Cancel/ignore the preload if `start()` is invoked before it resolves (no double-play).
- Saves ~2–3 s on the very first click and avoids the silent gap that users perceive as "stuck".

### 5. Surface failures instead of hiding them
File: `src/contexts/DemoTourContext.tsx`

- When the catch in #2 fires, append a `TranscriptEntry` `{ role: "presenter", text: "(تعذّر النطق لهذه الخطوة)" }` so the operator sees what happened in the transcript panel.

## Out of scope

- Recording / committing pre-rendered `/demo-audio/*.mp3` cache files (separate Phase F task).
- Changes to `demo-wakeb-tts` itself (function is healthy).
- Procuring distinct presenter/candidate voices.
- Touching the interviewer (Noura/عبدالله) flow — those fixes already shipped in the previous turn.

## Technical notes

- AbortController pattern:
  ```ts
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try { … fetch(url, { signal: ctrl.signal }) … } finally { clearTimeout(timer); }
  ```
- The preload-blob ref shape: `Map<stepId, Promise<Blob | null>>` so a single in-flight preload is awaited rather than refetched if `speak()` races it.
- Button-disabled condition in `Demo.tsx` stays the same; only the label changes based on `stepIndex` and `isSpeaking`.
