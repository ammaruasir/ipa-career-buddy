

## Add Fallback "End Interview" Button on Candidate Dashboard

### Problem
When auto-closure fails, interviews remain stuck as "in_progress" (جارية) on the dashboard with no way for the candidate to manually close them.

### Solution
Add an "إنهاء المقابلة" button next to interviews with `status === "in_progress"` in the interview history section of `CandidateDashboard.tsx`. The button calls the `complete-interview` edge function to mark it as completed.

### File: `src/pages/CandidateDashboard.tsx`

| Change | Details |
|--------|---------|
| Add state for loading/confirmation | Track which interview is being ended + confirmation dialog |
| Add `handleForceEnd` function | Calls `complete-interview` edge function, then refreshes the interview list |
| Add button in interview history | Shows a destructive "إنهاء المقابلة" button next to any `in_progress` interview |
| Add `ExitConfirmationDialog` | Reuse existing confirmation dialog to prevent accidental clicks |

```text
┌──────────────────────────────────────────────────┐
│ 📝 محلل أعمال   |  مقابلة نصية                   │
│                  |  [جارية]  [🔴 إنهاء المقابلة]  │
└──────────────────────────────────────────────────┘
```

The button will:
1. Show a confirmation dialog first
2. Call `supabase.functions.invoke("complete-interview", { body: { interview_id } })`
3. Update local state to reflect the change immediately

