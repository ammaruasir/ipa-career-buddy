## Why the interview won't start

The logged-in user is **`demo-candidate@ipa-training.sa`** (JWT shows `is_demo:true`). When the user clicks "بدء المقابلة المباشرة", `useLiveInterview.startCall()` does:

```ts
supabase.from("interviews").insert({
  user_id: user.id, type, job_position, status, mode, visibility,
})
```

No `is_demo` field. Column defaults to `false`. But the Demo Mode migration added this **RESTRICTIVE** RLS policy on 9 tables:

```sql
CASE WHEN is_demo_account(auth.uid()) THEN is_demo = true
     ELSE is_demo = false END
```

So the WITH CHECK fails → insert is blocked → the catch path fires `toast.error("حدث خطأ في بدء المقابلة")`. Exact same bug exists for `responses`, `evaluations`, `cv_drafts`, `cohorts`, `enrollments`, `job_vacancies`, `question_templates`, `profiles` whenever a demo user writes — the demo accounts effectively can't use any of the seeded flows.

### Who else is affected

Only the 5 seeded demo accounts (`demo-candidate@`, `demo-admin@`, `demo-hr@`, `demo-instructor@`, `demo-applicant@ipa-training.sa`). Regular users (`admin@test.com`, `ammar@admin.com`, `student1@test.com`) are unaffected — `is_demo_account()` returns false for them, the ELSE branch (`is_demo = false`) matches the column default, and writes succeed.

Verified by querying the live policies (`pg_policies`) and confirming all 9 tables share the same RESTRICTIVE expression.

## Fix — auto-stamp `is_demo` via DB trigger (no client changes)

The cleanest fix is at the database layer: a `BEFORE INSERT` trigger on each of the 9 isolated tables that defaults `NEW.is_demo` to `is_demo_account(auth.uid())` when the client doesn't supply it. This guarantees correctness across **every** insert path (current and future) without scattering `is_demo: true` literals across the React code.

### Migration

```sql
-- 1. Generic trigger fn
CREATE OR REPLACE FUNCTION public.stamp_is_demo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only stamp when the client didn't explicitly set it. Demo accounts
  -- always get is_demo=true; regular accounts always get is_demo=false.
  IF NEW.is_demo IS NULL OR NEW.is_demo = false THEN
    NEW.is_demo := public.is_demo_account(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach to all 9 isolated tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','interviews','responses','evaluations',
    'cv_drafts','cohorts','enrollments','job_vacancies','question_templates'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS stamp_is_demo_trg ON public.%I;
       CREATE TRIGGER stamp_is_demo_trg
         BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.stamp_is_demo();',
      t, t
    );
  END LOOP;
END $$;
```

Notes:
- Service-role inserts (edge functions, seeders) bypass RLS but also won't hit `auth.uid()`. For those, `auth.uid()` is NULL → `is_demo_account(NULL)` → false → row stays `is_demo=false`. Edge functions that need to seed demo data should keep setting `is_demo: true` explicitly (the seeder already does).
- Trigger only flips `is_demo` when it's NULL/false, so a row explicitly inserted with `is_demo=true` (e.g. by the seeder) is preserved.

### Verify

1. As `demo-candidate@ipa-training.sa`, navigate to `/interview/video`, pick a job, click "بدء المقابلة المباشرة" — the interview row should now insert and the live call should start.
2. As `student1@test.com`, run the same flow — no regression (still `is_demo=false`).
3. `SELECT id, user_id, is_demo FROM interviews ORDER BY created_at DESC LIMIT 5;` should show `is_demo=true` for the demo run and `false` for the regular run.

## Out of scope

- No frontend changes needed.
- The non-isolated tables (`notifications`, `user_roles`, `rate_limits`, `system_settings`, etc.) are not touched.
