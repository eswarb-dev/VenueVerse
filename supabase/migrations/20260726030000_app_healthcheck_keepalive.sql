-- External keepalive healthcheck for Supabase Free projects.
-- This table stores one harmless row that scheduled external pings can read.
-- The keepalive read does not change app data and does not write dummy rows repeatedly.

create table if not exists public.app_healthcheck (
  id integer primary key,
  name text not null default 'venueverse'
);

insert into public.app_healthcheck (id, name)
values (1, 'venueverse')
on conflict (id) do nothing;

alter table public.app_healthcheck enable row level security;

drop policy if exists "Allow anon read app healthcheck row" on public.app_healthcheck;

create policy "Allow anon read app healthcheck row"
on public.app_healthcheck
for select
to anon
using (id = 1);
