
-- Update existing student roles to candidate
UPDATE public.user_roles SET role = 'candidate' WHERE role = 'student';

-- Update handle_new_user to assign 'candidate' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'candidate');
  RETURN NEW;
END;
$$;

-- Update RLS policy referencing 'student'
DROP POLICY IF EXISTS "HR can view student profiles" ON public.profiles;
CREATE POLICY "HR can view candidate profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role) AND has_role(user_id, 'candidate'::app_role));
