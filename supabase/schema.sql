create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  department text,
  role text not null default 'user',
  register_number text,
  phone text,
  auth_provider text,
  is_staff_verified boolean not null default false,
  onboarding_completed boolean not null default false,
  updated_at timestamptz default now(),
  created_at timestamp with time zone default now(),
  constraint profiles_role_check check (role in ('user', 'admin'))
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
  inactive_reason text,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id),
  reactivated_at timestamptz,
  reactivated_by uuid references public.profiles(id),
  created_at timestamp with time zone default now(),
  constraint halls_capacity_check check (capacity > 0)
);

alter table public.halls
add column if not exists department text,
add column if not exists venue_type text,
add column if not exists location text,
add column if not exists inactive_reason text,
add column if not exists deactivated_at timestamptz,
add column if not exists deactivated_by uuid references public.profiles(id),
add column if not exists reactivated_at timestamptz,
add column if not exists reactivated_by uuid references public.profiles(id);

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
  device_id text,
  platform text,
  device_name text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, expo_push_token)
);

alter table public.bookings
drop constraint if exists bookings_valid_time_range;

alter table public.bookings
add constraint bookings_valid_time_range
check (start_time < end_time);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_no_active_overlap'
  ) then
    alter table public.bookings
    add constraint bookings_no_active_overlap
    exclude using gist (
      hall_id with =,
      tstzrange(start_time, end_time, '[)') with &&
    )
    where (status in ('pending', 'approved'));
  end if;
end $$;

create table if not exists public.device_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id text not null,
  fcm_token text not null,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  device_id text,
  app_variant text not null default 'production',
  application_id text,
  app_version text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_registered_at timestamptz not null default now(),
  unique (user_id, installation_id),
  unique (fcm_token)
);

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

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null unique,
  window_start timestamptz not null default now(),
  request_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_approvers (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_receipts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  receipt_no text not null unique,
  verification_token text not null unique,
  status text not null check (status in ('approved', 'rejected')),
  pdf_path text not null,
  qr_payload text not null,
  emailed_to text,
  emailed_at timestamptz,
  email_status text default 'pending',
  email_error text,
  email_attempts integer not null default 0,
  last_email_attempt_at timestamptz,
  receipt_email_notification_sent_at timestamptz,
  receipt_push_notification_sent_at timestamptz,
  receipt_notification_error text,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_email_jobs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid references public.booking_receipts(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  run_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications
add column if not exists booking_id uuid references public.bookings(id) on delete set null;

alter table public.push_tokens
add column if not exists device_id text;

alter table public.push_tokens
add column if not exists is_active boolean not null default true;

alter table public.booking_receipts
add column if not exists receipt_email_notification_sent_at timestamptz;

alter table public.booking_receipts
add column if not exists receipt_push_notification_sent_at timestamptz;

alter table public.booking_receipts
add column if not exists receipt_notification_error text;

alter table public.bookings
add column if not exists additional_requirements text;

create index if not exists bookings_hall_id_idx on public.bookings(hall_id);
create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_start_time_idx on public.bookings(start_time);
create index if not exists bookings_end_time_idx on public.bookings(end_time);
create index if not exists bookings_hall_status_time_idx on public.bookings(hall_id, status, start_time, end_time);
create index if not exists bookings_user_created_at_idx on public.bookings(user_id, created_at desc);
create index if not exists bookings_status_created_at_idx on public.bookings(status, created_at desc);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_user_read_idx on public.notifications(user_id, is_read);
create index if not exists notifications_user_created_at_idx on public.notifications(user_id, created_at desc);
create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);
create index if not exists device_fcm_tokens_active_user_idx
on public.device_fcm_tokens(user_id)
where is_active = true;
create index if not exists device_fcm_tokens_installation_idx on public.device_fcm_tokens(installation_id);
create index if not exists device_fcm_tokens_application_id_idx on public.device_fcm_tokens(application_id);
create index if not exists push_delivery_attempts_notification_idx on public.push_delivery_attempts(notification_id);
create index if not exists halls_department_idx on public.halls(department);
create index if not exists halls_venue_type_idx on public.halls(venue_type);
create index if not exists halls_department_active_idx on public.halls(department, is_active);
create index if not exists halls_department_venue_type_active_idx on public.halls(department, venue_type, is_active);
create index if not exists profiles_lower_email_idx on public.profiles(lower(email));
create index if not exists profiles_department_idx on public.profiles(department);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_department_role_idx on public.profiles(department, role);
create unique index if not exists rate_limits_rate_key_idx on public.rate_limits(rate_key);
create index if not exists rate_limits_window_start_idx on public.rate_limits(window_start);
create index if not exists department_approvers_department_idx on public.department_approvers(department);
create index if not exists department_approvers_user_id_idx on public.department_approvers(user_id);
create unique index if not exists department_approvers_one_active_per_department
on public.department_approvers(department)
where is_active = true;
create index if not exists booking_receipts_booking_id_idx on public.booking_receipts(booking_id);
create index if not exists booking_receipts_receipt_no_idx on public.booking_receipts(receipt_no);
create index if not exists booking_receipts_verification_token_idx on public.booking_receipts(verification_token);
create index if not exists receipt_email_jobs_status_idx on public.receipt_email_jobs(status);
create index if not exists receipt_email_jobs_run_after_idx on public.receipt_email_jobs(run_after);
create index if not exists receipt_email_jobs_booking_id_idx on public.receipt_email_jobs(booking_id);
create index if not exists receipt_email_jobs_status_run_after_idx on public.receipt_email_jobs(status, run_after);
create unique index if not exists receipt_email_jobs_unique_receipt_pending_sent_idx
on public.receipt_email_jobs(receipt_id)
where status in ('pending', 'processing', 'sent');

create or replace function public.check_booking_overlap(
  selected_hall_id uuid,
  new_start_time timestamp with time zone,
  new_end_time timestamp with time zone
)
returns boolean
language sql
stable
set search_path = public
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
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings existing
    where existing.hall_id = selected_hall_id
      and existing.status in ('pending', 'approved')
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

drop trigger if exists set_department_approvers_updated_at on public.department_approvers;

create trigger set_department_approvers_updated_at
before update on public.department_approvers
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
  if new.status in ('pending', 'approved') then
    if exists (
      select 1
      from public.bookings existing
      where existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and existing.hall_id = new.hall_id
        and existing.status in ('pending', 'approved')
        and existing.start_time < new.end_time
        and existing.end_time > new.start_time
    ) then
      raise exception 'This venue is already booked or awaiting approval for the selected time.';
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
alter table public.device_fcm_tokens enable row level security;
alter table public.push_delivery_attempts enable row level security;
alter table public.rate_limits enable row level security;
alter table public.department_approvers enable row level security;
alter table public.booking_receipts enable row level security;
alter table public.receipt_email_jobs enable row level security;

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

create or replace function public.current_user_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_department_approver(target_department text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.department_approvers da
    where da.user_id = auth.uid()
      and da.department = target_department
      and da.is_active = true
  );
$$;

create or replace function public.can_review_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.bookings b
      join public.halls h on h.id = b.hall_id
      join public.department_approvers da on da.department = h.department
      where b.id = target_booking_id
        and da.user_id = auth.uid()
        and da.is_active = true
    );
$$;

create or replace function public.get_department_pending_requests()
returns table (
  id uuid,
  user_id uuid,
  event_title text,
  event_type text,
  requester_department text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  created_at timestamptz,
  hall_id uuid,
  hall_name text,
  hall_department text,
  hall_venue_type text,
  hall_location text,
  requester_name text,
  requester_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.user_id,
    b.event_title,
    b.event_type,
    b.department as requester_department,
    b.start_time,
    b.end_time,
    b.status::text,
    b.created_at,
    h.id as hall_id,
    h.name as hall_name,
    h.department as hall_department,
    h.venue_type as hall_venue_type,
    h.location as hall_location,
    p.full_name as requester_name,
    p.email as requester_email
  from public.bookings b
  join public.halls h on h.id = b.hall_id
  left join public.profiles p on p.id = b.user_id
  where b.status = 'pending'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.department_approvers da
        where da.user_id = auth.uid()
          and da.department = h.department
          and da.is_active = true
      )
    )
  order by b.created_at desc;
$$;

create or replace function public.get_my_department_bookings()
returns table (
  id uuid,
  user_id uuid,
  requester_name text,
  requester_department text,
  event_title text,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz,
  hall_name text,
  hall_department text,
  hall_venue_type text,
  hall_location text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.user_id,
    requester.full_name as requester_name,
    requester.department as requester_department,
    b.event_title,
    b.status::text,
    b.start_time,
    b.end_time,
    b.created_at,
    h.name as hall_name,
    h.department as hall_department,
    h.venue_type as hall_venue_type,
    h.location as hall_location
  from public.bookings b
  join public.profiles requester on requester.id = b.user_id
  join public.profiles me on me.id = auth.uid()
  left join public.halls h on h.id = b.hall_id
  where requester.department is not null
    and requester.department = me.department
  order by b.created_at desc;
$$;

create or replace function public.get_visible_booking_details(target_booking uuid)
returns table (
  id uuid,
  hall_id uuid,
  user_id uuid,
  requester_name text,
  requester_email text,
  requester_department text,
  event_title text,
  event_type text,
  department text,
  faculty_coordinator text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  admin_remarks text,
  created_at timestamptz,
  updated_at timestamptz,
  hall_name text,
  hall_department text,
  hall_block text,
  hall_floor text,
  hall_capacity integer,
  hall_facilities text[],
  hall_image_url text,
  approver_name text,
  approver_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.hall_id,
    b.user_id,
    requester.full_name as requester_name,
    requester.email as requester_email,
    requester.department as requester_department,
    b.event_title,
    b.event_type,
    b.department,
    b.faculty_coordinator,
    b.start_time,
    b.end_time,
    b.status::text,
    b.admin_remarks,
    b.created_at,
    b.updated_at,
    h.name as hall_name,
    h.department as hall_department,
    h.block as hall_block,
    h.floor as hall_floor,
    h.capacity as hall_capacity,
    h.facilities as hall_facilities,
    h.image_url as hall_image_url,
    approver.full_name as approver_name,
    approver.email as approver_email
  from public.bookings b
  left join public.halls h on h.id = b.hall_id
  left join public.profiles requester on requester.id = b.user_id
  left join public.profiles approver on approver.id = b.approved_by
  left join public.profiles me on me.id = auth.uid()
  where b.id = target_booking
    and (
      b.user_id = auth.uid()
      or public.is_admin()
      or public.can_review_booking(b.id)
      or (
        requester.department is not null
        and requester.department = me.department
      )
    );
$$;

create or replace function public.notify_department_approver(booking_to_notify uuid)
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
    h.name as hall_name,
    h.department as hall_department,
    p.full_name as requester_name
  into booking_record
  from public.bookings b
  join public.halls h on h.id = b.hall_id
  left join public.profiles p on p.id = b.user_id
  where b.id = booking_to_notify;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if booking_record.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed to notify department approver for this booking.';
  end if;

  return query
  with recipients as (
    select da.user_id
    from public.department_approvers da
    where da.department = booking_record.hall_department
      and da.is_active = true
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
      recipients.user_id,
      'New booking request',
      coalesce(booking_record.requester_name, 'A user') || ' requested ' || coalesce(booking_record.hall_name, 'a venue') || ' for ' || booking_record.event_title,
      booking_record.id,
      false
    from recipients
    returning notifications.user_id
  )
  select inserted.user_id from inserted;
end;
$$;

create or replace function public.approve_booking(
  target_booking_id uuid,
  approval_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record record;
begin
  if not public.can_review_booking(target_booking_id) then
    raise exception 'You are not allowed to approve this booking.';
  end if;

  select b.*, h.name as hall_name
  into booking_record
  from public.bookings b
  left join public.halls h on h.id = b.hall_id
  where b.id = target_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if booking_record.status <> 'pending' then
    raise exception 'Only pending bookings can be approved.';
  end if;

  if public.check_approved_booking_overlap(
    booking_record.hall_id,
    booking_record.id,
    booking_record.start_time,
    booking_record.end_time
  ) then
    raise exception 'This venue already has an approved booking for the selected time.';
  end if;

  update public.bookings
  set status = 'approved',
      approved_by = auth.uid(),
      admin_remarks = nullif(btrim(coalesce(approval_remarks, '')), '')
  where id = target_booking_id;

  insert into public.notifications (user_id, title, message, booking_id, is_read)
  values (
    booking_record.user_id,
    'Booking approved',
    'Your booking request "' || booking_record.event_title || '" has been approved.',
    booking_record.id,
    false
  );

  return jsonb_build_object('ok', true, 'booking_id', target_booking_id, 'status', 'approved');
end;
$$;

create or replace function public.reject_booking(
  target_booking_id uuid,
  rejection_remarks text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record record;
  remarks text := nullif(btrim(coalesce(rejection_remarks, '')), '');
begin
  if remarks is null then
    raise exception 'Remarks are required to reject a booking.';
  end if;

  if not public.can_review_booking(target_booking_id) then
    raise exception 'You are not allowed to reject this booking.';
  end if;

  select *
  into booking_record
  from public.bookings
  where id = target_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if booking_record.status <> 'pending' then
    raise exception 'Only pending bookings can be rejected.';
  end if;

  update public.bookings
  set status = 'rejected',
      approved_by = auth.uid(),
      admin_remarks = remarks
  where id = target_booking_id;

  insert into public.notifications (user_id, title, message, booking_id, is_read)
  values (
    booking_record.user_id,
    'Booking rejected',
    'Your booking request "' || booking_record.event_title || '" was rejected. ' || remarks,
    booking_record.id,
    false
  );

  return jsonb_build_object('ok', true, 'booking_id', target_booking_id, 'status', 'rejected');
end;
$$;

grant execute on function public.is_department_approver(text) to authenticated;
grant execute on function public.can_review_booking(uuid) to authenticated;
grant execute on function public.get_department_pending_requests() to authenticated;
grant execute on function public.get_my_department_bookings() to authenticated;
grant execute on function public.get_visible_booking_details(uuid) to authenticated;
grant execute on function public.notify_department_approver(uuid) to authenticated;
grant execute on function public.approve_booking(uuid, text) to authenticated;
grant execute on function public.reject_booking(uuid, text) to authenticated;

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

  if booking_record.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed to notify admins for this booking.';
  end if;

  return query
  with recipients as (
    select id
    from public.profiles
    where role = 'admin'
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
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'User role changes must use the admin role management function.';
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
      when lower(new.email) = 'eswar.2411018@srec.ac.in' then 'admin'
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
  if public.can_review_booking(old.id) then
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
      raise exception 'Reviewers can only update booking status, admin remarks, and approval metadata.';
    end if;

    if new.status not in ('approved', 'rejected', old.status) then
      raise exception 'Reviewers can only approve or reject bookings.';
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

create or replace function public.prevent_user_hall_department_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.department is distinct from public.current_user_department()
    or new.department is distinct from old.department then
    raise exception 'Users cannot change venue department.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_user_hall_department_change on public.halls;

create trigger prevent_user_hall_department_change
before update on public.halls
for each row
execute function public.prevent_user_hall_department_change();

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own_user" on public.profiles;
drop policy if exists "profiles_update_roles_admin" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_select_admin_all"
on public.profiles
for select
to authenticated
using (public.is_admin());

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

create policy "profiles_update_roles_admin"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "halls_select_active_authenticated" on public.halls;
drop policy if exists "halls_select_admin_all" on public.halls;
drop policy if exists "halls_select_department_management" on public.halls;
drop policy if exists "halls_insert_admin" on public.halls;
drop policy if exists "halls_insert_department" on public.halls;
drop policy if exists "halls_update_admin" on public.halls;
drop policy if exists "halls_update_department" on public.halls;
drop policy if exists "halls_delete_admin" on public.halls;

create policy "halls_select_active_authenticated"
on public.halls
for select
to authenticated
using (is_active = true);

create policy "halls_select_admin_all"
on public.halls
for select
to authenticated
using (public.is_admin());

create policy "halls_select_department_management"
on public.halls
for select
to authenticated
using (department = public.current_user_department());

create policy "halls_insert_admin"
on public.halls
for insert
to authenticated
with check (public.is_admin());

create policy "halls_insert_department"
on public.halls
for insert
to authenticated
with check (
  department = public.current_user_department()
);

create policy "halls_update_admin"
on public.halls
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "halls_update_department"
on public.halls
for update
to authenticated
using (department = public.current_user_department())
with check (department = public.current_user_department());

create policy "halls_delete_admin"
on public.halls
for delete
to authenticated
using (public.is_admin());

update public.profiles
set role = 'admin'
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
    ('IT Seminar Hall', 'IT', 'Seminar Hall', 'IT Department Seminar Hall', 'IT Block', null, 120, array[]::text[]),
    ('IT Lab', 'IT', 'BYOD Lab', 'IT Department Lab', 'IT Block', null, 60, array[]::text[]),
    ('AI&DS Seminar Hall', 'AI&DS', 'Seminar Hall', 'AI&DS Department Seminar Hall', 'AI&DS Block', null, 120, array[]::text[]),
    ('AI&DS Lab', 'AI&DS', 'BYOD Lab', 'AI&DS Department Lab', 'AI&DS Block', null, 60, array[]::text[]),
    ('EEE Seminar Hall', 'EEE', 'Seminar Hall', 'EEE Department Seminar Hall', 'EEE Block', null, 120, array[]::text[]),
    ('EEE Lab', 'EEE', 'BYOD Lab', 'EEE Department Lab', 'EEE Block', null, 60, array[]::text[]),
    ('ECE Seminar Hall', 'ECE', 'Seminar Hall', 'ECE Department Seminar Hall', 'ECE Block', null, 120, array[]::text[]),
    ('ECE Lab', 'ECE', 'BYOD Lab', 'ECE Department Lab', 'ECE Block', null, 60, array[]::text[]),
    ('BME Seminar Hall', 'BME', 'Seminar Hall', 'BME Department Seminar Hall', 'BME Block', null, 100, array[]::text[]),
    ('BME Lab', 'BME', 'BYOD Lab', 'BME Department Lab', 'BME Block', null, 50, array[]::text[]),
    ('CSE Seminar Hall', 'CSE', 'Seminar Hall', 'CSE Department Seminar Hall', 'CSE Block', null, 120, array[]::text[]),
    ('CSE Lab', 'CSE', 'BYOD Lab', 'CSE Department Lab', 'CSE Block', null, 60, array[]::text[]),
    ('CIVIL Seminar Hall', 'CIVIL', 'Seminar Hall', 'CIVIL Department Seminar Hall', 'CIVIL Block', null, 100, array[]::text[]),
    ('CIVIL Lab', 'CIVIL', 'BYOD Lab', 'CIVIL Department Lab', 'CIVIL Block', null, 50, array[]::text[]),
    ('AERO Seminar Hall', 'AERO', 'Seminar Hall', 'AERO Department Seminar Hall', 'AERO Block', null, 100, array[]::text[]),
    ('AERO Lab', 'AERO', 'BYOD Lab', 'AERO Department Lab', 'AERO Block', null, 50, array[]::text[]),
    ('MBA Seminar Hall', 'MBA', 'Seminar Hall', 'MBA Department Seminar Hall', 'MBA Block', null, 120, array[]::text[]),
    ('MBA Lab', 'MBA', 'BYOD Lab', 'MBA Department Lab', 'MBA Block', null, 50, array[]::text[]),
    ('NANO Seminar Hall', 'NANO', 'Seminar Hall', 'NANO Department Seminar Hall', 'NANO Block', null, 80, array[]::text[]),
    ('NANO Lab', 'NANO', 'BYOD Lab', 'NANO Department Lab', 'NANO Block', null, 40, array[]::text[]),
    ('MECH Seminar Hall', 'MECH', 'Seminar Hall', 'MECH Department Seminar Hall', 'MECH Block', null, 120, array[]::text[]),
    ('MECH Lab', 'MECH', 'BYOD Lab', 'MECH Department Lab', 'MECH Block', null, 60, array[]::text[]),
    ('EIE Seminar Hall', 'EIE', 'Seminar Hall', 'EIE Department Seminar Hall', 'EIE Block', null, 100, array[]::text[]),
    ('EIE Lab', 'EIE', 'BYOD Lab', 'EIE Department Lab', 'EIE Block', null, 50, array[]::text[]),
    ('Library Seminar Hall', 'Library', 'Seminar Hall', 'Library', 'Library Block', null, 100, array[]::text[]),
    ('College Auditorium', 'Others', 'Auditorium', 'Main Campus', 'Main Campus', null, 500, array[]::text[])
) as venue(name, department, venue_type, location, block, floor, capacity, facilities)
where not exists (
  select 1
  from public.halls existing
  where lower(existing.name) = lower(venue.name)
);

drop policy if exists "bookings_insert_own" on public.bookings;
drop policy if exists "bookings_select_own" on public.bookings;
drop policy if exists "bookings_select_admin_all" on public.bookings;
drop policy if exists "bookings_select_department_approver" on public.bookings;
drop policy if exists "bookings_cancel_own_pending" on public.bookings;
drop policy if exists "bookings_review_admin" on public.bookings;
drop policy if exists "bookings_review_department_approver" on public.bookings;

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
using (public.is_admin());

create policy "bookings_select_department_approver"
on public.bookings
for select
to authenticated
using (public.can_review_booking(id));

create or replace function public.can_view_requester_department_booking(target_booking uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    join public.profiles requester on requester.id = b.user_id
    join public.profiles me on me.id = auth.uid()
    where b.id = target_booking
      and requester.department is not null
      and requester.department = me.department
  );
$$;

grant execute on function public.can_view_requester_department_booking(uuid) to authenticated;

drop policy if exists "bookings_select_requester_department" on public.bookings;

create policy "bookings_select_requester_department"
on public.bookings
for select
to authenticated
using (public.can_view_requester_department_booking(id));

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
using (public.is_admin())
with check (public.is_admin());

create policy "bookings_review_department_approver"
on public.bookings
for update
to authenticated
using (public.can_review_booking(id))
with check (public.can_review_booking(id));

drop policy if exists "department_approvers_select_own" on public.department_approvers;
drop policy if exists "department_approvers_select_admin" on public.department_approvers;
drop policy if exists "department_approvers_insert_admin" on public.department_approvers;
drop policy if exists "department_approvers_update_admin" on public.department_approvers;
drop policy if exists "department_approvers_delete_admin" on public.department_approvers;

create policy "department_approvers_select_own"
on public.department_approvers
for select
to authenticated
using (user_id = auth.uid());

create policy "department_approvers_select_admin"
on public.department_approvers
for select
to authenticated
using (public.is_admin());

create policy "department_approvers_insert_admin"
on public.department_approvers
for insert
to authenticated
with check (public.is_admin());

create policy "department_approvers_update_admin"
on public.department_approvers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "department_approvers_delete_admin"
on public.department_approvers
for delete
to authenticated
using (public.is_admin());

drop policy if exists "booking_receipts_select_admin" on public.booking_receipts;
drop policy if exists "booking_receipts_select_requester" on public.booking_receipts;
drop policy if exists "booking_receipts_select_department_approver" on public.booking_receipts;

create policy "booking_receipts_select_admin"
on public.booking_receipts
for select
to authenticated
using (public.is_admin());

create policy "booking_receipts_select_requester"
on public.booking_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_receipts.booking_id
      and b.user_id = auth.uid()
  )
);

create policy "booking_receipts_select_department_approver"
on public.booking_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.halls h on h.id = b.hall_id
    join public.department_approvers da on da.department = h.department
    where b.id = booking_receipts.booking_id
      and da.user_id = auth.uid()
      and da.is_active = true
  )
);

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
with check (public.is_admin());

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
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('hall-images', 'hall-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('email-assets', 'email-assets', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('booking-receipts', 'booking-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "email_assets_public_read" on storage.objects;
drop policy if exists "Public read email assets" on storage.objects;
drop policy if exists "hall_images_read_authenticated" on storage.objects;
drop policy if exists "hall_images_insert_admin" on storage.objects;
drop policy if exists "hall_images_update_admin" on storage.objects;
drop policy if exists "hall_images_delete_admin" on storage.objects;
drop policy if exists "booking_receipts_read_admin" on storage.objects;
drop policy if exists "booking_receipts_read_requester" on storage.objects;
drop policy if exists "booking_receipts_read_department_approver" on storage.objects;

create policy "Public read email assets"
on storage.objects
for select
using (bucket_id = 'email-assets');

create policy "hall_images_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'hall-images');

create policy "hall_images_insert_admin"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'hall-images' and public.is_admin());

create policy "hall_images_update_admin"
on storage.objects
for update
to authenticated
using (bucket_id = 'hall-images' and public.is_admin())
with check (bucket_id = 'hall-images' and public.is_admin());

create policy "hall_images_delete_admin"
on storage.objects
for delete
to authenticated
using (bucket_id = 'hall-images' and public.is_admin());

create policy "booking_receipts_read_admin"
on storage.objects
for select
to authenticated
using (bucket_id = 'booking-receipts' and public.is_admin());

create policy "booking_receipts_read_requester"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'booking-receipts'
  and exists (
    select 1
    from public.booking_receipts br
    join public.bookings b on b.id = br.booking_id
    where br.pdf_path = storage.objects.name
      and b.user_id = auth.uid()
  )
);

create policy "booking_receipts_read_department_approver"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'booking-receipts'
  and exists (
    select 1
    from public.booking_receipts br
    join public.bookings b on b.id = br.booking_id
    join public.halls h on h.id = b.hall_id
    join public.department_approvers da on da.department = h.department
    where br.pdf_path = storage.objects.name
      and da.user_id = auth.uid()
      and da.is_active = true
  )
);

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

-- Final super-admin role model overrides. Keep this block last so schema resets
-- preserve global management for super_admin while normal approvals stay
-- department-admin-only.
alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('user', 'admin', 'super_admin'));

alter table public.profiles
drop constraint if exists profiles_super_admin_email_check;

alter table public.profiles
add constraint profiles_super_admin_email_check
check (
  role <> 'super_admin'
  or lower(email) = 'venueverse.srec@gmail.com'
);

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(nullif(current_setting('request.jwt.claim.email', true), ''));
$$;

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
    where (
      id = auth.uid()
      or lower(email) = public.current_user_email()
    )
      and role = 'super_admin'
      and lower(email) = 'venueverse.srec@gmail.com'
  );
$$;

create or replace function public.is_department_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where (
      id = auth.uid()
      or lower(email) = public.current_user_email()
    )
      and role = 'admin'
      and department is not null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_department_admin();
$$;

create or replace function public.can_admin_manage_department(target_department text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.profiles
      where (
        id = auth.uid()
        or lower(email) = public.current_user_email()
      )
        and role = 'admin'
        and department is not null
        and department = target_department
    );
$$;

create or replace function public.can_review_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.is_admin()
    or exists (
      select 1
      from public.bookings b
      join public.halls h on h.id = b.hall_id
      join public.department_approvers da on da.department = h.department
      where b.id = target_booking_id
        and da.user_id = auth.uid()
        and da.is_active = true
    )
    or exists (
      select 1
      from public.bookings b
      join public.halls h on h.id = b.hall_id
      join public.profiles p on lower(p.email) = public.current_user_email()
      where b.id = target_booking_id
        and p.role = 'admin'
        and p.department = h.department
    );
$$;

create or replace function public.can_view_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.can_review_booking(target_booking_id)
    or exists (
      select 1
      from public.bookings b
      where b.id = target_booking_id
        and b.user_id = auth.uid()
    )
    or public.can_view_requester_department_booking(target_booking_id);
$$;

drop policy if exists "profiles_select_admin_all" on public.profiles;
drop policy if exists "profiles_update_roles_admin" on public.profiles;
drop policy if exists "profiles_select_department_admin" on public.profiles;
drop policy if exists "profiles_update_department_admin" on public.profiles;

create policy "profiles_select_department_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
  or public.can_admin_manage_department(department)
);

create policy "profiles_update_department_admin"
on public.profiles
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.can_admin_manage_department(department)
    and role <> 'super_admin'
  )
)
with check (
  (
    public.is_super_admin()
    and (
      role <> 'super_admin'
      or lower(email) = 'venueverse.srec@gmail.com'
    )
  )
  or (
    public.can_admin_manage_department(department)
    and role in ('user', 'admin')
  )
);

drop policy if exists "halls_select_admin_all" on public.halls;
drop policy if exists "halls_insert_admin" on public.halls;
drop policy if exists "halls_update_admin" on public.halls;
drop policy if exists "halls_delete_admin" on public.halls;
drop policy if exists "halls_select_department_admin" on public.halls;
drop policy if exists "halls_insert_department_admin" on public.halls;
drop policy if exists "halls_update_department_admin" on public.halls;
drop policy if exists "halls_delete_department_admin" on public.halls;

create policy "halls_select_department_admin"
on public.halls
for select
to authenticated
using (
  is_active = true
  or public.is_super_admin()
  or public.can_admin_manage_department(department)
);

create policy "halls_insert_department_admin"
on public.halls
for insert
to authenticated
with check (public.can_admin_manage_department(department));

create policy "halls_update_department_admin"
on public.halls
for update
to authenticated
using (public.can_admin_manage_department(department))
with check (public.can_admin_manage_department(department));

create policy "halls_delete_department_admin"
on public.halls
for delete
to authenticated
using (public.can_admin_manage_department(department));

drop policy if exists "bookings_select_admin_all" on public.bookings;
drop policy if exists "bookings_select_department_approver" on public.bookings;
drop policy if exists "bookings_select_department_admin" on public.bookings;
drop policy if exists "bookings_review_admin" on public.bookings;
drop policy if exists "bookings_review_department_approver" on public.bookings;
drop policy if exists "bookings_review_department_admin" on public.bookings;

create policy "bookings_select_department_admin"
on public.bookings
for select
to authenticated
using (public.can_view_booking(id));

create policy "bookings_review_department_admin"
on public.bookings
for update
to authenticated
using (public.can_review_booking(id))
with check (public.can_review_booking(id));

drop policy if exists "booking_receipts_select_admin" on public.booking_receipts;

create policy "booking_receipts_select_admin"
on public.booking_receipts
for select
to authenticated
using (public.is_super_admin() or public.is_admin());

drop policy if exists "booking_receipts_read_admin" on storage.objects;

create policy "booking_receipts_read_admin"
on storage.objects
for select
to authenticated
using (bucket_id = 'booking-receipts' and (public.is_super_admin() or public.is_admin()));

create or replace function public.get_department_pending_requests()
returns table (
  id uuid,
  user_id uuid,
  event_title text,
  event_type text,
  requester_department text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  created_at timestamptz,
  hall_id uuid,
  hall_name text,
  hall_department text,
  hall_venue_type text,
  hall_location text,
  requester_name text,
  requester_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.user_id,
    b.event_title,
    b.event_type,
    b.department as requester_department,
    b.start_time,
    b.end_time,
    b.status::text,
    b.created_at,
    h.id as hall_id,
    h.name as hall_name,
    h.department as hall_department,
    h.venue_type as hall_venue_type,
    h.location as hall_location,
    p.full_name as requester_name,
    p.email as requester_email
  from public.bookings b
  join public.halls h on h.id = b.hall_id
  join public.profiles admin_profile on admin_profile.id = auth.uid()
  left join public.profiles p on p.id = b.user_id
  where b.status = 'pending'
    and admin_profile.role = 'admin'
    and admin_profile.department = h.department
  order by b.created_at desc;
$$;

create or replace function public.get_global_admin_bookings(target_status text default null)
returns table (
  id uuid,
  user_id uuid,
  event_title text,
  event_type text,
  requester_department text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  hall_id uuid,
  hall_name text,
  hall_department text,
  hall_venue_type text,
  hall_location text,
  requester_name text,
  requester_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.user_id,
    b.event_title,
    b.event_type,
    b.department as requester_department,
    b.start_time,
    b.end_time,
    b.status::text,
    b.created_at,
    b.updated_at,
    h.id as hall_id,
    h.name as hall_name,
    h.department as hall_department,
    h.venue_type as hall_venue_type,
    h.location as hall_location,
    p.full_name as requester_name,
    p.email as requester_email
  from public.bookings b
  left join public.halls h on h.id = b.hall_id
  left join public.profiles p on p.id = b.user_id
  where public.is_super_admin()
    and (target_status is null or b.status = target_status)
  order by b.created_at desc;
$$;

grant execute on function public.get_global_admin_bookings(text) to authenticated;

create or replace function public.get_hall_booked_slots_for_range(
  p_hall_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  booking_id uuid,
  hall_id uuid,
  hall_name text,
  event_title text,
  requester_name text,
  requester_department text,
  status text,
  start_time timestamptz,
  end_time timestamptz
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
    b.event_title,
    requester.full_name as requester_name,
    requester.department as requester_department,
    b.status::text,
    b.start_time,
    b.end_time
  from public.bookings b
  join public.halls h on h.id = b.hall_id
  left join public.profiles requester on requester.id = b.user_id
  where b.hall_id = p_hall_id
    and b.status in ('pending', 'approved')
    and b.start_time < p_end
    and b.end_time > p_start
  order by b.start_time asc, b.created_at asc;
$$;

grant execute on function public.get_hall_booked_slots_for_range(uuid, timestamptz, timestamptz) to authenticated;

-- Security linter hardening: keep public buckets public for URL access, but
-- remove broad object listing policies and anonymous RPC execution.

alter function public.check_booking_overlap(uuid, timestamptz, timestamptz)
  set search_path = public, pg_temp;

alter function public.check_approved_booking_overlap(uuid, uuid, timestamptz, timestamptz)
  set search_path = public, pg_temp;

alter function public.set_booking_updated_at()
  set search_path = public, pg_temp;

drop policy if exists "Public read email assets" on storage.objects;
drop policy if exists "hall_images_read_authenticated" on storage.objects;

revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

grant execute on function public.check_booking_overlap(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.check_approved_booking_overlap(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_today_booked_halls(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_department_pending_requests() to authenticated;
grant execute on function public.get_my_department_bookings() to authenticated;
grant execute on function public.get_visible_booking_details(uuid) to authenticated;
grant execute on function public.notify_department_approver(uuid) to authenticated;
grant execute on function public.approve_booking(uuid, text) to authenticated;
grant execute on function public.reject_booking(uuid, text) to authenticated;
grant execute on function public.create_admin_booking_notifications(uuid) to authenticated;
grant execute on function public.get_global_admin_bookings(text) to authenticated;
grant execute on function public.get_hall_booked_slots_for_range(uuid, timestamptz, timestamptz) to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_department_admin() to authenticated;
grant execute on function public.current_user_department() to authenticated;
grant execute on function public.is_department_approver(text) to authenticated;
grant execute on function public.can_admin_manage_department(text) to authenticated;
grant execute on function public.can_review_booking(uuid) to authenticated;
grant execute on function public.can_view_requester_department_booking(uuid) to authenticated;
grant execute on function public.can_view_booking(uuid) to authenticated;

grant execute on function public.check_rate_limit(text, int, int) to service_role;

create or replace function public.admin_apply_role_change(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_new_role text,
  p_department text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_old_role text;
  v_new_department text;
  v_super_admin_email text := 'venueverse.srec@gmail.com';
begin
  if p_new_role not in ('user', 'admin', 'super_admin') then
    raise exception 'Invalid role. Allowed roles are user, admin, and super_admin.';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_user_id;

  if not found then
    raise exception 'Actor profile not found.';
  end if;

  select * into v_target
  from public.profiles
  where id = p_target_user_id;

  if not found then
    raise exception 'Target profile not found.';
  end if;

  v_old_role := v_target.role;
  v_new_department := coalesce(nullif(trim(p_department), ''), v_target.department);

  if v_actor.role not in ('admin', 'super_admin') then
    raise exception 'Only admins can manage user roles.';
  end if;

  if p_target_user_id = p_actor_user_id and v_target.role is distinct from p_new_role then
    raise exception 'Admins cannot change their own role.';
  end if;

  if p_new_role = 'super_admin' and lower(coalesce(v_target.email, '')) <> v_super_admin_email then
    raise exception 'Only the canonical super admin account can have super_admin role.';
  end if;

  if lower(coalesce(v_target.email, '')) = v_super_admin_email
    and v_target.role = 'super_admin'
    and p_new_role <> 'super_admin'
  then
    raise exception 'The protected super admin account cannot be demoted.';
  end if;

  if v_actor.role = 'super_admin' then
    if lower(coalesce(v_actor.email, '')) <> v_super_admin_email then
      raise exception 'Invalid super admin account.';
    end if;

    if p_new_role = 'admin' and v_new_department is not null and exists (
      select 1
      from public.profiles
      where department = v_new_department
        and role = 'admin'
        and id <> p_target_user_id
    ) then
      raise exception 'This department already has an admin.';
    end if;
  else
    if v_actor.department is null then
      raise exception 'Admin department is not assigned.';
    end if;

    if v_target.department is distinct from v_actor.department
      or v_new_department is distinct from v_actor.department
    then
      raise exception 'Department admins can manage users only in their own department.';
    end if;

    if v_target.role = 'super_admin' then
      raise exception 'Department admins cannot manage Super Admin users.';
    end if;

    if p_new_role = 'super_admin' then
      raise exception 'Department admins cannot assign super_admin role.';
    end if;

    if p_new_role = 'admin' and exists (
      select 1
      from public.profiles
      where department = v_actor.department
        and role = 'admin'
        and id <> p_target_user_id
    ) then
      raise exception 'This department already has an admin.';
    end if;
  end if;

  perform set_config(
    'venueverse.role_update_context',
    'admin_role_management_function',
    true
  );

  update public.profiles
  set
    role = p_new_role,
    department = v_new_department
  where id = p_target_user_id;

  return jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'old_role', v_old_role,
    'new_role', p_new_role,
    'department', v_new_department
  );
end;
$$;

revoke all on function public.admin_apply_role_change(uuid, uuid, text, text) from anon;
revoke all on function public.admin_apply_role_change(uuid, uuid, text, text) from authenticated;
grant execute on function public.admin_apply_role_change(uuid, uuid, text, text) to service_role;

create or replace function public.prevent_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    if current_setting('venueverse.role_update_context', true) <> 'admin_role_management_function' then
      raise exception 'User role changes must use the admin role management function.';
    end if;
  end if;

  if new.role = 'super_admin'
    and lower(coalesce(new.email, '')) <> 'venueverse.srec@gmail.com'
  then
    raise exception 'Only the canonical super admin account can have super_admin role.';
  end if;

  if lower(coalesce(old.email, '')) = 'venueverse.srec@gmail.com'
    and old.role = 'super_admin'
    and new.role <> 'super_admin'
  then
    raise exception 'The protected super admin account cannot be demoted.';
  end if;

  return new;
end;
$$;
