-- Allow anonymous users to view active job vacancies
CREATE POLICY "Anyone can view active vacancies"
ON public.job_vacancies
FOR SELECT
TO anon
USING (is_active = true);