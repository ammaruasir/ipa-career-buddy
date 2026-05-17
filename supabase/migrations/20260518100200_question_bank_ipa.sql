-- P0.5: بنك أسئلة IPA — تمديد question_templates
-- Adds track/competency/scenario metadata + governance fields + reference tables.

-- Reference tables (seedable by content team)
CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial IPA tracks
INSERT INTO public.tracks (code, name_ar, name_en, sort_order) VALUES
  ('hr',                    'الموارد البشرية',     'Human Resources',         1),
  ('it',                    'تقنية المعلومات',     'Information Technology',  2),
  ('finance',               'المالية',             'Finance',                 3),
  ('public_admin',          'الإدارة العامة',      'Public Administration',   4),
  ('information_mgmt',      'إدارة المعلومات',     'Information Management',  5),
  ('libraries',             'المكتبات',            'Libraries',               6),
  ('digital_transformation','التحوّل الرقمي',      'Digital Transformation',  7),
  ('citizen_services',      'خدمة المواطن',        'Citizen Services',        8)
ON CONFLICT (code) DO NOTHING;

-- Seed initial competencies (Saudi public-sector framework)
INSERT INTO public.competencies (code, name_ar, name_en, sort_order) VALUES
  ('decision_making', 'اتخاذ القرار',    'Decision Making',  1),
  ('citizen_service', 'خدمة المواطن',    'Citizen Service',  2),
  ('teamwork',        'العمل الجماعي',   'Teamwork',         3),
  ('ethics',          'الأخلاقيات',      'Ethics',           4),
  ('digital_skills',  'المهارات الرقمية', 'Digital Skills',   5),
  ('communication',   'التواصل',         'Communication',    6),
  ('leadership',      'القيادة',         'Leadership',       7),
  ('innovation',      'الابتكار',        'Innovation',       8)
ON CONFLICT (code) DO NOTHING;

-- Extend question_templates with IPA metadata + governance
ALTER TABLE public.question_templates
  ADD COLUMN IF NOT EXISTS track TEXT REFERENCES public.tracks(code),
  ADD COLUMN IF NOT EXISTS competency TEXT REFERENCES public.competencies(code),
  ADD COLUMN IF NOT EXISTS is_scenario BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gov_context BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS model_answer_ar TEXT,
  ADD COLUMN IF NOT EXISTS model_answer_en TEXT,
  ADD COLUMN IF NOT EXISTS star_rubric JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved'
    CHECK (status IN ('draft', 'review', 'approved', 'retired')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS p_value NUMERIC(3,2);

CREATE INDEX IF NOT EXISTS idx_questions_track       ON public.question_templates(track);
CREATE INDEX IF NOT EXISTS idx_questions_competency  ON public.question_templates(competency);
CREATE INDEX IF NOT EXISTS idx_questions_status      ON public.question_templates(status);

-- RLS for the new reference tables (public-readable, admin-managed)
ALTER TABLE public.tracks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active tracks"
  ON public.tracks
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage tracks"
  ON public.tracks
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone reads active competencies"
  ON public.competencies
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage competencies"
  ON public.competencies
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON COLUMN public.question_templates.star_rubric IS
$$STAR scoring criteria per question:
{
  "situation": "what to look for in the situation element",
  "task":      "what to look for in the task element",
  "action":    "what to look for in the action element",
  "result":    "what to look for in the result element (must be quantifiable)"
}$$;
