create or replace function public.can_admin_manage_department(target_department text)
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
  select exists (
    select 1
    from public.bookings b
    join public.halls h on h.id = b.hall_id
    join public.profiles p on p.id = auth.uid()
    where b.id = target_booking_id
      and p.role = 'admin'
      and p.department = h.department
  );
$$;

create unique index if not exists one_admin_per_department_idx
on public.profiles(department)
where role = 'admin' and department is not null;

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
  or public.can_admin_manage_department(department)
);

create policy "profiles_update_department_admin"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.can_admin_manage_department(department)
)
with check (
  id = auth.uid()
  or public.can_admin_manage_department(department)
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
drop policy if exists "bookings_review_admin" on public.bookings;
drop policy if exists "bookings_review_department_approver" on public.bookings;
drop policy if exists "bookings_select_department_admin" on public.bookings;
drop policy if exists "bookings_review_department_admin" on public.bookings;

create policy "bookings_select_department_admin"
on public.bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_review_booking(id)
);

create policy "bookings_review_department_admin"
on public.bookings
for update
to authenticated
using (public.can_review_booking(id))
with check (public.can_review_booking(id));

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
    b.department as requester_department,
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

  if booking_record.user_id <> auth.uid() and not public.can_review_booking(booking_record.id) then
    raise exception 'Not allowed to notify department admin for this booking.';
  end if;

  return query
  with recipients as (
    select id as user_id
    from public.profiles
    where role = 'admin'
      and department = booking_record.hall_department
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
      'New venue booking request',
      coalesce(booking_record.requester_name, 'A user') || ' requested ' || coalesce(booking_record.hall_name, 'a venue') || ' for ' || booking_record.event_title || '.',
      booking_record.id,
      false
    from recipients
    returning notifications.user_id
  )
  select inserted.user_id from inserted;
end;
$$;

create or replace function public.create_admin_booking_notifications(
  booking_to_notify uuid
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select recipients.user_id
  from public.notify_department_approver(booking_to_notify) as recipients;
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
  join public.halls h on h.id = b.hall_id
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
      admin_remarks = nullif(btrim(coalesce(approval_remarks, '')), ''),
      updated_at = now()
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

  select b.*
  into booking_record
  from public.bookings b
  join public.halls h on h.id = b.hall_id
  where b.id = target_booking_id
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
      admin_remarks = remarks,
      updated_at = now()
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
