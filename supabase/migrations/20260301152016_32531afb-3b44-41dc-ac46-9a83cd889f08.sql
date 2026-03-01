
-- Add new columns to evaluations table
ALTER TABLE public.evaluations 
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS personality_type text,
  ADD COLUMN IF NOT EXISTS filler_words_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS speech_pace numeric,
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS detailed_scores jsonb DEFAULT '{}'::jsonb;

-- Allow service role to insert evaluations (edge function uses service role key)
-- The existing RLS policies use RESTRICTIVE mode. We need a PERMISSIVE policy 
-- so that service_role can bypass, but service_role already bypasses RLS.
-- However, we need authenticated users to be able to read their evaluations.
-- The existing policies are RESTRICTIVE which means ALL must pass.
-- Let's add a permissive SELECT policy so students can actually read evaluations.
CREATE POLICY "Students can view own evaluations permissive"
  ON public.evaluations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interviews
      WHERE interviews.id = evaluations.interview_id
      AND interviews.user_id = auth.uid()
    )
  );
