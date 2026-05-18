-- Chunked recording: fixes the ~90s playback truncation by replacing the
-- single long WebM with 30-second chunks. Each chunk is small enough to
-- pass the bucket size limit, gets WebM duration metadata fixed on the
-- client, and admin playback stitches chunks together via MSE.

-- 1) Raise interview-recordings bucket size limit to 500 MB.
--    Previous 50 MB cap silently dropped final uploads for any interview
--    over ~5 minutes, forcing fallback to broken _partial.webm files.
UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500 MB
WHERE id = 'interview-recordings';

-- 2) New columns on interviews to track chunked recording state.
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS recording_chunks_path TEXT,
  ADD COLUMN IF NOT EXISTS recording_duration_ms BIGINT,
  ADD COLUMN IF NOT EXISTS recording_chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS recording_status TEXT
    CHECK (recording_status IN ('pending', 'recording', 'complete', 'incomplete', 'failed'));

COMMENT ON COLUMN public.interviews.recording_chunks_path IS
  'Folder path in interview-recordings bucket containing chunk_NNN.webm files and manifest.json. Replaces legacy single-file recording_url.';
COMMENT ON COLUMN public.interviews.recording_duration_ms IS
  'Total wall-clock duration of the recording in milliseconds (sum of all chunk durations).';
COMMENT ON COLUMN public.interviews.recording_chunk_count IS
  'Number of chunks listed in manifest.json.';
COMMENT ON COLUMN public.interviews.recording_status IS
  'pending: not started; recording: in progress; complete: clean end + manifest; incomplete: ended unexpectedly but chunks exist; failed: no chunks recovered.';

CREATE INDEX IF NOT EXISTS idx_interviews_recording_status
  ON public.interviews(recording_status);
