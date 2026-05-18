-- Audit fixes: rate limiting infrastructure + schema hardening + RLS-supporting indexes.

-- ============================================================
-- 1) Rate limiting (per-user, per-scope, sliding window)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL, -- e.g., 'chat', 'evaluate', 'coach', 'cv_generate', 'transcribe', 'video_analyze'
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_scope_time
  ON public.rate_limits (user_id, scope, occurred_at DESC);

-- Auto-clean: drop rows older than 1 day to keep table small
CREATE OR REPLACE FUNCTION public.rate_limits_gc()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.rate_limits WHERE occurred_at < now() - interval '1 day';
$$;

-- check_and_record_rate_limit(user, scope, max_in_window, window_seconds)
-- Returns the number of calls in the window AFTER recording this one.
-- Caller decides to allow/reject. Atomic via SELECT...FOR SHARE pattern not needed
-- because we use COUNT — minor race acceptable for rate limiting.
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
  -- Count recent calls in window
  SELECT COUNT(*), MIN(occurred_at)
    INTO v_count, v_oldest_in_window
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND scope = p_scope
    AND occurred_at > now() - (p_window_seconds || ' seconds')::interval;

  IF v_count >= p_max THEN
    -- Reject; tell caller when window will free up
    RETURN QUERY SELECT
      false,
      v_count,
      GREATEST(1, p_window_seconds - EXTRACT(EPOCH FROM (now() - v_oldest_in_window))::INTEGER);
    RETURN;
  END IF;

  -- Record and allow
  INSERT INTO public.rate_limits (user_id, scope) VALUES (p_user_id, p_scope);
  RETURN QUERY SELECT true, v_count + 1, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated, anon;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies — only the SECURITY DEFINER function can write.

-- ============================================================
-- 2) interviews.mode NULL-safety (audit #9)
-- ============================================================
-- Backfill any NULLs (defensive — there shouldn't be any after the modes migration)
UPDATE public.interviews SET mode = 'assessment' WHERE mode IS NULL;
UPDATE public.interviews SET visibility = 'hr' WHERE visibility IS NULL;

-- Confirm NOT NULL is still enforced (no-op if already, but explicit)
ALTER TABLE public.interviews
  ALTER COLUMN mode SET NOT NULL,
  ALTER COLUMN visibility SET NOT NULL;

-- ============================================================
-- 3) Supporting indexes for RLS joins (audit #7)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_responses_interview_id
  ON public.responses(interview_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_interview_id
  ON public.evaluations(interview_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_active
  ON public.enrollments(student_id) WHERE status = 'active';

-- ============================================================
-- 4) User consent records (audit #6 + #7 — PDPL)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_type TEXT NOT NULL
    CHECK (consent_type IN (
      'audio_third_party_ai',   -- sending audio to Lovable/OpenAI/etc.
      'video_third_party_ai',   -- sending video frames to third-party
      'cv_third_party_ai',      -- sending CV content to third-party
      'recording_storage',      -- storing interview recordings
      'instructor_visibility'   -- sharing data with assigned instructor
    )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  version TEXT DEFAULT 'v1',   -- bump when consent text changes
  ip_address TEXT,             -- audit trail for PDPL
  UNIQUE(user_id, consent_type, version)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON public.user_consents(user_id);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own consents"
  ON public.user_consents
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users record own consents"
  ON public.user_consents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users revoke own consents"
  ON public.user_consents
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all consents"
  ON public.user_consents
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: has_active_consent(user, type)
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
