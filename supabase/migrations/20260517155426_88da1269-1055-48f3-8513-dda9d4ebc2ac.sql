UPDATE public.system_settings
SET interviewer_voice = jsonb_build_object(
  'name', 'هيثم',
  'gender', 'male',
  'voice_id', 'IES4nrmZdUBHByLBde0P',
  'avatar_url', COALESCE(interviewer_voice->>'avatar_url', '')
)
WHERE (interviewer_voice->>'voice_id') = 'SAz9YHcvj6GT2YYXdXww'
   OR interviewer_voice IS NULL;