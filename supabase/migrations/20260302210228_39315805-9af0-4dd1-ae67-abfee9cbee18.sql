
-- Create cheat_events table
CREATE TABLE public.cheat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  details text,
  frame_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cheat_events ENABLE ROW LEVEL SECURITY;

-- HR can view all cheat events
CREATE POLICY "HR can view cheat events"
ON public.cheat_events FOR SELECT
USING (public.has_role(auth.uid(), 'hr'::app_role));

-- Admin can manage all cheat events
CREATE POLICY "Admin can manage cheat events"
ON public.cheat_events FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Candidates can insert cheat events for own interviews
CREATE POLICY "Candidates can insert own cheat events"
ON public.cheat_events FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.interviews
  WHERE interviews.id = cheat_events.interview_id
  AND interviews.user_id = auth.uid()
));

-- Candidates can view own cheat events
CREATE POLICY "Candidates can view own cheat events"
ON public.cheat_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.interviews
  WHERE interviews.id = cheat_events.interview_id
  AND interviews.user_id = auth.uid()
));

-- Add storage policy for interview-recordings bucket to allow candidates to upload
CREATE POLICY "Candidates can upload own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'interview-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow HR/Admin to read recordings
CREATE POLICY "HR can view recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'interview-recordings'
  AND (public.has_role(auth.uid(), 'hr'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- Allow candidates to read own recordings
CREATE POLICY "Candidates can view own recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'interview-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
