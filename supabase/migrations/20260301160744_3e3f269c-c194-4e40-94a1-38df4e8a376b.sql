
-- Create system_settings table (single-row config pattern)
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoring_weights jsonb NOT NULL DEFAULT '{"technical": 40, "communication": 30, "cultural_fit": 30}'::jsonb,
  questions_per_type jsonb NOT NULL DEFAULT '{"text": 8, "voice": 5, "video": 5}'::jsonb,
  time_per_question jsonb NOT NULL DEFAULT '{"text": 0, "voice": 300, "video": 300}'::jsonb,
  job_positions jsonb NOT NULL DEFAULT '["محلل أعمال", "أخصائي موارد بشرية", "مدير مشاريع", "مطور برمجيات", "محاسب", "أخصائي تسويق"]'::jsonb,
  ai_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  maintenance_mode boolean NOT NULL DEFAULT false,
  brand_color text NOT NULL DEFAULT '#006C35',
  evaluation_thresholds jsonb NOT NULL DEFAULT '{"highly_recommended": 80, "recommended": 60}'::jsonb,
  filler_words jsonb NOT NULL DEFAULT '["ممم", "يعني", "أحس", "كدا", "طبعاً", "بصراحة", "الله يعطيك العافية"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read settings
CREATE POLICY "Authenticated users can read settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update settings"
  ON public.system_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings"
  ON public.system_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.system_settings (id) VALUES (gen_random_uuid());
