

# Comprehensive Role-Based Dashboards

## Overview
Replace the single `/dashboard` with role-routed dashboards: Student, Admin/HR. The existing `/dashboard` will become a router that redirects based on role. Add analytics charts (Recharts already installed), candidate management for Admin/HR, and a notification system.

---

## Database Changes

**No new tables needed.** The existing schema (profiles, interviews, evaluations, responses, user_roles) covers all data needs. The RLS policies already support admin/HR access patterns. Admin/HR queries use existing RESTRICTIVE policies that check `has_role()`.

However, we need one addition for HR notes on candidates:
- Add `hr_notes` table: `id`, `interview_id`, `author_id`, `note_text`, `action` (enum: accepted/rejected/retry/waiting), `created_at`
- RLS: admin/HR can CRUD, students cannot access

---

## Routes

| Route | Component | Access |
|---|---|---|
| `/dashboard` | `DashboardRouter` | Redirects based on role |
| `/dashboard/student` | `StudentDashboard` | Students |
| `/dashboard/admin` | `AdminDashboard` | Admin + HR |
| `/dashboard/admin/candidate/:id` | `CandidateDetail` | Admin + HR |

---

## File Structure

```text
src/pages/
  DashboardRouter.tsx         — role-based redirect
  StudentDashboard.tsx        — full student dashboard
  AdminDashboard.tsx          — admin/HR dashboard with analytics
  CandidateDetail.tsx         — detailed candidate view
```

---

## 1. DashboardRouter (`/dashboard`)
- Check `role` from `useAuth()`
- Redirect: student → `/dashboard/student`, admin/hr → `/dashboard/admin`
- Replaces current `Dashboard.tsx`

## 2. StudentDashboard (`/dashboard/student`)
- **Hero**: Personalized greeting with name from profiles table
- **Stats cards**: Total interviews, average overall_score, in-progress count
- **Quick start buttons**: Text/Voice/Video interview links
- **Progress chart**: Line chart (Recharts) showing overall_score over time from evaluations
- **Recent feedback**: Expandable cards showing latest evaluation summaries (strengths, recommendation)
- **Practice mode button**: Links to `/interview/text` with a "practice" flag
- **Interview history list**: Existing card list with status badges and results links

## 3. AdminDashboard (`/dashboard/admin`)
- **Overview stats**: Total candidates (distinct user_ids in interviews), interviews today, acceptance rate (from hr_notes actions), average score
- **Filterable candidates table**: Fetches all interviews + evaluations + profiles (admin/HR RLS allows this). Columns: Name, Position, Type, Score, Status, Actions (view details)
- **Search + filters**: By status, type, score range, date range
- **Analytics section** (Recharts):
  - Bar chart: Score distribution (buckets 0-20, 20-40, etc.)
  - Pie chart: Interview types breakdown
  - Line chart: Daily interview volume over last 30 days
  - Radar chart: Average skills breakdown (communication, technical, cultural fit)
- **Live monitoring section**: Show interviews with status `in_progress` with real-time indicator

## 4. CandidateDetail (`/dashboard/admin/candidate/:interviewId`)
- **Profile card**: Name, email (from user metadata), branch, avatar
- **Interview info**: Type, position, date, duration
- **AI analysis breakdown**: Colored progress bars for each score category
- **Strengths/improvements lists**
- **DISC personality badge**
- **HR notes section**: Add/view notes with action buttons (قبول/رفض/إعادة/انتظار)
- **Action buttons**: Update interview status, add notes

## 5. Notifications
- Use existing Sonner toast system (already configured) positioned for RTL
- Toast on interview completion (triggered in useInterviewSession — already done)
- No SMS/email integration in this phase (placeholders only)

## 6. Migration
```sql
CREATE TABLE public.hr_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  note_text text,
  action text, -- 'accepted', 'rejected', 'retry', 'waiting'
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR can manage notes" ON public.hr_notes
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));
```

## 7. App.tsx Route Updates
Add routes for `/dashboard/student`, `/dashboard/admin`, `/dashboard/admin/candidate/:id`. Keep `/dashboard` as the router.

## Implementation Order
1. Database migration (hr_notes table)
2. DashboardRouter + StudentDashboard
3. AdminDashboard with charts
4. CandidateDetail page
5. Update App.tsx routes

