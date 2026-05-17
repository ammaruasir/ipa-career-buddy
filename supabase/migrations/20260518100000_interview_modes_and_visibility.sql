-- P0.1: فصل وضع التدريب عن وضع التقييم
-- Separates practice (formative) from assessment (summative) interviews.
-- HR only sees visibility='hr'; instructor sees cohort students; student sees own.

-- New ENUM types
CREATE TYPE public.interview_mode AS ENUM ('practice', 'assessment', 'mock_final');
CREATE TYPE public.interview_visibility AS ENUM ('private', 'instructor', 'hr');

-- Add columns to interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS mode public.interview_mode NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS visibility public.interview_visibility NOT NULL DEFAULT 'private';

-- Drop NOT NULL on job_position so practice sessions don't need a job
ALTER TABLE public.interviews
  ALTER COLUMN job_position DROP NOT NULL;

-- Backfill: all existing interviews are assessments visible to HR (legacy behavior preserved)
UPDATE public.interviews
SET mode = 'assessment', visibility = 'hr'
WHERE created_at < now();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interviews_mode ON public.interviews(mode);
CREATE INDEX IF NOT EXISTS idx_interviews_visibility ON public.interviews(visibility);
CREATE INDEX IF NOT EXISTS idx_interviews_user_mode ON public.interviews(user_id, mode);

-- Replace HR's blanket-view policy with visibility-aware one
DROP POLICY IF EXISTS "HR can view all interviews" ON public.interviews;

CREATE POLICY "HR sees assessment interviews"
  ON public.interviews
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'hr'::app_role)
    AND visibility = 'hr'
  );

-- Same treatment for responses: HR can only see responses of assessment interviews
DROP POLICY IF EXISTS "HR can view all responses" ON public.responses;

CREATE POLICY "HR sees assessment responses"
  ON public.responses
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'hr'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = responses.interview_id
        AND i.visibility = 'hr'
    )
  );

-- Same for evaluations
DROP POLICY IF EXISTS "HR can view all evaluations" ON public.evaluations;

CREATE POLICY "HR sees assessment evaluations"
  ON public.evaluations
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'hr'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = evaluations.interview_id
        AND i.visibility = 'hr'
    )
  );

COMMENT ON COLUMN public.interviews.mode IS
  'practice: self-serve training (private by default), assessment: formal (HR-visible), mock_final: pre-assessment rehearsal';
COMMENT ON COLUMN public.interviews.visibility IS
  'private: only the student; instructor: cohort instructor + student; hr: HR + admin + student';
