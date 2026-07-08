create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  department text,
  role text not null default 'user',
  register_number text,
  phone text,
  created_at timestamp with time zone default now(),
  constraint profiles_role_check check (role in ('user', 'admin', 'super_admin'))
);

create table if not exists public.halls (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  venue_type text,
  location text,
  block text,
  floor text,
  capacity integer not null,
  facilities text[],
  image_url text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  constraint halls_capacity_check check (capacity > 0)
);

alter table public.halls
add column if not exists department text,
add column if not exists venue_type text,
add column if not exists location text;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid references public.halls(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  event_title text not null,
  event_type text,
  purpose text,
  department text,
  audience_count integer,
  faculty_coordinator text,
  additional_requirements text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text not null default 'pending',
  admin_remarks text,
  approved_by uuid references public.profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint bookings_time_check check (end_time > start_time),
  constraint bookings_audience_count_check check (audience_count is null or audience_count > 0),
  constraint bookings_status_check check (
    status in ('pending', 'approved', 'rejected', 'cancelled', 'completed')
  )
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean default false,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  device_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, expo_push_token)
);

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null unique,
  window_start timestamptz not null default now(),
  request_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications
add column if not exists booking_id uuid references public.bookings(id) on delete set null;

alter table public.bookings
add column if not exists additional_requirements text;

create index if not exists bookings_hall_id_idx on public.bookings(hall_id);
create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_start_time_idx on public.bookings(start_time);
create index if not exists bookings_end_time_idx on public.bookings(end_time);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);
create index if not exists halls_department_idx on public.halls(department);
create index if not exists halls_venue_type_idx on public.halls(venue_type);
create unique index if not exists rate_limits_rate_key_idx on public.rate_limits(rate_key);
create index if not exists rate_limits_window_start_idx on public.rate_limits(window_start);

create or replace function public.check_booking_overlap(
  selected_hall_id uuid,
  new_start_time timestamp with time zone,
  new_end_time timestamp with time zone
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.bookings existing
    where existing.hall_id = selected_hall_id
      and existing.status in ('pending', 'approved')
      and existing.start_time < new_end_time
      and existing.end_time > new_start_time
  );
$$;

create or replace function public.check_approved_booking_overlap(
  selected_hall_id uuid,
  booking_to_ignore uuid,
  new_start_time timestamp with time zone,
  new_end_time timestamp with time zone
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.bookings existing
    where existing.hall_id = selected_hall_id
      and existing.status = 'approved'
      and existing.id <> booking_to_ignore
      and existing.start_time < new_end_time
      and existing.end_time > new_start_time
  );
$$;

create or replace function public.get_today_booked_halls(
  day_start timestamptz,
  day_end timestamptz
)
returns table (
  booking_id uuid,
  hall_id uuid,
  hall_name text,
  department text,
  venue_type text,
  location text,
  event_title text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id as booking_id,
    b.hall_id,
    h.name as hall_name,
    h.department,
    h.venue_type,
    h.location,
    b.event_title,
    b.start_time,
    b.end_time,
    b.status::text,
    b.created_at
  from public.bookings b
  join public.halls h on h.id = b.hall_id
  where b.status in ('pending', 'approved')
    and b.start_time >= day_start
    and b.start_time < day_end
  order by b.created_at desc, b.updated_at desc, b.start_time desc;
$$;

create or replace function public.set_booking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_booking_updated_at on public.bookings;

create trigger set_booking_updated_at
before update on public.bookings
for each row
execute function public.set_booking_updated_at();

drop trigger if exists set_push_token_updated_at on public.push_tokens;

create trigger set_push_token_updated_at
before update on public.push_tokens
for each row
execute function public.set_booking_updated_at();

drop trigger if exists set_rate_limits_updated_at on public.rate_limits;

create trigger set_rate_limits_updated_at
before update on public.rate_limits
for each row
execute function public.set_booking_updated_at();

create or replace function public.check_rate_limit(
  rate_key text,
  max_requests int,
  window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_limit public.rate_limits%rowtype;
  current_time timestamptz := now();
begin
  if rate_key is null or btrim(rate_key) = '' then
    raise exception 'rate_key is required.';
  end if;

  if max_requests <= 0 then
    raise exception 'max_requests must be greater than 0.';
  end if;

  if window_seconds <= 0 then
    raise exception 'window_seconds must be greater than 0.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(rate_key, 0));

  select *
  into current_limit
  from public.rate_limits
  where public.rate_limits.rate_key = check_rate_limit.rate_key
  for update;

  if not found then
    insert into public.rate_limits (rate_key, window_start, request_count)
    values (rate_key, current_time, 1);
    return true;
  end if;

  if current_limit.window_start + make_interval(secs => window_seconds) <= current_time then
    update public.rate_limits
    set window_start = current_time,
        request_count = 1,
        updated_at = current_time
    where id = current_limit.id;
    return true;
  end if;

  if current_limit.request_count < max_requests then
    update public.rate_limits
    set request_count = request_count + 1,
        updated_at = current_time
    where id = current_limit.id;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

create or replace function public.enforce_booking_submit_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    if not public.check_rate_limit(
      'booking-submit:' || new.user_id::text,
      5,
      300
    ) then
      raise exception 'You are submitting booking requests too quickly. Please wait a few minutes and try again.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_booking_submit_rate_limit on public.bookings;

create trigger enforce_booking_submit_rate_limit
before insert on public.bookings
for each row
execute function public.enforce_booking_submit_rate_limit();

create or replace function public.enforce_booking_overlap_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status in ('pending', 'approved') then
    if exists (
      select 1
      from public.bookings existing
      where existing.hall_id = new.hall_id
        and existing.status in ('pending', 'approved')
        and existing.start_time < new.end_time
        and existing.end_time > new.start_time
    ) then
      raise exception 'This venue is already booked or awaiting approval for the selected time.';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status = 'approved' then
    if exists (
      select 1
      from public.bookings existing
      where existing.id <> new.id
        and existing.hall_id = new.hall_id
        and existing.status = 'approved'
        and existing.start_time < new.end_time
        and existing.end_time > new.start_time
    ) then
      raise exception 'This venue already has an approved booking for the selected time.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_booking_overlap_rules on public.bookings;

create trigger enforce_booking_overlap_rules
before insert or update on public.bookings
for each row
execute function public.enforce_booking_overlap_rules();

alter table public.profiles enable row level security;
alter table public.halls enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.rate_limits enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_admin_or_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_super_admin();
$$;

create or replace function public.create_admin_booking_notifications(
  booking_to_notify uuid
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record record;
begin
  select
    b.id,
    b.user_id,
    b.event_title,
    h.name as hall_name
  into booking_record
  from public.bookings b
  left join public.halls h on h.id = b.hall_id
  where b.id = booking_to_notify;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if booking_record.user_id <> auth.uid() and not public.is_admin_or_super_admin() then
    raise exception 'Not allowed to notify admins for this booking.';
  end if;

  return query
  with recipients as (
    select id
    from public.profiles
    where role in ('admin', 'super_admin')
  ),
  inserted as (
    insert into public.notifications (
      user_id,
      title,
      message,
      booking_id,
      is_read
    )
    select
      recipients.id,
      'New booking request',
      booking_record.event_title || ' requested for ' || coalesce(booking_record.hall_name, 'a venue'),
      booking_record.id,
      false
    from recipients
    returning user_id
  )
  select inserted.user_id from inserted;
end;
$$;

grant execute on function public.create_admin_booking_notifications(uuid) to authenticated;

create or replace function public.prevent_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
    and current_user <> 'service_role'
    and not public.is_super_admin()
  then
    raise exception 'Only super_admin users can update profile roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_update on public.profiles;

create trigger prevent_profile_role_update
before update on public.profiles
for each row
execute function public.prevent_profile_role_update();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    department,
    role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'department',
    case
      when lower(new.email) = 'eswar.2411018@srec.ac.in' then 'super_admin'
      else 'user'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists handle_new_user_profile on auth.users;

create trigger handle_new_user_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create or replace function public.enforce_booking_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_super_admin() then
    if new.hall_id is distinct from old.hall_id
      or new.user_id is distinct from old.user_id
      or new.event_title is distinct from old.event_title
      or new.event_type is distinct from old.event_type
      or new.purpose is distinct from old.purpose
      or new.department is distinct from old.department
      or new.audience_count is distinct from old.audience_count
      or new.faculty_coordinator is distinct from old.faculty_coordinator
      or new.additional_requirements is distinct from old.additional_requirements
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.created_at is distinct from old.created_at then
      raise exception 'Admins can only update booking status, admin remarks, and approval metadata.';
    end if;

    if new.status not in ('approved', 'rejected', old.status) then
      raise exception 'Admins can only approve or reject bookings.';
    end if;

    return new;
  end if;

  if old.user_id = auth.uid()
    and old.status = 'pending'
    and new.status = 'cancelled'
    and new.hall_id is not distinct from old.hall_id
    and new.user_id is not distinct from old.user_id
    and new.event_title is not distinct from old.event_title
    and new.event_type is not distinct from old.event_type
    and new.purpose is not distinct from old.purpose
    and new.department is not distinct from old.department
    and new.audience_count is not distinct from old.audience_count
    and new.faculty_coordinator is not distinct from old.faculty_coordinator
    and new.additional_requirements is not distinct from old.additional_requirements
    and new.start_time is not distinct from old.start_time
    and new.end_time is not distinct from old.end_time
    and new.admin_remarks is not distinct from old.admin_remarks
    and new.approved_by is not distinct from old.approved_by
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception 'Users can only cancel their own pending bookings.';
end;
$$;

drop trigger if exists enforce_booking_update_rules on public.bookings;

create trigger enforce_booking_update_rules
before update on public.bookings
for each row
execute function public.enforce_booking_update_rules();

create or replace function public.enforce_notification_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id = auth.uid()
    and new.user_id is not distinct from old.user_id
    and new.title is not distinct from old.title
    and new.message is not distinct from old.message
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception 'Users can only update their own notification read status.';
end;
$$;

drop trigger if exists enforce_notification_update_rules on public.notifications;

create trigger enforce_notification_update_rules
before update on public.notifications
for each row
execute function public.enforce_notification_update_rules();

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own_user" on public.profiles;
drop policy if exists "profiles_update_roles_super_admin" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_select_admin_all"
on public.profiles
for select
to authenticated
using (public.is_admin_or_super_admin());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_insert_own_user"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() and role = 'user');

create policy "profiles_update_roles_super_admin"
on public.profiles
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "halls_select_active_authenticated" on public.halls;
drop policy if exists "halls_select_admin_all" on public.halls;
drop policy if exists "halls_insert_admin" on public.halls;
drop policy if exists "halls_update_admin" on public.halls;
drop policy if exists "halls_delete_super_admin" on public.halls;

create policy "halls_select_active_authenticated"
on public.halls
for select
to authenticated
using (is_active = true);

create policy "halls_select_admin_all"
on public.halls
for select
to authenticated
using (public.is_admin_or_super_admin());

create policy "halls_insert_admin"
on public.halls
for insert
to authenticated
with check (public.is_super_admin());

create policy "halls_update_admin"
on public.halls
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "halls_delete_super_admin"
on public.halls
for delete
to authenticated
using (public.is_super_admin());

update public.profiles
set role = 'super_admin'
where lower(email) = 'eswar.2411018@srec.ac.in';

update public.halls
set department = 'Library'
where department = 'Library Management';

update public.halls
set department = 'Library',
    venue_type = 'Seminar Hall',
    location = 'Library'
where name = 'Library Seminar Hall';

update public.halls
set department = 'Others',
    venue_type = 'Auditorium',
    location = 'Main Campus'
where name = 'College Auditorium';

delete from public.halls
where venue_type = 'Conference Room';

update public.halls
set venue_type = 'Seminar Hall'
where venue_type = 'Library Seminar Hall';

update public.halls
set department = 'Others'
where department in ('College', 'Other');

insert into public.halls (name, department, venue_type, location, block, floor, capacity, facilities, is_active)
select venue.name, venue.department, venue.venue_type, venue.location, venue.block, venue.floor, venue.capacity, venue.facilities, true
from (
  values
    ('IT Seminar Hall', 'IT', 'Seminar Hall', 'IT Department Seminar Hall', 'IT Block', null, 120, array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']),
    ('IT Lab', 'IT', 'Lab', 'IT Department Lab', 'IT Block', null, 60, array['Computer System', 'Projector', 'Wi-Fi']),
    ('AI&DS Seminar Hall', 'AI&DS', 'Seminar Hall', 'AI&DS Department Seminar Hall', 'AI&DS Block', null, 120, array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']),
    ('AI&DS Lab', 'AI&DS', 'Lab', 'AI&DS Department Lab', 'AI&DS Block', null, 60, array['Computer System', 'Projector', 'Wi-Fi']),
    ('EEE Seminar Hall', 'EEE', 'Seminar Hall', 'EEE Department Seminar Hall', 'EEE Block', null, 120, array['Projector', 'Microphone', 'Speakers']),
    ('EEE Lab', 'EEE', 'Lab', 'EEE Department Lab', 'EEE Block', null, 60, array['Computer System', 'Projector']),
    ('ECE Seminar Hall', 'ECE', 'Seminar Hall', 'ECE Department Seminar Hall', 'ECE Block', null, 120, array['Projector', 'Microphone', 'Speakers']),
    ('ECE Lab', 'ECE', 'Lab', 'ECE Department Lab', 'ECE Block', null, 60, array['Computer System', 'Projector']),
    ('BME Seminar Hall', 'BME', 'Seminar Hall', 'BME Department Seminar Hall', 'BME Block', null, 100, array['Projector', 'Microphone', 'Speakers']),
    ('BME Lab', 'BME', 'Lab', 'BME Department Lab', 'BME Block', null, 50, array['Computer System', 'Projector']),
    ('CSE Seminar Hall', 'CSE', 'Seminar Hall', 'CSE Department Seminar Hall', 'CSE Block', null, 120, array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']),
    ('CSE Lab', 'CSE', 'Lab', 'CSE Department Lab', 'CSE Block', null, 60, array['Computer System', 'Projector', 'Wi-Fi']),
    ('CIVIL Seminar Hall', 'CIVIL', 'Seminar Hall', 'CIVIL Department Seminar Hall', 'CIVIL Block', null, 100, array['Projector', 'Microphone', 'Speakers']),
    ('CIVIL Lab', 'CIVIL', 'Lab', 'CIVIL Department Lab', 'CIVIL Block', null, 50, array['Computer System', 'Projector']),
    ('AERO Seminar Hall', 'AERO', 'Seminar Hall', 'AERO Department Seminar Hall', 'AERO Block', null, 100, array['Projector', 'Microphone', 'Speakers']),
    ('AERO Lab', 'AERO', 'Lab', 'AERO Department Lab', 'AERO Block', null, 50, array['Computer System', 'Projector']),
    ('MBA Seminar Hall', 'MBA', 'Seminar Hall', 'MBA Department Seminar Hall', 'MBA Block', null, 120, array['Projector', 'Microphone', 'Speakers', 'AC']),
    ('MBA Lab', 'MBA', 'Lab', 'MBA Department Lab', 'MBA Block', null, 50, array['Computer System', 'Projector', 'Wi-Fi']),
    ('NANO Seminar Hall', 'NANO', 'Seminar Hall', 'NANO Department Seminar Hall', 'NANO Block', null, 80, array['Projector', 'Microphone', 'Speakers']),
    ('NANO Lab', 'NANO', 'Lab', 'NANO Department Lab', 'NANO Block', null, 40, array['Computer System', 'Projector']),
    ('MECH Seminar Hall', 'MECH', 'Seminar Hall', 'MECH Department Seminar Hall', 'MECH Block', null, 120, array['Projector', 'Microphone', 'Speakers']),
    ('MECH Lab', 'MECH', 'Lab', 'MECH Department Lab', 'MECH Block', null, 60, array['Computer System', 'Projector']),
    ('EIE Seminar Hall', 'EIE', 'Seminar Hall', 'EIE Department Seminar Hall', 'EIE Block', null, 100, array['Projector', 'Microphone', 'Speakers']),
    ('EIE Lab', 'EIE', 'Lab', 'EIE Department Lab', 'EIE Block', null, 50, array['Computer System', 'Projector']),
    ('Library Seminar Hall', 'Library', 'Seminar Hall', 'Library', 'Library Block', null, 100, array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']),
    ('College Auditorium', 'Others', 'Auditorium', 'Main Campus', 'Main Campus', null, 500, array['Projector', 'Microphone', 'Speakers', 'AC', 'Stage'])
) as venue(name, department, venue_type, location, block, floor, capacity, facilities)
where not exists (
  select 1
  from public.halls existing
  where lower(existing.name) = lower(venue.name)
);

drop policy if exists "bookings_insert_own" on public.bookings;
drop policy if exists "bookings_select_own" on public.bookings;
drop policy if exists "bookings_select_admin_all" on public.bookings;
drop policy if exists "bookings_cancel_own_pending" on public.bookings;
drop policy if exists "bookings_review_admin" on public.bookings;

create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and admin_remarks is null
  and approved_by is null
);

create policy "bookings_select_own"
on public.bookings
for select
to authenticated
using (user_id = auth.uid());

create policy "bookings_select_admin_all"
on public.bookings
for select
to authenticated
using (public.is_admin_or_super_admin());

create policy "bookings_cancel_own_pending"
on public.bookings
for update
to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'cancelled');

create policy "bookings_review_admin"
on public.bookings
for update
to authenticated
using (public.is_admin_or_super_admin())
with check (public.is_admin_or_super_admin());

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_read_own" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_insert_admin" on public.notifications;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "notifications_update_read_own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_insert_own"
on public.notifications
for insert
to authenticated
with check (user_id = auth.uid());

create policy "notifications_insert_admin"
on public.notifications
for insert
to authenticated
with check (public.is_admin_or_super_admin());

drop policy if exists "push_tokens_manage_own" on public.push_tokens;
drop policy if exists "push_tokens_select_admin" on public.push_tokens;

create policy "push_tokens_manage_own"
on public.push_tokens
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_tokens_select_admin"
on public.push_tokens
for select
to authenticated
using (public.is_admin_or_super_admin());

insert into storage.buckets (id, name, public)
values ('hall-images', 'hall-images', true)
on conflict (id) do update set public = true;

drop policy if exists "hall_images_read_authenticated" on storage.objects;
drop policy if exists "hall_images_insert_admin" on storage.objects;
drop policy if exists "hall_images_update_admin" on storage.objects;
drop policy if exists "hall_images_delete_admin" on storage.objects;

create policy "hall_images_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'hall-images');

create policy "hall_images_insert_admin"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'hall-images' and public.is_super_admin());

create policy "hall_images_update_admin"
on storage.objects
for update
to authenticated
using (bucket_id = 'hall-images' and public.is_super_admin())
with check (bucket_id = 'hall-images' and public.is_super_admin());

create policy "hall_images_delete_admin"
on storage.objects
for delete
to authenticated
using (bucket_id = 'hall-images' and public.is_super_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
