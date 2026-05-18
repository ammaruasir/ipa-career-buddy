
-- 1. cv_drafts: add columns
ALTER TABLE public.cv_drafts
  ADD COLUMN IF NOT EXISTS custom_sections jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS section_order jsonb;

-- 2. cohorts
CREATE TABLE IF NOT EXISTS public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  track text,
  status text NOT NULL DEFAULT 'planned',
  start_date date NOT NULL,
  end_date date NOT NULL,
  capacity integer NOT NULL DEFAULT 0,
  instructor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and instructors manage cohorts"
  ON public.cohorts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Authenticated can view cohorts"
  ON public.cohorts FOR SELECT
  TO authenticated
  USING (true);

-- 3. enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, student_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and instructors manage enrollments"
  ON public.enrollments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Students view own enrollment"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- 4. assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz NOT NULL,
  target_track text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and instructors manage assignments"
  ON public.assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Authenticated view assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (true);

-- 5. proctor_sessions
CREATE TABLE IF NOT EXISTS public.proctor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  proctor_id uuid NOT NULL,
  role text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);
ALTER TABLE public.proctor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins HR instructors manage proctor sessions"
  ON public.proctor_sessions FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'instructor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'instructor')
  );
