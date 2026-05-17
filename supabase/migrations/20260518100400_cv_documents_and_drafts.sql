-- P0.3 + P0.4: CV evaluation history (cv_documents) + CV builder state (cv_drafts).

-- ============================================================
-- cv_documents: each upload + evaluation snapshot
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now(),

  -- Analysis output
  extraction JSONB,            -- the legacy resume_skills shape (technical_skills, etc.)
  section_scores JSONB,        -- { contact, summary, experience, education, skills, achievements, language_quality } : 0..100
  weaknesses JSONB,            -- [{ section, issue, original_text, severity }]
  rewrites JSONB,              -- [{ original, improved, reason }]
  saudi_compliance JSONB,      -- { uses_hijri_dates, address_format_correct, military_service_mentioned, jadarat_link_present, recommendations[] }
  target_role TEXT,
  alignment_score NUMERIC(3, 2),

  analyzed_at TIMESTAMPTZ DEFAULT now(),
  model_used TEXT,
  tokens_used INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cv_documents_user
  ON public.cv_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_cv_documents_uploaded
  ON public.cv_documents(uploaded_at DESC);

ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CV documents"
  ON public.cv_documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Instructors view cohort student CVs"
  ON public.cv_documents
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'instructor'::app_role)
    AND user_id IN (
      SELECT e.student_id
      FROM public.enrollments e
      JOIN public.cohorts c ON c.id = e.cohort_id
      WHERE c.instructor_id = auth.uid()
        AND e.status = 'active'
    )
  );

CREATE POLICY "Admins view all CV documents"
  ON public.cv_documents
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- cv_drafts: CV Builder working state
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Section payloads (JSON for flexibility)
  personal_info JSONB DEFAULT '{}'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '{}'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,

  -- Display
  template TEXT DEFAULT 'modern' CHECK (template IN ('conservative', 'modern', 'executive')),
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'bilingual')),
  primary_color TEXT DEFAULT '#1e40af',

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_exported_at TIMESTAMPTZ,
  export_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cv_drafts_user
  ON public.cv_drafts(user_id);

ALTER TABLE public.cv_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CV drafts"
  ON public.cv_drafts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- updated_at trigger reuse
CREATE TRIGGER cv_drafts_updated_at
  BEFORE UPDATE ON public.cv_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
