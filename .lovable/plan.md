# AI Demo Tour — Full Audit & Fix Plan

I traced every step in `src/demo/tour-script.ts` against the runtime (`DemoTourContext`, `DemoSpotlight`, action handlers, target pages, and `data-tour` markers) and the actual routes. The tour is **mostly wired correctly**, but has **8 concrete defects** that either break the spotlight rectangle, break an action, or break the journey continuity.

---

## How the tour works (recap)

- `Demo.tsx` "ابدأ الجولة" → `start()` in `DemoTourContext`.
- For each `TourStep`: navigate → pre-scroll spotlight target → narrate (TTS) + run action (fire-and-forget) → wait `max(MIN_STEP_DURATION_MS, durationEstimateMs)`.
- `DemoSpotlight` re-measures `spotlight.selector` and draws the ring + dark mask, or a top banner if the target covers >70% of viewport.
- `DemoPresenter` shows narration + Q&A; hidden when `status === "finished"`.

---

## Defects found

### 1. `act2-pdpl-banner` will never light up
- After `swap-session: candidate`, `prefillDemoConsents()` upserts all three PDPL consents.
- The ConsentBanner then sees consents are already granted and never opens.
- Selector `[role='dialog'], [data-tour='consent-banner']` matches nothing → spotlight blank, viewer hears 13s narration over an empty dashboard.
- **Fix:** either (a) drop the step and fold the PDPL message into `act2-first-dashboard` narration, or (b) skip `prefillDemoConsents` until *after* this step (defer to next nav).

### 2. `act4-start-interview` fallback selector is unsafe
- Falls back to `main button:not([disabled])` if `[data-tour='start-interview']` isn't found, which can click any random button (e.g. "خروج", language toggle).
- **Fix:** remove the generic fallback; if the marker is missing, log and abort the step instead of clicking blindly.

### 3. `question_count` query param is ignored
- Script navigates to `/interview/voice?practice=true&question_count=2` and `?job=demo&question_count=2`, expecting 2-question runs.
- `LiveInterview` only reads `practice` and `job`; `question_count` is dropped → the live interview uses the default question count (≫2), so `ai-vs-ai-turn` runs out of `durationEstimateMs` and the tour desyncs.
- **Fix:** read `question_count` from `searchParams` in `LiveInterview` and pass it into the interview-start payload.

### 4. `?job=demo` likely won't start the assessment
- `act5-assessment-open` passes `job=demo`, but there's no seeded job with that id. The page may stall on "job not found" and `start-live-interview` will find no enabled start button.
- **Fix:** either seed a demo job row, or change the param to drop `job=` (start in generic mode) and let the script narrate the framing.

### 5. `act7-cohort-detail` route uses `cohort/demo` but no demo cohort exists
- `CohortDetail` queries `from("cohorts").eq("id", id)` with `id = "demo"`; that query returns nothing for a UUID column → the page renders an empty/loading state and `[data-tour='cohort-students']` never mounts.
- **Fix:** either seed a demo cohort and use its real id (resolved via a small helper at tour start, similar to `lastInterviewId`), or have `CohortDetail` short-circuit to a hard-coded preview when `id === "demo"`.

### 6. `act7-timestamped` highlights the wrong element
- Same selector as the prior step (`cohort-students`) but narration is all about "press timestamp 02:35 on the video". The students list is not the video player.
- **Fix:** add a `data-tour="video-timestamp-feedback"` marker on the actual timestamped-feedback UI in `CohortDetail` (or whichever component renders it) and point the spotlight there. If the UI doesn't yet exist on this page, drop the step or move it to the page that does.

### 7. Action-only steps can outlive their `durationEstimateMs`
- `runStep` runs `action` fire-and-forget (`runAction(step.action).catch(...)`) and waits only on `Promise.all([speaking, minWait])`. For `ai-vs-ai-turn` the action internally awaits fetch + TTS + 8s settle, easily exceeding 28s.
- Result: the *next* step navigates away mid-interview, the bot answer never reaches the live pipeline, and `__demoLastInterviewId` is never captured → results steps fall back to `/dashboard/candidate`.
- **Fix:** for steps whose `action.kind` is in `{start-live-interview, ai-vs-ai-turn, end-live-interview}`, `await` the action *before* the minWait (or treat the action as the gating promise). Keep typing/clicks fire-and-forget so narration can play over them.

### 8. `MIN_STEP_DURATION_MS = 4500` floors silent action steps
- `act4-pause-narrator`, `act4-pause-2`, `act5-pause`, `act5-pause-2` set `durationEstimateMs: 3000` but get pushed to 4.5s. Minor but it makes the script feel laggy.
- **Fix:** skip the floor when `narration === ""` (the floor is for human reading time; silent transition steps don't need it).

---

## Things verified as correct (no change needed)

- All `route` strings exist in `App.tsx`.
- All `data-tour` selectors used as spotlight targets resolve to real markers, **except** the ones listed above.
- `pipeline-column-interviewing` ✓ (`STAGES[2].key === "interviewing"`).
- `__demoSubmitAnswerText` / `__demoLastInterviewId` are installed by `LiveInterview` on mount and cleaned up on unmount.
- `CVReview` honours `?demo=preloaded`.
- The auto-dialog-dismiss observer correctly handles unexpected modals.
- Voice priming happens inside the user-gesture window in `start()` ✓.
- Tour terminates cleanly: `status` transitions to `finished` and `DemoPresenter` unmounts itself.

---

## Implementation order (when approved)

1. `src/components/interview/LiveInterview.tsx` — read `question_count`, pass into interview-start.
2. `src/contexts/DemoTourContext.tsx` — await long-running actions; remove unsafe `main button` fallback; lift `MIN_STEP_DURATION_MS` floor for empty narration; defer `prefillDemoConsents`.
3. `src/demo/tour-script.ts` — adjust `act2-pdpl-banner` (or drop), fix `?job=demo` framing, repoint `act7-timestamped` selector, optionally repoint `act7-cohort-detail` to a real cohort id.
4. `src/pages/instructor/CohortDetail.tsx` — add `id === "demo"` short-circuit OR seed demo cohort (decide during impl).
5. Add `data-tour="video-timestamp-feedback"` to the timestamped-feedback UI if it exists on `CohortDetail`; otherwise rework the step.
6. Manual run-through of the full tour in preview to confirm every spotlight lands and the journey reaches `act8-cta`.

No backend schema changes required unless we choose the "seed demo cohort + demo job" option (one migration with two static rows).
