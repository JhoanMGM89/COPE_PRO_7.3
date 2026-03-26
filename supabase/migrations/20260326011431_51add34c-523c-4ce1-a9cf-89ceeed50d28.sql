
CREATE TABLE IF NOT EXISTS public.ip_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  olt text NOT NULL DEFAULT '',
  localidad text NOT NULL DEFAULT '',
  coinversor text NOT NULL DEFAULT '',
  tecnologia text NOT NULL DEFAULT '',
  grupo_trabajo text NOT NULL DEFAULT '',
  articulo_config text NOT NULL DEFAULT '',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ip_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read ip_base"
  ON public.ip_base FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert ip_base"
  ON public.ip_base FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ip_base"
  ON public.ip_base FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ip_base"
  ON public.ip_base FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete records
CREATE POLICY "Admins can delete records"
  ON public.records FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
