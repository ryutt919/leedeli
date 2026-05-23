CREATE TABLE IF NOT EXISTS public.shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_types_select ON public.shift_types FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND revoked_at IS NULL));
CREATE POLICY shift_types_write ON public.shift_types FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND revoked_at IS NULL));
