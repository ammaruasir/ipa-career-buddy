-- P0.4+: Conversational CV layer
-- 1) cv_conversations — chat threads grounded in a cv_document
-- 2) cv_interview_sessions — stateful from-scratch wizard

-- ============================================================
-- cv_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cv_document_id UUID REFERENCES public.cv_documents(id) ON DELETE SET NULL,
  cv_draft_id UUID REFERENCES public.cv_drafts(id) ON DELETE SET NULL,

  -- thread state
  messages JSONB DEFAULT '[]'::jsonb,
  -- shape: [{ role: "user"|"assistant", content: string, justifications?: [...], created_at: iso }]

  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'bilingual')),

  -- meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  total_messages INTEGER DEFAULT 0,

  -- cost tracking
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
  ON public.cv_conversations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Instructors view cohort student conversations"
  ON public.cv_conversations
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'instructor'::app_role)
    AND user_id IN (
      SELECT e.student_id FROM public.enrollments e
      JOIN public.cohorts c ON c.id = e.cohort_id
      WHERE c.instructor_id = auth.uid() AND e.status = 'active'
    )
  );

CREATE TRIGGER cv_conversations_updated_at
  BEFORE UPDATE ON public.cv_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.cv_conversations.messages IS
$$Chat history. Each message:
{
  "role": "user" | "assistant",
  "content": "string",
  "justifications": [  // assistant-only, optional
    {
      "observation": "your bullets don't have numbers",
      "rule": "Quantify achievements",
      "why_it_matters": "Recruiters skim — numbers anchor attention",
      "example_better": "Increased sales by 30% vs. Increased sales"
    }
  ],
  "created_at": "ISO timestamp"
}$$;

-- ============================================================
-- cv_interview_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cv_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- progression
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 15,

  -- accumulated answers (the data model for the draft being built)
  answers JSONB DEFAULT '{}'::jsonb,
  -- shape: {
  --   "step_id": { answer: string, suggestions_used: [int], ts: iso },
  --   ...
  -- }

  -- target output
  target_role TEXT,
  target_industry TEXT,
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'bilingual')),
  experience_level TEXT
    CHECK (experience_level IN ('fresh_graduate', 'mid_career', 'senior', 'executive')),

  -- generated draft link
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
  ON public.cv_interview_sessions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER cv_interview_sessions_updated_at
  BEFORE UPDATE ON public.cv_interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
