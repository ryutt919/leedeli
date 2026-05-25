CREATE TABLE IF NOT EXISTS public.week_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.week_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY week_presets_select ON public.week_presets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND revoked_at IS NULL));
CREATE POLICY week_presets_write ON public.week_presets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND revoked_at IS NULL));
