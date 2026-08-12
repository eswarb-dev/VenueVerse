create table if not exists public.device_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null,
  fcm_token text not null,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  app_variant text not null default 'production',
  app_version text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_registered_at timestamptz not null default now(),
  unique (user_id, installation_id),
  unique (fcm_token)
);

create index if not exists device_fcm_tokens_active_user_idx
on public.device_fcm_tokens(user_id)
where is_active = true;

create index if not exists device_fcm_tokens_installation_idx
on public.device_fcm_tokens(installation_id);

alter table public.device_fcm_tokens enable row level security;

revoke all on public.device_fcm_tokens from anon, authenticated;

create table if not exists public.push_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  token_id uuid not null references public.device_fcm_tokens(id) on delete cascade,
  provider text not null default 'fcm',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'retryable_error', 'permanent_error', 'skipped')),
  provider_message_id text,
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, token_id, provider)
);

create index if not exists push_delivery_attempts_notification_idx
on public.push_delivery_attempts(notification_id);

alter table public.push_delivery_attempts enable row level security;

revoke all on public.push_delivery_attempts from anon, authenticated;
