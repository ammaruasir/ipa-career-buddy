-- P0.6: طبقة المدرّس والدفعات
-- Adds instructor role, cohorts, enrollments, assignments, instructor_feedback.

-- 1) Add instructor to the role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instructor';

-- 2) Cohorts
CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  track TEXT REFERENCES public.tracks(code),
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  capacity INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_instructor ON public.cohorts(instructor_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_status     ON public.cohorts(status);
CREATE INDEX IF NOT EXISTS idx_cohorts_track      ON public.cohorts(track);

-- 3) Enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'withdrawn', 'completed')),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cohort_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_cohort  ON public.enrollments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);

-- 4) Assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('interview', 'cv', 'quiz', 'reflection')),
  title TEXT NOT NULL,
  description TEXT,
  target_track TEXT REFERENCES public.tracks(code),
  due_at TIMESTAMPTZ NOT NULL,
  requirements JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_cohort ON public.assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due    ON public.assignments(due_at);

-- 5) Instructor feedback (timestamped per video moment)
CREATE TABLE IF NOT EXISTS public.instructor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
  response_id UUID REFERENCES public.responses(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  annotation_text TEXT NOT NULL,
  timestamp_ms INTEGER,
  feedback_type TEXT DEFAULT 'general'
    CHECK (feedback_type IN ('general', 'improvement', 'praise', 'concern')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (interview_id IS NOT NULL OR response_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_instructor_feedback_interview ON public.instructor_feedback(interview_id);
CREATE INDEX IF NOT EXISTS idx_instructor_feedback_response  ON public.instructor_feedback(response_id);

-- 6) RLS
ALTER TABLE public.cohorts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_feedback ENABLE ROW LEVEL SECURITY;

-- Cohorts
CREATE POLICY "Instructors see own cohorts"
  ON public.cohorts FOR SELECT
  USING (instructor_id = auth.uid());

CREATE POLICY "Students see cohorts they are enrolled in"
  ON public.cohorts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.cohort_id = cohorts.id
        AND e.student_id = auth.uid()
        AND e.status = 'active'
    )
  );

CREATE POLICY "Instructors manage own cohorts"
  ON public.cohorts FOR ALL
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Admins manage all cohorts"
  ON public.cohorts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Enrollments
CREATE POLICY "Students see own enrollments"
  ON public.enrollments FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Instructors see enrollments in their cohorts"
  ON public.enrollments FOR SELECT
  USING (
    cohort_id IN (
      SELECT id FROM public.cohorts WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors manage enrollments in their cohorts"
  ON public.enrollments FOR ALL
  USING (
    cohort_id IN (
      SELECT id FROM public.cohorts WHERE instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    cohort_id IN (
      SELECT id FROM public.cohorts WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all enrollments"
  ON public.enrollments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Assignments
CREATE POLICY "Students see assignments in their cohorts"
  ON public.assignments FOR SELECT
  USING (
    cohort_id IN (
      SELECT cohort_id FROM public.enrollments WHERE student_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Instructors manage assignments in their cohorts"
  ON public.assignments FOR ALL
  USING (
    cohort_id IN (
      SELECT id FROM public.cohorts WHERE instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    cohort_id IN (
      SELECT id FROM public.cohorts WHERE instructor_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all assignments"
  ON public.assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Instructor feedback
CREATE POLICY "Instructors create feedback on cohort students"
  ON public.instructor_feedback FOR INSERT
  WITH CHECK (
    instructor_id = auth.uid()
    AND interview_id IN (
      SELECT i.id FROM public.interviews i
      JOIN public.enrollments e ON e.student_id = i.user_id
      JOIN public.cohorts c     ON c.id = e.cohort_id
      WHERE c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors see own feedback"
  ON public.instructor_feedback FOR SELECT
  USING (instructor_id = auth.uid());

CREATE POLICY "Students see feedback on their interviews"
  ON public.instructor_feedback FOR SELECT
  USING (
    interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid())
  );

CREATE POLICY "Instructors update own feedback"
  ON public.instructor_feedback FOR UPDATE
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors delete own feedback"
  ON public.instructor_feedback FOR DELETE
  USING (instructor_id = auth.uid());

-- Allow instructors to see their cohort students' interviews/responses/evaluations
-- (Independent from HR's policy; visibility must be 'instructor' or 'hr')
CREATE POLICY "Instructors see cohort student interviews"
  ON public.interviews FOR SELECT
  USING (
    public.has_role(auth.uid(), 'instructor'::app_role)
    AND user_id IN (
      SELECT e.student_id
      FROM public.enrollments e
      JOIN public.cohorts c ON c.id = e.cohort_id
      WHERE c.instructor_id = auth.uid()
        AND e.status = 'active'
    )
    AND visibility IN ('instructor', 'hr')
  );

CREATE POLICY "Instructors see cohort student responses"
  ON public.responses FOR SELECT
  USING (
    public.has_role(auth.uid(), 'instructor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.enrollments e ON e.student_id = i.user_id
      JOIN public.cohorts c     ON c.id = e.cohort_id
      WHERE i.id = responses.interview_id
        AND c.instructor_id = auth.uid()
        AND e.status = 'active'
        AND i.visibility IN ('instructor', 'hr')
    )
  );

CREATE POLICY "Instructors see cohort student evaluations"
  ON public.evaluations FOR SELECT
  USING (
    public.has_role(auth.uid(), 'instructor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.enrollments e ON e.student_id = i.user_id
      JOIN public.cohorts c     ON c.id = e.cohort_id
      WHERE i.id = evaluations.interview_id
        AND c.instructor_id = auth.uid()
        AND e.status = 'active'
        AND i.visibility IN ('instructor', 'hr')
    )
  );
