-- get_admin_users_with_email: auth.users 조인으로 이메일 포함 관리자 목록 반환
CREATE OR REPLACE FUNCTION get_admin_users_with_email()
RETURNS TABLE(id uuid, user_id uuid, email text, granted_at timestamptz, granted_by uuid)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    au.id,
    au.user_id,
    u.email::text,
    au.granted_at,
    au.granted_by
  FROM public.admin_users au
  LEFT JOIN auth.users u ON u.id = au.user_id
  WHERE au.revoked_at IS NULL;
$$;
