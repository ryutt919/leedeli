-- 003_fix_preps_schema.sql
-- preps 테이블에 data 컬럼이 누락된 경우 추가하고 JSONB 형식을 보장합니다.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'preps' AND column_name = 'data'
    ) THEN
        ALTER TABLE public.preps ADD COLUMN data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- RLS 활성화 확인
ALTER TABLE public.preps ENABLE ROW LEVEL SECURITY;

-- 정책 재설정 (관리자만 가능)
DROP POLICY IF EXISTS "preps_select_admin" ON public.preps;
CREATE POLICY "preps_select_admin"
  ON public.preps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "preps_write_admin" ON public.preps;
CREATE POLICY "preps_write_admin"
  ON public.preps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.revoked_at IS NULL
    )
  );
