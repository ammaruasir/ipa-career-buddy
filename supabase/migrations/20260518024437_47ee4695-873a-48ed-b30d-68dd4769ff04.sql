-- ============================================================
-- 1) Rate limits infrastructure (used by edge function guards)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_scope_time
  ON public.rate_limits (user_id, scope, occurred_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_scope TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_oldest_in_window TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), MIN(occurred_at)
    INTO v_count, v_oldest_in_window
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND scope = p_scope
    AND occurred_at > now() - (p_window_seconds || ' seconds')::interval;

  IF v_count >= p_max THEN
    RETURN QUERY SELECT
      false,
      v_count,
      GREATEST(1, p_window_seconds - EXTRACT(EPOCH FROM (now() - v_oldest_in_window))::INTEGER);
    RETURN;
  END IF;

  INSERT INTO public.rate_limits (user_id, scope) VALUES (p_user_id, p_scope);
  RETURN QUERY SELECT true, v_count + 1, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated, anon;

-- ============================================================
-- 2) PDPL user consents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_type TEXT NOT NULL
    CHECK (consent_type IN (
      'audio_third_party_ai',
      'video_third_party_ai',
      'cv_third_party_ai',
      'recording_storage',
      'instructor_visibility'
    )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  version TEXT DEFAULT 'v1',
  ip_address TEXT,
  UNIQUE(user_id, consent_type, version)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON public.user_consents(user_id);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own consents"
  ON public.user_consents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users record own consents"
  ON public.user_consents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users revoke own consents"
  ON public.user_consents FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all consents"
  ON public.user_consents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.has_active_consent(
  p_user_id UUID,
  p_consent_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_consents
    WHERE user_id = p_user_id
      AND consent_type = p_consent_type
      AND granted = true
      AND revoked_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_consent(UUID, TEXT) TO authenticated, anon;

-- ============================================================
-- 3) cv_documents — analyzed CV snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  extraction JSONB,
  section_scores JSONB,
  weaknesses JSONB,
  rewrites JSONB,
  saudi_compliance JSONB,
  target_role TEXT,
  alignment_score NUMERIC(5, 2),
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  model_used TEXT,
  tokens_used INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cv_documents_user ON public.cv_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_documents_uploaded ON public.cv_documents(uploaded_at DESC);

ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CV documents"
  ON public.cv_documents FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all CV documents"
  ON public.cv_documents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4) cv_drafts — CV builder working state
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  personal_info JSONB DEFAULT '{}'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '{}'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  template TEXT DEFAULT 'modern' CHECK (template IN ('conservative', 'modern', 'executive')),
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'bilingual')),
  primary_color TEXT DEFAULT '#1e40af',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_exported_at TIMESTAMPTZ,
  export_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cv_drafts_user ON public.cv_drafts(user_id);

ALTER TABLE public.cv_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CV drafts"
  ON public.cv_drafts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER cv_drafts_updated_at
  BEFORE UPDATE ON public.cv_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) cv_interview_sessions — stateful from-scratch wizard
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 15,
  answers JSONB DEFAULT '{}'::jsonb,
  target_role TEXT,
  target_industry TEXT,
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'bilingual')),
  experience_level TEXT
    CHECK (experience_level IN ('fresh_graduate', 'mid_career', 'senior', 'executive')),
  generated_draft_id UUID REFERENCES public.cv_drafts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cv_interview_sessions_user
  ON public.cv_interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_interview_sessions_status
  ON public.cv_interview_sessions(status);

ALTER TABLE public.cv_interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CV interview sessions"
  ON public.cv_interview_sessions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER cv_interview_sessions_updated_at
  BEFORE UPDATE ON public.cv_interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6) cv_conversations — chat threads about a CV
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cv_document_id UUID REFERENCES public.cv_documents(id) ON DELETE SET NULL,
  cv_draft_id UUID REFERENCES public.cv_drafts(id) ON DELETE SET NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'bilingual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  total_messages INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cv_conversations_user
  ON public.cv_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_conversations_cv_doc
  ON public.cv_conversations(cv_document_id);
CREATE INDEX IF NOT EXISTS idx_cv_conversations_last_message
  ON public.cv_conversations(last_message_at DESC);

ALTER TABLE public.cv_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CV conversations"
  ON public.cv_conversations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER cv_conversations_updated_at
  BEFORE UPDATE ON public.cv_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();