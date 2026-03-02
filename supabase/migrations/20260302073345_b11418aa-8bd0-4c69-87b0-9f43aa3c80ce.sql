
-- Fix: Replace overly permissive INSERT policy with a more specific one
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Only allow inserts where user_id matches the authenticated user OR via admin/hr
-- Triggers use SECURITY DEFINER so they bypass RLS anyway
CREATE POLICY "Users receive notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));
