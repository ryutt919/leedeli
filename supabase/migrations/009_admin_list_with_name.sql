-- migration 009: 관리자 목록에 이름(name) 필드 추가
-- get_admin_users_with_email 함수를 확장하여 user_metadata의 name 반환
CREATE OR REPLACE FUNCTION get_admin_users_with_email()
RETURNS TABLE(id uuid, user_id uuid, email text, name text, granted_at timestamptz, granted_by uuid)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    au.id,
    au.user_id,
    u.email::text,
    (u.raw_user_meta_data->>'name')::text AS name,
    au.granted_at,
    au.granted_by
  FROM public.admin_users au
  LEFT JOIN auth.users u ON u.id = au.user_id
  WHERE au.revoked_at IS NULL;
$$;
