CREATE OR REPLACE FUNCTION public.stamp_is_demo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_demo IS NULL OR NEW.is_demo = false THEN
    NEW.is_demo := public.is_demo_account(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

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