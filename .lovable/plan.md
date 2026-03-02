

## Problem

The `analyze-resume` edge function uses `supabase.auth.getClaims(token)` which is **not a valid method** in the Supabase JS client. This causes the function to fail with an error on every call, returning a 401 or throwing an exception. The resume upload succeeds (file goes to storage), but the AI analysis never runs.

The UI shows old `resume_skills` data loaded from the database on page load (lines 95-97 in ProfileSettings), making it look like the analysis returned pre-filled data — but in reality, it's just displaying whatever was previously stored.

## Fix

### 1. Fix `supabase/functions/analyze-resume/index.ts`

Replace the broken `getClaims` call with the correct `supabase.auth.getUser(token)` method:

```typescript
// BEFORE (broken):
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
const userId = claimsData.claims.sub;

// AFTER (correct):
const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
if (authError || !authUser) { return 401 }
const userId = authUser.id;
```

### 2. Clear stale `resumeSkills` on new upload (ProfileSettings.tsx + CompleteProfile.tsx)

When a user uploads a new resume, clear the displayed skills immediately so old data doesn't persist while analysis runs:

```typescript
// Add before the upload call:
setResumeSkills(null);
```

This ensures users see the loading state during analysis rather than stale data from a previous resume.

