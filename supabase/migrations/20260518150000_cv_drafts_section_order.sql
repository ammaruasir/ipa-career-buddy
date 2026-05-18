-- CV Builder: user-defined section order.
-- Stores an array of section keys; renderers (PreviewStep + render-cv-pdf)
-- iterate this order instead of the hardcoded sequence.
-- If NULL or empty, renderers fall back to the default order.

ALTER TABLE public.cv_drafts
  ADD COLUMN IF NOT EXISTS section_order TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.cv_drafts.section_order IS
$$User-defined section order. Allowed keys: summary, experience, education,
skills, certifications, volunteer, projects, awards, languages_structured.
Sections not in the array still render at the bottom in default order.
NULL = use default order.$$;
