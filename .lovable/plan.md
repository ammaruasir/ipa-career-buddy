## Merge health check

I scanned the new code from the merge against the database and runtime logs. Most things look healthy:

- All new routes (`/cv/builder`, `/cv/review`, `/cv/interview`, `/dashboard/instructor`, `/dashboard/instructor/cohort/:id`) are registered in `App.tsx`.
- `CVHubSection` and `TrainingSection` are mounted in `CandidateDashboard`.
- No build/runtime errors in the dev server log or browser console (only harmless React Router v7 future-flag warnings).
- Edge functions boot cleanly (no errors in `analyze-resume` logs).

### One real problem: `instructor` role is not in the database

The merge added an Instructor layer in the UI:

- `src/hooks/useAuth.tsx` does `if (roles.includes("instructor")) setRole("instructor")`
- `src/pages/DashboardRouter.tsx` routes `role === "instructor"` to `/dashboard/instructor`
- `InstructorDashboard` and `CohortDetail` pages exist

But the `app_role` enum in the database is still:
```
"student" | "admin" | "hr" | "candidate"
```

Consequences:
- You cannot insert a row in `user_roles` with `role = 'instructor'` — Postgres rejects it as an invalid enum value.
- Any `has_role(uid, 'instructor')` call (likely used in instructor RLS policies / cohort tables) will fail at runtime.
- The `/dashboard/instructor` route is effectively unreachable today — no user can be flagged as an instructor.

### Fix

Add `instructor` to the `app_role` enum via a migration:

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instructor';
```

After running it, `src/integrations/supabase/types.ts` will regenerate to include `'instructor'`, and you'll be able to assign the role from the admin panel.

### Optional follow-ups (not blocking)

- Add a UI in `AdminSettings` / `UserManagement` to assign the `instructor` role to a user.
- Verify the `cohorts` / instructor-related RLS policies reference `has_role(auth.uid(), 'instructor')` correctly once the enum value exists.

Shall I apply the migration?
