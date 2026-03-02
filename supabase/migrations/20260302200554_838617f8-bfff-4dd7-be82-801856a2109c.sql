
-- Add new evaluation columns
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS problem_solving numeric,
  ADD COLUMN IF NOT EXISTS leadership numeric,
  ADD COLUMN IF NOT EXISTS culture_alignment numeric,
  ADD COLUMN IF NOT EXISTS red_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_level text,
  ADD COLUMN IF NOT EXISTS final_recommendation text,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending_review';

-- RLS: only HR/admin can update review_status (via existing ALL policy for admins)
-- Add HR update policy for evaluations
CREATE POLICY "HR can update evaluations"
ON public.evaluations
FOR UPDATE
USING (has_role(auth.uid(), 'hr'::app_role));
