-- =====================================================================
-- IPA Career Buddy — Training Platform Migration
-- Implements: P0.1 (practice/assessment mode), P0.2 (per-response coaching),
--             P0.3 (CV documents), P0.4 (CV drafts), P0.5 (question bank
--             tracks), P0.6 (instructor + cohorts), P1.1 (skill progress
--             helpers).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTEND app_role ENUM with 'instructor'
-- ---------------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instructor';

-- ---------------------------------------------------------------------
-- 2. interviews.mode + visibility (P0.1)
--    mode      : practice | assessment | mock_final
--    visibility: private | instructor | hr
-- Defaults preserve existing behaviour: rows existing before this
-- migration become 'assessment' / 'hr' (so HR dashboards keep working).
-- New application code explicitly sets mode='practice'/'private' for
-- training sessions.
-- ---------------------------------------------------------------------
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'assessment'
    CHECK (mode IN ('practice','assessment','mock_final')),
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'hr'
    CHECK (visibility IN ('private','instructor','hr')),
  ADD COLUMN IF NOT EXISTS track TEXT,
  ADD COLUMN IF NOT EXISTS persona TEXT DEFAULT 'friendly_hr';

CREATE INDEX IF NOT EXISTS interviews_mode_idx ON public.interviews(mode);
CREATE INDEX IF NOT EXISTS interviews_visibility_idx ON public.interviews(visibility);

-- ---------------------------------------------------------------------
-- 3. responses.coaching JSONB (P0.2)
-- Shape: {
--   star: { s: 0..3, t: 0..3, a: 0..3, r: 0..3 },
--   coverage_score: 0..100,
--   rewrite_ar: string,
--   exemplar_ar: string,
--   filler_marks: [{ word, ts_ms }],
--   tips: string[]
-- }
-- ---------------------------------------------------------------------
ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS coaching JSONB,
  ADD COLUMN IF NOT EXISTS question_index INT,
  ADD COLUMN IF NOT EXISTS duration_ms INT;

-- ---------------------------------------------------------------------
-- 4. evaluations.scope (formative vs summative) (P0.1)
-- ---------------------------------------------------------------------
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'summative'
    CHECK (scope IN ('formative','summative'));

-- ---------------------------------------------------------------------
-- 5. question_templates extensions (P0.5)
-- ---------------------------------------------------------------------
ALTER TABLE public.question_templates
  ADD COLUMN IF NOT EXISTS track TEXT,
  ADD COLUMN IF NOT EXISTS competency TEXT,
  ADD COLUMN IF NOT EXISTS is_scenario BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gov_context BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS model_answer_ar TEXT,
  ADD COLUMN IF NOT EXISTS star_rubric JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('draft','review','approved','retired')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ar';

CREATE INDEX IF NOT EXISTS question_templates_track_idx ON public.question_templates(track);
CREATE INDEX IF NOT EXISTS question_templates_status_idx ON public.question_templates(status);

-- ---------------------------------------------------------------------
-- 6. INSTRUCTOR / COHORT LAYER (P0.6)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  track TEXT,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned','active','completed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','dropped')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, student_id)
);

CREATE INDEX IF NOT EXISTS enrollments_student_idx ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS enrollments_cohort_idx ON public.enrollments(cohort_id);

CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('interview','cv','quiz')),
  title TEXT NOT NULL,
  description TEXT,
  target_track TEXT,
  interview_type TEXT CHECK (interview_type IN ('text','voice','video')),
  required_questions INT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,
  cv_document_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','reviewed')),
  submitted_at TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.instructor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('interview','response','cv_document','submission')),
  target_id UUID NOT NULL,
  annotation_text TEXT NOT NULL,
  timestamp_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instructor_feedback_target_idx
  ON public.instructor_feedback(target_type, target_id);

-- ---------------------------------------------------------------------
-- 7. CV TABLES (P0.3 + P0.4)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cv_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_path TEXT,
  source_type TEXT NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload','builder')),
  parsed JSONB,
  scores JSONB,
  suggestions JSONB,
  target_role TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cv_documents_user_idx ON public.cv_documents(user_id);

CREATE TABLE IF NOT EXISTS public.cv_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'سيرة ذاتية',
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  template TEXT NOT NULL DEFAULT 'modern'
    CHECK (template IN ('classic','modern','executive')),
  language TEXT NOT NULL DEFAULT 'ar'
    CHECK (language IN ('ar','en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cv_drafts_user_idx ON public.cv_drafts(user_id);

-- ---------------------------------------------------------------------
-- 8. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- Is `_instructor_id` the instructor of any cohort that `_student_id` is
-- actively enrolled in?
CREATE OR REPLACE FUNCTION public.is_instructor_for_student(
  _instructor_id UUID,
  _student_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cohorts c
    JOIN public.enrollments e ON e.cohort_id = c.id
    WHERE c.instructor_id = _instructor_id
      AND e.student_id = _student_id
      AND e.status = 'active'
  )
$$;

-- ---------------------------------------------------------------------
-- 9. updated_at triggers for new tables
-- ---------------------------------------------------------------------
CREATE TRIGGER update_cohorts_updated_at
  BEFORE UPDATE ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cv_drafts_updated_at
  BEFORE UPDATE ON public.cv_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 10. RLS — enable + policies for new tables
-- ---------------------------------------------------------------------
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_drafts ENABLE ROW LEVEL SECURITY;

-- cohorts
CREATE POLICY "Instructors manage own cohorts" ON public.cohorts
  FOR ALL TO authenticated
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Admins manage all cohorts" ON public.cohorts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students view own cohorts" ON public.cohorts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.cohort_id = id AND e.student_id = auth.uid()
    )
  );

-- enrollments
CREATE POLICY "Instructors manage enrollments in own cohorts" ON public.enrollments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.instructor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.instructor_id = auth.uid())
  );

CREATE POLICY "Admins manage all enrollments" ON public.enrollments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students view own enrollments" ON public.enrollments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- assignments
CREATE POLICY "Instructors manage own cohort assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.instructor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.instructor_id = auth.uid())
  );

CREATE POLICY "Admins manage all assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students view assignments in enrolled cohorts" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.cohort_id = cohort_id AND e.student_id = auth.uid()
    )
  );

-- assignment_submissions
CREATE POLICY "Students manage own submissions" ON public.assignment_submissions
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Instructors view submissions for own cohort" ON public.assignment_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.cohorts c ON c.id = a.cohort_id
      WHERE a.id = assignment_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all submissions" ON public.assignment_submissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- instructor_feedback
CREATE POLICY "Instructors manage own feedback" ON public.instructor_feedback
  FOR ALL TO authenticated
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Admins manage all instructor feedback" ON public.instructor_feedback
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Students can view instructor feedback directed at their content
CREATE POLICY "Students view feedback on own content" ON public.instructor_feedback
  FOR SELECT TO authenticated
  USING (
    (target_type = 'interview' AND EXISTS (
      SELECT 1 FROM public.interviews i WHERE i.id = target_id AND i.user_id = auth.uid()
    ))
    OR
    (target_type = 'response' AND EXISTS (
      SELECT 1 FROM public.responses r
      JOIN public.interviews i ON i.id = r.interview_id
      WHERE r.id = target_id AND i.user_id = auth.uid()
    ))
    OR
    (target_type = 'cv_document' AND EXISTS (
      SELECT 1 FROM public.cv_documents d WHERE d.id = target_id AND d.user_id = auth.uid()
    ))
    OR
    (target_type = 'submission' AND EXISTS (
      SELECT 1 FROM public.assignment_submissions s WHERE s.id = target_id AND s.student_id = auth.uid()
    ))
  );

-- cv_documents
CREATE POLICY "Users manage own CV documents" ON public.cv_documents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all CV documents" ON public.cv_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors view enrolled student CV documents" ON public.cv_documents
  FOR SELECT TO authenticated
  USING (public.is_instructor_for_student(auth.uid(), user_id));

-- cv_drafts
CREATE POLICY "Users manage own CV drafts" ON public.cv_drafts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all CV drafts" ON public.cv_drafts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors view enrolled student CV drafts" ON public.cv_drafts
  FOR SELECT TO authenticated
  USING (public.is_instructor_for_student(auth.uid(), user_id));

-- ---------------------------------------------------------------------
-- 11. UPDATE EXISTING RLS — interviews/responses/evaluations
--     so HR sees only visibility='hr' and instructors see only their
--     cohort students.
-- ---------------------------------------------------------------------

-- interviews: HR & instructor visibility
DROP POLICY IF EXISTS "HR can view all interviews" ON public.interviews;
CREATE POLICY "HR can view HR-visible interviews" ON public.interviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'hr') AND visibility = 'hr');

CREATE POLICY "Instructors view enrolled student interviews" ON public.interviews
  FOR SELECT TO authenticated
  USING (
    public.is_instructor_for_student(auth.uid(), user_id)
    AND visibility IN ('instructor','hr')
  );

-- responses: HR & instructor visibility (mirror interviews)
DROP POLICY IF EXISTS "HR can view all responses" ON public.responses;
CREATE POLICY "HR can view HR-visible responses" ON public.responses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr')
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id AND i.visibility = 'hr'
    )
  );

CREATE POLICY "Instructors view enrolled student responses" ON public.responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND public.is_instructor_for_student(auth.uid(), i.user_id)
        AND i.visibility IN ('instructor','hr')
    )
  );

-- evaluations: HR & instructor visibility
DROP POLICY IF EXISTS "HR can view all evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "HR can update evaluations" ON public.evaluations;
CREATE POLICY "HR can view HR-visible evaluations" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr')
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id AND i.visibility = 'hr'
    )
  );

CREATE POLICY "HR can update HR-visible evaluations" ON public.evaluations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr')
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id AND i.visibility = 'hr'
    )
  );

CREATE POLICY "Instructors view enrolled student evaluations" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND public.is_instructor_for_student(auth.uid(), i.user_id)
        AND i.visibility IN ('instructor','hr')
    )
  );

-- cheat_events: HR sees only HR-visible
DROP POLICY IF EXISTS "HR can view cheat events" ON public.cheat_events;
CREATE POLICY "HR can view HR-visible cheat events" ON public.cheat_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr')
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id AND i.visibility = 'hr'
    )
  );

-- hr_notes: only meaningful for HR-visible interviews
DROP POLICY IF EXISTS "Admin/HR can manage notes" ON public.hr_notes;
CREATE POLICY "Admin manages all notes" ON public.hr_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR manages notes on HR-visible interviews" ON public.hr_notes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr')
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id AND i.visibility = 'hr'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'hr')
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id AND i.visibility = 'hr'
    )
  );

-- profiles: instructor can view enrolled student profile
CREATE POLICY "Instructors view enrolled student profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_instructor_for_student(auth.uid(), user_id));

-- question_templates: instructors can view approved questions
CREATE POLICY "Instructors view approved questions" ON public.question_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'instructor'
    )
    AND status = 'approved'
  );

-- Students can view approved questions tied to their training tracks
CREATE POLICY "Students view approved questions" ON public.question_templates
  FOR SELECT TO authenticated
  USING (status = 'approved');

-- ---------------------------------------------------------------------
-- 11.5  UPDATE notify_evaluation_complete — suppress HR + job_applications
--       writes when the underlying interview is in practice mode.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_evaluation_complete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_mode TEXT;
  v_visibility TEXT;
  v_job_position TEXT;
  hr_user_id UUID;
BEGIN
  SELECT user_id, mode, visibility, job_position
    INTO v_user_id, v_mode, v_visibility, v_job_position
    FROM public.interviews
   WHERE id = NEW.interview_id;

  -- Always notify the candidate / student.
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    v_user_id,
    'evaluation_complete',
    CASE WHEN v_mode = 'practice'
         THEN 'انتهى التدريب — راجع تغذيتك الراجعة'
         ELSE 'اكتمل تقييم مقابلتك'
    END,
    'الدرجة الإجمالية: ' || COALESCE(NEW.overall_score::TEXT, '—') || '/100',
    NEW.interview_id
  );

  -- HR notifications only for HR-visible (non-practice) evaluations.
  IF v_visibility = 'hr' AND v_mode <> 'practice' THEN
    FOR hr_user_id IN
      SELECT user_id FROM public.user_roles WHERE role IN ('hr','admin')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      VALUES (
        hr_user_id,
        'evaluation_complete',
        'تقييم جديد جاهز للمراجعة',
        'مقابلة: ' || COALESCE(v_job_position, ''),
        NEW.interview_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 12. SEED — minimal IPA-aligned question bank stub (3 tracks × 2 examples)
-- This is a stub; full content authoring is content-team work (P0.5
-- governance). Marked approved so they're visible immediately.
-- ---------------------------------------------------------------------
DO $seed$
DECLARE
  admin_id UUID;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.question_templates
    (question_text, category, difficulty, interview_type, created_by,
     track, competency, is_scenario, gov_context, model_answer_ar, star_rubric, status, language)
  VALUES
  ('حدّثني عن موقف اتخذت فيه قراراً صعباً في عملك، وكيف وصلت إليه؟',
   'سلوكي', 'medium', 'text', admin_id,
   'الإدارة العامة', 'اتخاذ القرار', false, true,
   'الإجابة القوية تتبع منهج STAR: تحديد الموقف بإيجاز، شرح المهمة المسؤول عنها، تفصيل الإجراءات المتّخذة بمنطق واضح، ثم النتيجة الملموسة مع رقم أو أثر محدد.',
   '{"s":"وضوح وصف السياق","t":"تحديد المسؤولية","a":"تسلسل القرار ومنطقه","r":"الأثر القابل للقياس"}'::jsonb,
   'approved', 'ar'),

  ('كيف تتعامل مع مواطن غاضب يطلب خدمة خارج صلاحياتك؟',
   'موقفي', 'medium', 'text', admin_id,
   'الإدارة العامة', 'خدمة المواطن', true, true,
   'الاستماع الفعّال أولاً، تعاطف بدون وعد لا تستطيع تنفيذه، توضيح الإجراء الصحيح بهدوء، وتقديم بديل واقعي أو تحويل لجهة مختصة.',
   '{"s":"وضوح الموقف","t":"المسؤولية تجاه المراجِع","a":"خطوات التهدئة والتوجيه","r":"رضا المراجع وحل المشكلة"}'::jsonb,
   'approved', 'ar'),

  ('صف تجربة قُدت فيها مشروع تحوّل رقمي. ما العقبات وكيف تجاوزتها؟',
   'سلوكي', 'hard', 'text', admin_id,
   'تقنية المعلومات', 'التحوّل الرقمي', false, true,
   'إجابة قوية تشمل: نطاق المشروع، الأطراف المعنية، مقاومة التغيير وكيفية إدارتها، الأدوات/المنهجيات، ومخرجات قابلة للقياس مرتبطة برؤية 2030.',
   '{"s":"وصف المشروع","t":"دورك القيادي","a":"إدارة العقبات والتغيير","r":"الأثر الرقمي والاستراتيجي"}'::jsonb,
   'approved', 'ar'),

  ('كيف تضمن أمن البيانات في نظام حكومي حسّاس؟',
   'تقني', 'hard', 'text', admin_id,
   'تقنية المعلومات', 'الأمن السيبراني', false, true,
   'تغطية: التشفير عند الراحة والنقل، مبدأ أقل صلاحية، التوثيق متعدد العوامل، الالتزام بضوابط الهيئة الوطنية للأمن السيبراني (NCA)، والمراجعة الدورية.',
   '{"s":"فهم البيئة الحكومية","t":"المسؤولية الأمنية","a":"التقنيات والممارسات","r":"الامتثال والوقاية"}'::jsonb,
   'approved', 'ar'),

  ('حدّثني عن موقف اكتشفت فيه خطأً مالياً قد يكلّف جهتك مبلغاً كبيراً. ماذا فعلت؟',
   'سلوكي', 'hard', 'text', admin_id,
   'الشؤون المالية', 'النزاهة والمساءلة', false, true,
   'الإبلاغ الفوري عبر القنوات الرسمية، توثيق الاكتشاف، التعاون مع المراجعة الداخلية دون إخفاء، واقتراح ضوابط تمنع تكرار الخطأ.',
   '{"s":"وصف الخطأ","t":"مسؤوليتك","a":"التصرف الأخلاقي والمهني","r":"الضوابط الوقائية"}'::jsonb,
   'approved', 'ar'),

  ('كيف توازن بين الالتزام بالأنظمة المالية وضرورة سرعة الإنجاز؟',
   'موقفي', 'medium', 'text', admin_id,
   'الشؤون المالية', 'الالتزام والكفاءة', true, true,
   'الأنظمة ليست عائقاً بل حماية؛ الإجابة الجيدة تشرح كيف يمكن التخطيط المسبق وتفويض الصلاحيات وتطوير قوالب معتمدة لتسريع العمل دون مخالفة.',
   '{"s":"السياق","t":"التحدّي","a":"التوازن العملي","r":"النتيجة دون مخالفة"}'::jsonb,
   'approved', 'ar');
END
$seed$;

-- ---------------------------------------------------------------------
-- DONE
-- ---------------------------------------------------------------------
