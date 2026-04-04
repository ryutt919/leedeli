-- migration 004: admin_users RLS 무한 재귀 수정
-- 문제: SELECT 정책이 EXISTS (SELECT 1 FROM admin_users WHERE ...) 로 자기 자신을 참조
--       → PostgreSQL 42P17 infinite recursion detected
-- 수정: 직접 비교 방식으로 교체

DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;

CREATE POLICY "admin_users_select_own" ON public.admin_users
  FOR SELECT USING (user_id = auth.uid());
