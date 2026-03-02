

## Problem

When a candidate applies to a job from the **Job Vacancies** page, they already selected the job and the interview type. The app navigates to `/interview/voice?job=JobTitle&vacancy_id=xxx`. However, the `VoiceInterview` and `VideoInterview` pages **ignore the `job` URL parameter** — they always start with `selectedJob = null`, which shows the `JobSelector` component again, asking the user to pick a job a second time.

The `TextInterview` page (via `useInterviewSession`) already handles the `job` URL param with auto-start logic, but the voice/video pages don't.

## Fix

### Update `src/pages/VoiceInterview.tsx` and `src/pages/VideoInterview.tsx`

Read the `job` query parameter from the URL on mount. If present, set `selectedJob` directly — skipping the `JobSelector` entirely.

```typescript
const [searchParams] = useSearchParams();
const [selectedJob, setSelectedJob] = useState<string | null>(
  searchParams.get("job")
);
```

That's it — one line change per file. If `job` is in the URL (coming from vacancies), the `JobSelector` is skipped. If the user navigates directly (no URL param), they still see the job picker as before.

