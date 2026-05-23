-- migration 006: admin_users RLS 정책 보완 + get_user_id_by_email RPC 추가

-- 재귀 없이 현재 사용자의 관리자 여부를 확인하는 SECURITY DEFINER 함수
-- RLS 정책 내에서 admin_users를 재참조하면 무한재귀 발생하므로 함수 경유
CREATE OR REPLACE FUNCTION public.uid_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND revoked_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.uid_is_admin() TO authenticated;

-- 기존 select 정책 교체: 본인 행 또는 관리자이면 전체 조회 허용
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;

CREATE POLICY "admin_users_select_own" ON public.admin_users
  FOR SELECT USING (user_id = auth.uid() OR public.uid_is_admin());

-- 기존 insert 정책 교체: 관리자만 삽입 허용
DROP POLICY IF EXISTS "admin_users_insert" ON public.admin_users;

CREATE POLICY "admin_users_insert" ON public.admin_users
  FOR INSERT WITH CHECK (public.uid_is_admin());

-- update 정책 추가: 관리자만 revoke(revoked_at 갱신) 허용
DROP POLICY IF EXISTS "admin_users_update" ON public.admin_users;

CREATE POLICY "admin_users_update" ON public.admin_users
  FOR UPDATE USING (public.uid_is_admin());

-- 이메일로 auth.users user_id를 조회하는 RPC 함수
-- auth.users는 anon/authenticated 에서 직접 접근 불가하므로 SECURITY DEFINER 필요
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;
  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
