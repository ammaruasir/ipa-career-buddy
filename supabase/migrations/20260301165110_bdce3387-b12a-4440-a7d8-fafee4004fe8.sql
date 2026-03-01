
-- Create job_vacancies table
CREATE TABLE public.job_vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  requirements JSONB DEFAULT '[]'::jsonb,
  department TEXT,
  location TEXT,
  employment_type TEXT DEFAULT 'full_time',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_vacancies ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage all vacancies"
  ON public.job_vacancies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- HR can read all
CREATE POLICY "HR can view all vacancies"
  ON public.job_vacancies FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr'::app_role));

-- Candidates can read active only
CREATE POLICY "Candidates can view active vacancies"
  ON public.job_vacancies FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create job_applications table
CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID NOT NULL REFERENCES public.job_vacancies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'applied',
  interview_id UUID REFERENCES public.interviews(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Candidates can view/create own applications
CREATE POLICY "Users can view own applications"
  ON public.job_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own applications"
  ON public.job_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON public.job_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins can manage all applications"
  ON public.job_applications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- HR can view all
CREATE POLICY "HR can view all applications"
  ON public.job_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr'::app_role));

-- Timestamp trigger for job_vacancies
CREATE TRIGGER update_job_vacancies_updated_at
  BEFORE UPDATE ON public.job_vacancies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
