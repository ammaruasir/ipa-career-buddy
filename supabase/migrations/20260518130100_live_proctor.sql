-- Live proctor: lets admin/hr/instructor watch in-progress interviews via the
-- chunked recording pipeline. Each chunk arrives ~30s after capture; the admin
-- viewer subscribes to a Realtime channel and appends new chunks to an MSE
-- buffer. This migration adds the audit table, intervention metadata, and
-- Realtime publication entries needed for the live view.

-- 1) Proctor sessions: audit trail of who watched what and when.
CREATE TABLE IF NOT EXISTS public.proctor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  proctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'instructor')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  events JSONB DEFAULT '[]'::jsonb,
    -- e.g. [{ "type": "message", "text": "remove your phone", "at": "..." },
    --       { "type": "flag", "reason": "phone visible", "at": "..." },
    --       { "type": "force_end", "reason": "...", "at": "..." }]
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_proctor_sessions_interview ON public.proctor_sessions(interview_id);
CREATE INDEX IF NOT EXISTS idx_proctor_sessions_proctor   ON public.proctor_sessions(proctor_id);

ALTER TABLE public.proctor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proctors see own sessions"
  ON public.proctor_sessions FOR SELECT
  USING (proctor_id = auth.uid());

CREATE POLICY "Admins see all proctor sessions"
  ON public.proctor_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Proctors record own sessions"
  ON public.proctor_sessions FOR INSERT
  WITH CHECK (
    proctor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'hr'::app_role)
      OR public.has_role(auth.uid(), 'instructor'::app_role)
    )
  );

CREATE POLICY "Proctors update own sessions"
  ON public.proctor_sessions FOR UPDATE
  USING (proctor_id = auth.uid())
  WITH CHECK (proctor_id = auth.uid());

-- 2) Interview flagging + end-reason metadata.
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_reason TEXT
    CHECK (end_reason IN ('completed', 'cancelled', 'terminated_by_proctor', 'disconnected'));

CREATE INDEX IF NOT EXISTS idx_interviews_flagged ON public.interviews(flagged_at) WHERE flagged_at IS NOT NULL;

-- 3) Enable Realtime on responses and cheat_events so the live viewer can
--    show transcript and proctoring alerts as they happen. Existing RLS on
--    these tables already restricts admin/hr/instructor visibility.
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cheat_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;
