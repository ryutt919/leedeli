-- 직원 휴가 사용 이력 테이블
CREATE TABLE IF NOT EXISTS public.vacation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date text NOT NULL,
  type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vacation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vacation_records_select_admin"
  ON public.vacation_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.revoked_at IS NULL
    )
  );

CREATE POLICY "vacation_records_write_admin"
  ON public.vacation_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.revoked_at IS NULL
    )
  );
