alter table public.device_fcm_tokens
add column if not exists device_id text,
add column if not exists application_id text;

create index if not exists device_fcm_tokens_application_id_idx
on public.device_fcm_tokens(application_id);

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.device_fcm_tokens'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) like '%REFERENCES auth.users%';

  if constraint_name is not null then
    execute format('alter table public.device_fcm_tokens drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.device_fcm_tokens
drop constraint if exists device_fcm_tokens_user_id_fkey;

alter table public.device_fcm_tokens
add constraint device_fcm_tokens_user_id_fkey
foreign key (user_id)
references public.profiles(id)
on delete cascade;
