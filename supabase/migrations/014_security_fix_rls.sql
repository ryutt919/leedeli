-- prep_items: 미사용 테이블 제거 (S8T2 완료, 보안 경고 해소)
-- prepsRepo.ts는 preps.data jsonb 방식만 사용하므로 prep_items는 불필요
DROP TABLE IF EXISTS public.prep_items;

-- restock_history: 누락된 테이블 문서화 + RLS 활성화
-- src/storage/restockRepo.ts 에서 SELECT/INSERT/DELETE 사용 중
CREATE TABLE IF NOT EXISTS public.restock_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_id uuid NOT NULL REFERENCES public.preps(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  restock_date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restock_history_select_admin"
  ON public.restock_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.revoked_at IS NULL
    )
  );

CREATE POLICY "restock_history_write_admin"
  ON public.restock_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.revoked_at IS NULL
    )
  );
