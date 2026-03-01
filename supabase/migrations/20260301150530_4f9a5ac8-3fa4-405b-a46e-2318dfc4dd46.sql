
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('student', 'admin', 'hr');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  branch_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create interview type and status enums
CREATE TYPE public.interview_type AS ENUM ('text', 'voice', 'video');
CREATE TYPE public.interview_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create interviews table
CREATE TABLE public.interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type interview_type NOT NULL,
  status interview_status NOT NULL DEFAULT 'pending',
  job_position TEXT NOT NULL,
  questions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create responses table
CREATE TABLE public.responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  media_url TEXT,
  ai_analysis JSONB,
  scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  communication_score NUMERIC(3,1) CHECK (communication_score >= 0 AND communication_score <= 10),
  technical_score NUMERIC(3,1) CHECK (technical_score >= 0 AND technical_score <= 10),
  personality_match NUMERIC(3,1) CHECK (personality_match >= 0 AND personality_match <= 10),
  overall_score NUMERIC(3,1) CHECK (overall_score >= 0 AND overall_score <= 10),
  ai_feedback_ar TEXT,
  strengths JSONB DEFAULT '[]'::jsonb,
  improvements JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: profiles
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR can view student profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'hr') AND public.has_role(user_id, 'student'));

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS: user_roles
CREATE POLICY "Users can read own role" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS: interviews
CREATE POLICY "Students can view own interviews" ON public.interviews
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Students can create own interviews" ON public.interviews
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update own interviews" ON public.interviews
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all interviews" ON public.interviews
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR can view all interviews" ON public.interviews
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'hr'));

-- RLS: responses
CREATE POLICY "Students can view own responses" ON public.responses
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews WHERE id = interview_id AND user_id = auth.uid()
));

CREATE POLICY "Students can insert own responses" ON public.responses
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.interviews WHERE id = interview_id AND user_id = auth.uid()
));

CREATE POLICY "Admins can manage all responses" ON public.responses
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR can view all responses" ON public.responses
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'hr'));

-- RLS: evaluations
CREATE POLICY "Students can view own evaluations" ON public.evaluations
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews WHERE id = interview_id AND user_id = auth.uid()
));

CREATE POLICY "Admins can manage all evaluations" ON public.evaluations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR can view all evaluations" ON public.evaluations
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'hr'));
