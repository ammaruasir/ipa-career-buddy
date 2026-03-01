

# Technical Integrations & Security Features

## Scope Assessment

This is a large request. Many items are already implemented, some are feasible in Lovable, and some require external services that aren't available or practical. Here's what we'll actually build vs. what we'll note as out-of-scope.

---

## Already Implemented (No Changes Needed)
- **Auth with email/password** — already in `useAuth.tsx` with Arabic UI
- **RBAC** — `user_roles` table with `has_role()` function, roles: student, admin, hr
- **Password 8+ chars** — Supabase Auth default, Arabic labels in `Login.tsx`
- **RTL** — `direction: rtl` in `index.css`, Tajawal font
- **Arabic UI** — all pages already use Arabic labels
- **Data privacy** — RLS policies restrict candidate data to authorized HR/admin
- **HTTPS encryption** — Lovable preview/published URLs use HTTPS by default
- **Skeleton screens** — `Skeleton` component exists
- **Mobile responsive** — Tailwind responsive classes throughout

## Out of Scope / Not Feasible
- **Twilio SMS OTP** — requires Twilio account + webhook infrastructure; suggest as future enhancement
- **Google Cloud Vision** — external API, not needed; sentiment analysis is done by AI evaluation
- **Calendar integration** (Google/Outlook) — requires OAuth flows beyond current scope
- **Hijri date picker** — `react-hijri-datepicker` doesn't exist as a maintained package; we'll add Arabic locale date formatting instead
- **Arabic speech-to-text** (DeepGram/Whisper) — requires external API keys; the current manual transcription approach works for MVP
- **Video compression** — browser-side compression is unreliable; we'll set upload size limits instead
- **Auto-delete after 1 year** — requires a cron job; we'll add a placeholder comment
- **Multiple face detection** — requires ML model (TensorFlow.js); too heavy for this phase
- **`tailwindcss-rtl` plugin** — RTL is already handled with `direction: rtl`; not needed
- **OpenAI API** — project already uses Lovable AI via the gateway; no need for a separate OpenAI key

---

## What We'll Build

### 1. Session Timeout (30 min inactivity)
- New `useSessionTimeout` hook in `src/hooks/`
- Tracks mouse/keyboard/touch activity
- After 30 min of no activity, calls `signOut()` and redirects to `/login`
- Shows a warning toast at 25 min
- Wrap in `AuthProvider`

### 2. Anti-Cheating Features
- **New `useAntiCheat` hook** used in all 3 interview pages:
  - **Tab switch detection**: `visibilitychange` + `blur` events → show warning toast, increment counter, save to `responses` metadata
  - **Copy-paste detection** (text mode): `paste` event listener on textarea → block + warning toast
  - **Random question order**: Already handled by AI — questions come from the AI model dynamically. We'll add a shuffle note in the system prompt in `useInterviewSession`
- Display warning banner when tab switches detected

### 3. Media Storage (Supabase Storage)
- Create `interview-recordings` storage bucket (private, 50MB limit)
- RLS: users can upload to their own folder, admin/HR can read all
- Update `VideoInterview` and `VoiceInterview` to upload recordings to storage after stopping
- Save `media_url` in `responses` table (column already exists)

### 4. Arabic Number Formatting Utility
- New `src/lib/arabic-utils.ts` with:
  - `toArabicNumerals(num)` — converts `1234` → `١٢٣٤`
  - `formatArabicNumber(num)` — adds separators: `1,234.56` → `١٬٢٣٤٫٥٦`
- Apply in dashboards for scores and stats

### 5. Lazy Loading for Interview Pages
- Convert interview page imports in `App.tsx` to `React.lazy()` with `Suspense` fallback
- Reduces initial bundle for users who only visit the dashboard

### 6. Optimistic UI for HR Notes
- Update `CandidateDetail.tsx` to immediately show the note in the list before the server responds
- Roll back on error

### 7. Password Reset Flow
- Add "نسيت كلمة المرور؟" link to `Login.tsx`
- Create `src/pages/ResetPassword.tsx` — form to set new password after clicking email link
- Add `/reset-password` route to `App.tsx`

### 8. evaluate-interview config
- Add `evaluate-interview` to `supabase/config.toml` (missing — currently only `chat` is configured)

---

## File Changes

```text
NEW FILES:
  src/hooks/useSessionTimeout.ts     — 30-min inactivity logout
  src/hooks/useAntiCheat.ts          — tab switch, paste detection
  src/lib/arabic-utils.ts            — Arabic number formatting
  src/pages/ResetPassword.tsx         — Password reset page

MODIFIED FILES:
  src/hooks/useAuth.tsx               — integrate session timeout
  src/pages/TextInterview.tsx         — add anti-cheat hook, paste detection
  src/pages/VoiceInterview.tsx        — add anti-cheat hook, media upload
  src/pages/VideoInterview.tsx        — add anti-cheat hook, media upload
  src/pages/Login.tsx                 — add forgot password link
  src/pages/StudentDashboard.tsx      — Arabic number formatting
  src/pages/AdminDashboard.tsx        — Arabic number formatting
  src/pages/CandidateDetail.tsx       — optimistic UI for notes
  src/App.tsx                         — lazy loading, reset-password route

DATABASE:
  Storage bucket: interview-recordings (private, 50MB max)
  RLS policies for storage
```

## Implementation Order
1. Database: storage bucket + RLS
2. `useSessionTimeout` + `useAntiCheat` hooks + `arabic-utils`
3. Password reset flow
4. Update interview pages (anti-cheat + media upload)
5. Update dashboards (Arabic numbers + optimistic UI)
6. Lazy loading in App.tsx
7. Fix `config.toml` for evaluate-interview

