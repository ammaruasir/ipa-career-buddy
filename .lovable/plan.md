

## Auto-evaluate after fallback end

### Problem
The fallback "End Interview" button calls `complete-interview` which only sets `status = 'completed'`. It does not call `evaluate-interview`, so the interview remains ungraded.

### Solution
In `src/pages/CandidateDashboard.tsx`, after the `complete-interview` call succeeds, immediately invoke `evaluate-interview` with the same `interview_id`.

### File: `src/pages/CandidateDashboard.tsx`

**Change in `handleForceEnd`:**
After `complete-interview` succeeds, add:
```typescript
// Trigger evaluation
await supabase.functions.invoke("evaluate-interview", {
  body: { interview_id: endingInterviewId },
});
```

The evaluation may take a few seconds (AI processing). A toast message will inform the candidate that grading is in progress. If evaluation fails, the interview is still marked completed — the candidate just won't see results immediately (HR can trigger re-evaluation from their side).

