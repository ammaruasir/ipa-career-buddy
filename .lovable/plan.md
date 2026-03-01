

# Rebranding: From Student Platform to Job Interview Platform

## What Needs to Change

The platform currently uses "student" terminology and "معهد الإدارة العامة" (Institute of Public Administration) branding throughout. Since this is a general **job interview** platform, not a student-specific one, the following changes are needed:

### 1. Role Renaming: `student` → `candidate` (مرشح)
**Database migration** to rename the enum value:
- `app_role`: rename `student` → `candidate`
- Update all `user_roles` rows with `student` → `candidate`
- Update the `has_role` function references

**Code changes** in `useAuth.tsx`, `DashboardRouter.tsx`, `AdminDashboard.tsx`, `AdminSettings.tsx` — replace all `"student"` role references with `"candidate"`.

### 2. Route Renaming
- `/dashboard/student` → `/dashboard/candidate`
- Rename `StudentDashboard.tsx` → `CandidateDashboard.tsx`
- Update `App.tsx` routes accordingly

### 3. UI Text & Branding Changes

| Current (Arabic) | New (Arabic) | File(s) |
|---|---|---|
| لوحة الطالب | لوحة المرشح | CandidateDashboard |
| معهد الإدارة العامة | منصة المقابلات الذكية | Index.tsx, InterviewSettings, edge functions |
| طلاب / طلابنا | مرشحين / مستخدمينا | Index.tsx |
| طالب (role label) | مرشح | AdminSettings.tsx |

### 4. Icon Change
- Replace `GraduationCap` with `Briefcase` or `UserCheck` across Login, ResetPassword, Dashboard, JobSelector pages

### 5. AI System Prompts
- `useInterviewSession.ts`: Remove "معهد الإدارة العامة" from system prompt, make it generic
- `evaluate-interview/index.ts`: Same — remove institute-specific references, keep it as a general professional interview evaluator

### 6. HTML Meta Tags
- `index.html`: Update title and descriptions to remove "معهد الإدارة العامة" and "طلاب"

### Files to Modify
1. **Migration** — rename `student` enum value to `candidate`
2. `src/hooks/useAuth.tsx` — role type update
3. `src/pages/DashboardRouter.tsx` — route path
4. `src/pages/StudentDashboard.tsx` → rename to `CandidateDashboard.tsx`
5. `src/pages/AdminDashboard.tsx` — redirect path
6. `src/pages/AdminSettings.tsx` — role labels
7. `src/App.tsx` — import + route
8. `src/pages/Index.tsx` — all branding text
9. `src/pages/Login.tsx` — icon + text
10. `src/pages/ResetPassword.tsx` — icon
11. `src/components/interview/JobSelector.tsx` — icon
12. `src/pages/Dashboard.tsx` — icon
13. `src/hooks/useInterviewSession.ts` — system prompt
14. `supabase/functions/evaluate-interview/index.ts` — system prompt
15. `index.html` — meta tags

