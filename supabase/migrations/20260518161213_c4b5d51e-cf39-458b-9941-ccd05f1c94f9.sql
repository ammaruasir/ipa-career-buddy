CREATE OR REPLACE FUNCTION public.is_demo_account(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = uid
      AND email LIKE 'demo-%@ipa-training.sa'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_account(uuid) TO authenticated, anon;

ALTER TABLE public.profiles   ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='responses') THEN
    EXECUTE 'ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='evaluations') THEN
    EXECUTE 'ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cv_drafts') THEN
    EXECUTE 'ALTER TABLE public.cv_drafts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cohorts') THEN
    EXECUTE 'ALTER TABLE public.cohorts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='enrollments') THEN
    EXECUTE 'ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_vacancies') THEN
    EXECUTE 'ALTER TABLE public.job_vacancies ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='question_templates') THEN
    EXECUTE 'ALTER TABLE public.question_templates ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_is_demo   ON public.profiles(is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_interviews_is_demo ON public.interviews(is_demo) WHERE is_demo;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles', 'interviews', 'responses', 'evaluations',
    'cv_drafts', 'cohorts', 'enrollments', 'job_vacancies', 'question_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='is_demo') THEN
      EXECUTE format('DROP POLICY IF EXISTS demo_isolation_%I ON public.%I', t, t);
      EXECUTE format($f$
        CREATE POLICY demo_isolation_%I ON public.%I
          AS RESTRICTIVE
          FOR ALL
          TO authenticated, anon
          USING (
            CASE
              WHEN public.is_demo_account(auth.uid()) THEN is_demo = true
              ELSE is_demo = false
            END
          )
          WITH CHECK (
            CASE
              WHEN public.is_demo_account(auth.uid()) THEN is_demo = true
              ELSE is_demo = false
            END
          )
      $f$, t, t);
    END IF;
  END LOOP;
END
$$;

COMMENT ON FUNCTION public.is_demo_account(uuid) IS
  'Returns true if the user is one of the demo accounts (email pattern demo-*@ipa-training.sa). Used by demo_isolation_* RLS policies.';