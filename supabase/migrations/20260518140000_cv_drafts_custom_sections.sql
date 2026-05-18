-- CV Builder: custom sections (volunteer work, awards, projects)
-- Plus structured languages with CEFR proficiency.

ALTER TABLE public.cv_drafts
  ADD COLUMN IF NOT EXISTS custom_sections JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.cv_drafts.custom_sections IS
$$Custom CV sections beyond the standard set. Expected shape:
{
  "volunteer": [
    { "organization": "...", "role": "...", "start": "...", "end": "...", "description": "..." }
  ],
  "awards": [
    { "title": "...", "issuer": "...", "date": "...", "description": "..." }
  ],
  "projects": [
    { "name": "...", "role": "...", "link": "...", "description": "...", "tech": ["..."] }
  ],
  "languages_structured": [
    { "name": "العربية", "cefr": "C2", "label": "الأم" }
  ]
}
Each list is optional and may be empty.$$;
