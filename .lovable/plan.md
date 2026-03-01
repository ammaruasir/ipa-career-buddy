
# Rebranding Complete: Job Interview Platform

## Changes Applied

### Database
- Added `candidate` to `app_role` enum
- Updated all existing `student` roles to `candidate`
- Updated `handle_new_user()` trigger to assign `candidate` role
- Updated RLS policy: "HR can view candidate profiles"

### Code Changes
- **Role**: `student` → `candidate` in `useAuth.tsx`, `DashboardRouter.tsx`, `AdminDashboard.tsx`, `AdminSettings.tsx`
- **Routes**: `/dashboard/student` → `/dashboard/candidate`
- **File**: `StudentDashboard.tsx` → `CandidateDashboard.tsx`
- **Icons**: `GraduationCap` → `Briefcase` across Login, ResetPassword, Dashboard, JobSelector, Index
- **Arabic Text**: Removed all "معهد الإدارة العامة" references, replaced "طالب" with "مرشح"
- **AI Prompts**: Removed institute-specific references from `useInterviewSession.ts` and `evaluate-interview`
- **Meta Tags**: Updated `index.html` title and descriptions
