-- migration 008: get_all_users_for_admin RPC
-- 전체 auth.users를 관리자 여부와 함께 반환하는 RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  is_admin boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = u.id
        AND au.revoked_at IS NULL
    ) AS is_admin
  FROM auth.users u
  ORDER BY u.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;
