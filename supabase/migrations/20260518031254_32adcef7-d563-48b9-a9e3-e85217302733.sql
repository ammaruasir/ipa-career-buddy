CREATE TABLE public.cv_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cv_document_id UUID,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  accepted_rewrites JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cv_revisions_user ON public.cv_revisions(user_id);
CREATE INDEX idx_cv_revisions_doc ON public.cv_revisions(cv_document_id);

ALTER TABLE public.cv_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CV revisions"
ON public.cv_revisions
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all CV revisions"
ON public.cv_revisions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cv_revisions_updated_at
BEFORE UPDATE ON public.cv_revisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();