## Add Quick-Login Buttons on Login Page

### Problem
Testers/demo users want a one-click way to log in with existing accounts instead of typing email + password every time.

### Solution
Add a "دخول سريع" section under the existing login form on `src/pages/Login.tsx` showing one button per pre-configured existing account. Clicking a button auto-fills the credentials and calls `signIn` immediately, then redirects to `/dashboard`.

### File: `src/pages/Login.tsx`

**Accounts to include** (visible in all environments, per your choice):

| Email | Role | Password |
|---|---|---|
| `admin@test.com` | مسؤول (Admin) | `00000000` |
| `ammar@admin.com` | مرشح (Candidate) | `00000000` |
| `student1@test.com` | مرشح (Candidate) | `00000000` |

> Other emails in the DB (`marwan@gmail.com`, `ammar@wakeb.com`, `wakeb@wakeb.tech`) are excluded since their passwords aren't on file. If you want them included, share the passwords or pick a uniform default.

### Implementation

1. Add a `QUICK_ACCOUNTS` array constant at top of the file with `{ label, email, password, role }` entries.
2. Add a `handleQuickLogin(email, password)` function that:
   - Sets `loading = true`
   - Calls `signIn(email, password)`
   - On success → `navigate(redirect || "/dashboard")`
   - On error → `toast.error("فشل تسجيل الدخول السريع")`
3. Render a section **below the form**, only when `!isSignup && !isForgotPassword`:
   ```text
   ─────────  دخول سريع للتجربة  ─────────
   [ 👤 مسؤول — admin@test.com ]
   [ 🎓 مرشح — student1@test.com ]
   [ 🎓 مرشح — ammar@admin.com ]
   ```
   Each button uses `variant="outline"`, full width, rounded, with role icon (`Shield` / `GraduationCap`) and shows email as secondary text.
4. Buttons are disabled while `loading`.

### Security note
These buttons expose test credentials to anyone visiting `/login` in production. You confirmed you want them visible in all environments — acknowledged. If you change your mind later, we can wrap the section in `import.meta.env.DEV && (...)`.