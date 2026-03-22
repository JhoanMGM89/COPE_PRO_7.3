
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'agent');

-- Create agents table
CREATE TABLE public.agents (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nit text UNIQUE NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create records table for all template copies
CREATE TABLE public.records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    module text NOT NULL,
    template_type text,
    id_mostrado text,
    tipo_falla text,
    observation text,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
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

-- RLS policies for agents
CREATE POLICY "Agents can read own profile" ON public.agents
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert agents" ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agents" ON public.agents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agents" ON public.agents
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_roles
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for records
CREATE POLICY "Agents can insert own records" ON public.records
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can read own records" ON public.records
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
