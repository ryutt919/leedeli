-- admin_users 테이블: 관리자 권한 기록
-- granted_by: 권한을 부여한 관리자 uuid
-- granted_at: 부여 시각
-- revoked_at: 취소 시각 (null = 현재 유효)

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id)
);

-- RLS 활성화
alter table public.admin_users enable row level security;

-- policy 1: 관리자만 조회 가능 (admin_users에 본인 행이 있고 revoked_at IS NULL)
create policy "admin_users_select"
  on public.admin_users
  for select
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );

-- policy 2: 관리자만 삽입 가능
create policy "admin_users_insert"
  on public.admin_users
  for insert
  with check (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );
