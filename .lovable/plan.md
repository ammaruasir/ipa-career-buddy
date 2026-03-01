
# Technical Integrations & Security Features

## Completed ✅

### 1. Session Timeout (30 min inactivity)
- `useSessionTimeout` hook tracks mouse/keyboard/touch activity
- Warning toast at 25 min, auto-logout at 30 min
- Integrated into `AuthProvider`

### 2. Anti-Cheating Features
- `useAntiCheat` hook with tab switch detection (`visibilitychange` + `blur`)
- Copy-paste detection (blocked in text interview)
- Warning banner displayed during interviews
- Tab switch count tracked and shown

### 3. Media Storage
- `interview-recordings` storage bucket (private, 50MB limit)
- RLS: students upload to own folder, admin/HR can read all
- Voice and Video interviews upload recordings after stopping

### 4. Arabic Number Formatting
- `toArabicNumerals()`, `formatArabicNumber()`, `formatArabicPercent()`
- Applied in Student and Admin dashboards

### 5. Lazy Loading
- Interview pages and ResetPassword loaded via `React.lazy()`
- Suspense fallback with loading spinner

### 6. Optimistic UI for HR Notes
- Notes appear immediately in CandidateDetail
- Rolled back on error

### 7. Password Reset Flow
- "نسيت كلمة المرور؟" link in Login
- `/reset-password` page with recovery token handling

### 8. evaluate-interview config
- Added to `supabase/config.toml`

## Out of Scope
- Twilio SMS OTP, Google Cloud Vision, Calendar integration
- Hijri date picker, Arabic speech-to-text, Video compression
- Auto-delete after 1 year, Multiple face detection
- tailwindcss-rtl plugin (RTL already handled)
