-- core tables: schedules, ingredients, preps
-- data 컬럼에 jsonb 전략 사용 (도메인 타입 전체 직렬화)

-- schedules
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedules enable row level security;

create policy "schedules_select_admin"
  on public.schedules
  for select
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );

create policy "schedules_write_admin"
  on public.schedules
  for all
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );

-- ingredients
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ingredients enable row level security;

create policy "ingredients_select_admin"
  on public.ingredients
  for select
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );

create policy "ingredients_write_admin"
  on public.ingredients
  for all
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );

-- preps
create table if not exists public.preps (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preps enable row level security;

create policy "preps_select_admin"
  on public.preps
  for select
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );

create policy "preps_write_admin"
  on public.preps
  for all
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
        and au.revoked_at is null
    )
  );
