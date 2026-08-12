create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  app_variant text not null default 'release',
  application_id text,
  device_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_registered_at timestamptz not null default now()
);

create index if not exists device_push_tokens_active_user_idx
on public.device_push_tokens(user_id)
where is_active = true;

create index if not exists device_push_tokens_application_id_idx
on public.device_push_tokens(application_id);

alter table public.device_push_tokens enable row level security;

revoke all on public.device_push_tokens from anon, authenticated;
