
-- Step 1: Just add the new enum value (must be committed alone)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'candidate';
