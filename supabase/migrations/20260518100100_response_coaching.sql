-- P0.2: تغذية راجعة لكل إجابة + STAR
-- Adds coaching JSONB to responses so per-answer feedback can be stored.
-- Structure documented inline; coach-response edge function populates it.

ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS coaching JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coached_at TIMESTAMPTZ DEFAULT NULL;

-- Index for finding un-coached responses quickly
CREATE INDEX IF NOT EXISTS idx_responses_uncoached
  ON public.responses(interview_id)
  WHERE coaching IS NULL;

COMMENT ON COLUMN public.responses.coaching IS
$$Per-answer coaching JSON. Expected shape:
{
  "star": {
    "situation": { "covered": true, "evidence": "...", "score": 0.8 },
    "task":      { "covered": true, "evidence": "...", "score": 0.9 },
    "action":    { "covered": false, "evidence": null, "score": 0.0 },
    "result":    { "covered": true, "evidence": "...", "score": 0.7 },
    "overall_coverage": 0.6
  },
  "filler_words": [
    { "word": "يعني", "count": 3 }
  ],
  "rewrite": "نسخة محسّنة بالعربية الفصحى...",
  "exemplar": "إجابة نموذجية قوية للسؤال...",
  "model": "gpt-4.1-mini",
  "tokens_used": 1250
}$$;
