-- Add interview mode + visibility to separate training from formal assessment
DO $$ BEGIN
  CREATE TYPE public.interview_mode AS ENUM ('practice', 'assessment', 'mock_final');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_visibility AS ENUM ('private', 'instructor', 'hr');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS mode public.interview_mode NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS visibility public.interview_visibility NOT NULL DEFAULT 'private';

ALTER TABLE public.interviews ALTER COLUMN job_position DROP NOT NULL;

UPDATE public.interviews
  SET mode = 'assessment', visibility = 'hr'
  WHERE created_at < now() - interval '1 minute'
    AND mode = 'practice' AND visibility = 'private';

CREATE INDEX IF NOT EXISTS idx_interviews_mode ON public.interviews(mode);
CREATE INDEX IF NOT EXISTS idx_interviews_visibility ON public.interviews(visibility);
CREATE INDEX IF NOT EXISTS idx_interviews_user_mode ON public.interviews(user_id, mode);

-- Visibility-aware HR policies
DROP POLICY IF EXISTS "HR can view all interviews" ON public.interviews;
DROP POLICY IF EXISTS "HR sees assessment interviews" ON public.interviews;
CREATE POLICY "HR sees assessment interviews"
  ON public.interviews FOR SELECT
  USING (public.has_role(auth.uid(), 'hr'::app_role) AND visibility = 'hr');

DROP POLICY IF EXISTS "HR can view all responses" ON public.responses;
DROP POLICY IF EXISTS "HR sees assessment responses" ON public.responses;
CREATE POLICY "HR sees assessment responses"
  ON public.responses FOR SELECT
  USING (
    public.has_role(auth.uid(), 'hr'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = responses.interview_id AND i.visibility = 'hr'
    )
  );

DROP POLICY IF EXISTS "HR can view all evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "HR sees assessment evaluations" ON public.evaluations;
CREATE POLICY "HR sees assessment evaluations"
  ON public.evaluations FOR SELECT
  USING (
    public.has_role(auth.uid(), 'hr'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = evaluations.interview_id AND i.visibility = 'hr'
    )
  );