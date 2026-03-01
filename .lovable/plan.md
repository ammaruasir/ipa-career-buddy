

# Settings & Configuration Pages

## Overview
Create 3 settings pages: User Profile Settings, Interview Settings (device testing), and Admin Settings. Also add routes to App.tsx. No database schema changes needed — profiles table already has the needed columns.

## Scope Adjustments
- **Photo cropper**: simplified to file upload + preview (a full cropper library is heavy; we'll use a simple avatar upload to storage)
- **Virtual backgrounds**: UI placeholder only (WebGL compositing is out of scope)
- **SMTP/SMS gateway config**: UI-only placeholders (no actual SMTP server to configure)
- **Language switcher**: UI toggle stored in localStorage (full i18n framework not in scope)
- **Question bank**: CRUD UI against a new `question_templates` table

## Database Changes
New table for question bank:
```sql
CREATE TABLE public.question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  question_text text NOT NULL,
  difficulty text DEFAULT 'medium',
  interview_type interview_type NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage questions" ON public.question_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HR can view questions" ON public.question_templates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'hr'::app_role));
```

## New Files

### `src/pages/ProfileSettings.tsx`
- **Profile photo**: Upload to `interview-recordings` bucket (or a new `avatars` bucket), preview with Avatar component, save URL to `profiles.avatar_url`
- **Personal info form**: Name, phone (new field — we'll add via migration), major, GPA — update `profiles` table
- **Change password**: Current + new password fields, strength indicator bar (ضعيف/متوسط/قوي) using regex checks, calls `supabase.auth.updateUser`
- **Notification preferences**: Checkboxes for email/SMS/in-app — stored in localStorage (no backend table needed for MVP)
- **Language toggle**: Arabic/English switch stored in localStorage

### `src/pages/InterviewSettings.tsx`
- **Camera test**: `getUserMedia({ video: true })` → render in `<video>` element with IPA watermark overlay
- **Microphone test**: `getUserMedia({ audio: true })` → AudioContext + AnalyserNode → animated level bar
- **Speaker test**: Play a sample Arabic audio clip via `<audio>` element
- **Virtual backgrounds**: 3 option cards (Blur, Office, IPA Campus) — UI only with "قريباً" badge
- **Accessibility**: Font size slider (updates CSS variable), high contrast toggle, screen reader info card

### `src/pages/AdminSettings.tsx`
- **Branding section**: Logo upload, primary color picker (saves to localStorage for now)
- **Question bank**: Table listing questions from `question_templates`, add/edit/delete modals
- **Scoring weights**: Sliders for technical/communication/confidence/personality weights (stored in localStorage)
- **Integration settings**: Read-only display of configured API keys with masked values
- **User management**: List users from `profiles` + `user_roles`, button to change role (admin RLS allows this)
- **System section**: Maintenance mode toggle, storage quota display, export placeholder

## Modified Files

### `src/App.tsx`
Add 3 lazy-loaded routes:
- `/settings/profile` → `ProfileSettings`
- `/settings/interview` → `InterviewSettings`
- `/admin/settings` → `AdminSettings`

### `src/integrations/supabase/types.ts`
Auto-updated after migration.

### Database migration
- Add `phone`, `major`, `gpa` columns to `profiles` table
- Create `question_templates` table
- Create public `avatars` storage bucket

## Implementation Order
1. Database migration (profiles columns + question_templates + avatars bucket)
2. ProfileSettings page
3. InterviewSettings page
4. AdminSettings page
5. Update App.tsx routes

