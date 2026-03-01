
-- Create interview-recordings storage bucket (private, 50MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('interview-recordings', 'interview-recordings', false, 52428800);

-- Students can upload to their own folder
CREATE POLICY "Students upload own recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'interview-recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Students can view their own recordings
CREATE POLICY "Students view own recordings"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'interview-recordings'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
  )
);

-- Admin/HR can view all recordings
CREATE POLICY "Admin HR view all recordings"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'interview-recordings'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
);
