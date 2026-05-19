-- Raise interview-recordings bucket size limit to 500 MB
UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id = 'interview-recordings';

-- Chunked recording columns on interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS recording_chunks_path TEXT,
  ADD COLUMN IF NOT EXISTS recording_duration_ms BIGINT,
  ADD COLUMN IF NOT EXISTS recording_chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS recording_status TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interviews_recording_status_check'
  ) THEN
    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_recording_status_check
      CHECK (recording_status IS NULL OR recording_status IN ('pending', 'recording', 'complete', 'incomplete', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interviews_recording_status
  ON public.interviews(recording_status);

-- Proctor flagging + end reason
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_reason TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interviews_end_reason_check'
  ) THEN
    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_end_reason_check
      CHECK (end_reason IS NULL OR end_reason IN ('completed', 'cancelled', 'terminated_by_proctor', 'disconnected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interviews_flagged
  ON public.interviews(flagged_at) WHERE flagged_at IS NOT NULL;

-- Add tables to supabase_realtime publication (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cheat_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cheat_events;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'interviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;
  END IF;
END $$;