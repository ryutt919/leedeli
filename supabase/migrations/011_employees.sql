CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY employees_select ON public.employees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND revoked_at IS NULL));
CREATE POLICY employees_write ON public.employees FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND revoked_at IS NULL));
