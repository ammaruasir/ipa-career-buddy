-- Add interview_engine column to system_settings
ALTER TABLE public.system_settings
ADD COLUMN interview_engine text NOT NULL DEFAULT 'built_in';
