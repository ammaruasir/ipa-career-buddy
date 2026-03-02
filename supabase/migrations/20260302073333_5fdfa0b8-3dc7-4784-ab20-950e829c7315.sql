
-- Phase 1: Add pipeline_stage to job_applications
ALTER TABLE public.job_applications 
ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'applied';

-- Phase 4: Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  related_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- System can insert notifications (via triggers using security definer)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: notify on new job application
CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _vacancy_title text;
  _applicant_name text;
  _hr_user record;
BEGIN
  SELECT title INTO _vacancy_title FROM job_vacancies WHERE id = NEW.vacancy_id;
  SELECT full_name INTO _applicant_name FROM profiles WHERE user_id = NEW.user_id;

  -- Notify all HR and admin users
  FOR _hr_user IN 
    SELECT user_id FROM user_roles WHERE role IN ('hr', 'admin')
  LOOP
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      _hr_user.user_id, 
      'new_application',
      'طلب توظيف جديد',
      COALESCE(_applicant_name, 'مرشح') || ' تقدم لوظيفة ' || COALESCE(_vacancy_title, ''),
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_application
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_new_application();

-- Trigger function: notify candidate on application status change
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _vacancy_title text;
  _stage_label text;
BEGIN
  IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    SELECT title INTO _vacancy_title FROM job_vacancies WHERE id = NEW.vacancy_id;
    
    _stage_label := CASE NEW.pipeline_stage
      WHEN 'applied' THEN 'مقدّم'
      WHEN 'screening' THEN 'قيد الفرز'
      WHEN 'interviewing' THEN 'مقابلة'
      WHEN 'offered' THEN 'عرض وظيفي'
      WHEN 'hired' THEN 'تم التعيين'
      WHEN 'rejected' THEN 'مرفوض'
      ELSE NEW.pipeline_stage
    END;

    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      NEW.user_id,
      'status_update',
      'تحديث حالة الطلب',
      'تم تحديث حالة طلبك لوظيفة ' || COALESCE(_vacancy_title, '') || ' إلى: ' || _stage_label,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_application_status_change
AFTER UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_status_change();

-- Trigger function: notify on evaluation completion
CREATE OR REPLACE FUNCTION public.notify_evaluation_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _interview record;
  _hr_user record;
BEGIN
  SELECT * INTO _interview FROM interviews WHERE id = NEW.interview_id;
  
  -- Notify the candidate
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (
    _interview.user_id,
    'evaluation_complete',
    'اكتمل تقييم المقابلة',
    'تم تقييم مقابلتك لوظيفة ' || _interview.job_position || ' — الدرجة: ' || COALESCE(NEW.overall_score::text, '—') || '%',
    NEW.interview_id
  );

  -- Notify HR/Admin
  FOR _hr_user IN SELECT user_id FROM user_roles WHERE role IN ('hr', 'admin')
  LOOP
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      _hr_user.user_id,
      'evaluation_complete',
      'تقييم مقابلة جديد',
      'اكتمل تقييم مقابلة ' || _interview.job_position || ' — الدرجة: ' || COALESCE(NEW.overall_score::text, '—') || '%',
      NEW.interview_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_evaluation_complete
AFTER INSERT ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.notify_evaluation_complete();

-- Allow HR to update pipeline_stage on job_applications
CREATE POLICY "HR can update applications"
ON public.job_applications FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role));
