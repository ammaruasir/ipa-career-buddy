
ALTER TABLE public.system_settings
ADD COLUMN interviewer_voice jsonb NOT NULL DEFAULT '{"name": "نورة", "gender": "female", "voice_id": "SAz9YHcvj6GT2YYXdXww", "avatar_url": ""}'::jsonb;
