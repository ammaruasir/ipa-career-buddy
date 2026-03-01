
CREATE TABLE public.hr_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  note_text text,
  action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR can manage notes" ON public.hr_notes
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'hr'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'hr'::app_role)
  );
