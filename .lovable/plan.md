## Problem

During the demo (Act 2), the narration about password reset navigates to `/reset-password`. That page is only valid when arrived at from a real recovery email link (it checks for `type=recovery` in the URL hash). Without it, it correctly shows "رابط غير صالح. يرجى طلب رابط إعادة تعيين جديد" — which breaks the demo storytelling.

The right page to showcase is the **"forgot password" request form** (email input → "send reset link"), which currently only renders when the user clicks the link on `/login` (toggled by local state `isForgotPassword`).

## Plan

1. **`src/pages/Login.tsx`** — Support a URL query param to open the forgot-password view directly:
   - Read `searchParams.get("forgot")` on mount and initialize `isForgotPassword` to `true` when it's set (e.g. `?forgot=1`).
   - No other behavior change.

2. **`src/demo/tour-script.ts`** — Update the `act2-reset-password` step:
   - Change `route` from `/reset-password` to `/login?forgot=1`.
   - Keep the same narration and spotlight selector (`input[type='email']` still matches the email field on the forgot form).

## Out of scope

- No change to `ResetPassword.tsx` (it stays as-is for real recovery flows).
- No backend, voice, or other tour steps changed.