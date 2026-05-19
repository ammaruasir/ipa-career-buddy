# Tour Script — Step-by-Step Scroll & Spotlight Audit

I traced every one of the ~46 steps in `src/demo/tour-script.ts` against what's actually on each target page. Result: **6 steps don't scroll to the feature their narration describes**, all caused by `spotlight: { selector: "main" }`.

## Why these 6 fail

`DemoSpotlight` pre-scrolls to the centre of the spotlight selector. When the selector is `"main"`, that's a huge container, so:
1. The "oversize" guard (>70% viewport) suppresses the rectangle and renders only a tiny top banner.
2. The pre-scroll lands at the *vertical centre of `<main>`*, which on long pages (CV builder, CV review, results, jobs, voice interview) is the wrong place — the feature being narrated is above or below the fold.

Every other step is correctly scoped to a specific `data-tour` anchor or naturally tiny element (`form`, `h1`).

## Full per-step audit

✅ = correctly anchored / scroll lands on the discussed feature
❌ = generic `main` selector → no proper scroll, no rectangle

| Step | Verdict | Notes |
|------|---------|------|
| act1-intro | ✅ | No spotlight (pure narration) |
| act1-landing | ✅ | `main h1` is small, scrolls correctly |
| act1-features | ✅ | `main h1` correct |
| act2-signup-form | ✅ | `form` + types email |
| act2-forgot-password | ✅ | `form` |
| act2-session-swap-candidate | ✅ | Session swap, no UI |
| act2-complete-profile | ✅ | `main h1, main h2` correct |
| act2-first-dashboard | ✅ | `[data-tour='candidate-stats']` |
| act2-pdpl-banner | ✅ | Now works (prefill disabled) |
| act3-cv-hub | ✅ | `[data-tour='cv-method-cards']` |
| **act3-cv-interview-open** | ❌ | `main` — narrates the start card |
| act3-cv-interview-start | ✅ | Click action self-scrolls |
| act3-cv-interview-answer | ✅ | Type action self-scrolls |
| act3-cv-interview-next | ✅ | Click action self-scrolls |
| **act3-cv-builder** | ❌ | `main` — narrates the top toolbar (ATS badge, template, language) but doesn't scroll there |
| act3-cv-job-align-open / paste / analyze | ✅ | Click/type self-scroll |
| act3-cv-export | ✅ | `[data-tour='export-pdf']` |
| **act3-cv-review** | ❌ | `main` — narrates the radar chart but scroll lands at page middle |
| act3-cv-chat-input / send | ✅ | Self-scroll |
| act4-dashboard-revisit | ✅ | `[data-tour='training-section']` |
| **act4-practice-open** | ❌ | `main` on voice interview page — narrates "session starting" but spotlight is generic |
| act4 pause/start/turns/end/wrap | ✅ | Action-only, live interview is on screen |
| act4-results-overall | ✅ | `[data-tour='overall-score']` |
| act4-results-disc | ✅ | `[data-tour='disc-and-metrics']` — DemoSpotlight re-scrolls on selector change |
| act4-results-star | ✅ | `[data-tour='star-coaching']` — same, scrolls further down |
| **act5-jobs** | ❌ | `main` — narrates the available-jobs page, doesn't land on the jobs grid |
| **act5-assessment-open** | ❌ | `main` — same problem as act4-practice-open |
| act5 pause/start/turns/end | ✅ | Action-only |
| act5-results | ✅ | `[data-tour='overall-score']` |
| act6-bridge | ✅ | Session swap |
| act6-hr-dashboard | ✅ | `[data-tour='hr-stats']` |
| act6-hr-candidates | ✅ | `[data-tour='hr-candidates-table']` — far below stats, scrolls correctly |
| act6-pipeline | ✅ | `[data-tour='pipeline-column-interviewing']` |
| act6-compare | ✅ | `[data-tour='compare-radar']` |
| act6-decision | ✅ | Reuses compare-radar (same area, fine) |
| act7-bridge | ✅ | Session swap |
| act7-cohort-detail | ✅ | `[data-tour='cohort-students']` (demo short-circuit) |
| act7-timestamped | ✅ | Same selector — DemoSpotlight won't re-scroll, but the area is already on screen |
| act8-recap | ✅ | `main h1` |
| act8-cta | ✅ | `form` |

## Fix plan

### 1. Add 5 focused `data-tour` anchors

| File | Anchor | Wraps |
|------|--------|------|
| `src/pages/CVInterview.tsx` | `data-tour="cv-interview-intro"` | The intro card containing `cv-interview-start` button (~line 504 wrapper) |
| `src/pages/CVBuilder.tsx` | `data-tour="cv-builder-toolbar"` | The sticky header block (lines ~432–470) showing step label, progress, ATS badge, template, language |
| `src/pages/CVReview.tsx` | `data-tour="cv-review-radar"` | The "جودة الأقسام" radar card (lines 366–388) |
| `src/pages/JobVacancies.tsx` | `data-tour="jobs-hero"` | The hero block "استعرض الوظائف المتاحة" (lines 199–202) |
| `src/components/interview/LiveInterview.tsx` | `data-tour="interview-pre-start"` | The wrapper around the start screen (the same card that already hosts `[data-tour='start-interview']`) |

No layout or styling changes — only attribute additions.

### 2. Repoint the 6 broken steps in `src/demo/tour-script.ts`

- **act3-cv-interview-open** → `[data-tour='cv-interview-intro']`
- **act3-cv-builder** → `[data-tour='cv-builder-toolbar']`
- **act3-cv-review** → `[data-tour='cv-review-radar']`
- **act4-practice-open** → `[data-tour='interview-pre-start']`
- **act5-jobs** → `[data-tour='jobs-hero']`
- **act5-assessment-open** → `[data-tour='interview-pre-start']`

### 3. Defensive guard in `src/contexts/DemoTourContext.tsx`

In `runStep`, skip the pre-scroll when the resolved spotlight target already covers >70% of the viewport. Prevents future generic selectors from stranding the viewer at the middle of `<main>`:

```ts
const target = document.querySelector(spotlightSel) as HTMLElement | null;
if (target) {
  const r = target.getBoundingClientRect();
  const area = (r.width * r.height) / (window.innerWidth * window.innerHeight);
  if (area <= 0.7) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(380);
  }
}
```

## Out of scope

- All ✅ steps above — no change.
- Mid-interview commentary steps (`act4-resume-comment`, `act5-resume-comment`, `act6-decision`) intentionally have no spotlight change because the relevant UI is already on screen.
- No backend, no schema, no styling, no narration rewrites.

**Total: 7 small file edits** (5 anchor additions + 1 script repointing + 1 context guard).
