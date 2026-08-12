alter table public.push_tokens
add column if not exists app_variant text;

alter table public.push_tokens
add column if not exists application_id text;

alter table public.push_tokens
add column if not exists app_version text;

alter table public.push_tokens
add column if not exists native_build_version text;

alter table public.push_tokens
add column if not exists last_registered_at timestamptz;

create index if not exists push_tokens_user_active_idx
on public.push_tokens(user_id, is_active);

create index if not exists push_tokens_application_id_idx
on public.push_tokens(application_id);
