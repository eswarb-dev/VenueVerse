-- One-time migration from the former super_admin role to the two-role model.
-- Apply before deploying app code that only recognizes admin and user.

update public.profiles
set role = 'admin'
where role = 'super_admin';

update auth.users
set raw_user_meta_data =
  jsonb_set(
    coalesce(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"',
    true
  )
where raw_user_meta_data->>'role' = 'super_admin';

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('user', 'admin'));

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

create or replace function public.prevent_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
    and current_user <> 'service_role'
    and not public.is_admin()
  then
    raise exception 'Only admins can update profile roles.';
  end if;

  return new;
end;
$$;

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

create or replace function public.enforce_booking_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
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

drop policy if exists "profiles_select_admin_all" on public.profiles;
drop policy if exists "profiles_update_roles_super_admin" on public.profiles;
drop policy if exists "profiles_update_roles_admin" on public.profiles;
drop policy if exists "halls_select_admin_all" on public.halls;
drop policy if exists "halls_insert_admin" on public.halls;
drop policy if exists "halls_update_admin" on public.halls;
drop policy if exists "halls_delete_super_admin" on public.halls;
drop policy if exists "halls_delete_admin" on public.halls;
drop policy if exists "bookings_select_admin_all" on public.bookings;
drop policy if exists "bookings_review_admin" on public.bookings;
drop policy if exists "notifications_insert_admin" on public.notifications;
drop policy if exists "push_tokens_select_admin" on public.push_tokens;
drop policy if exists "hall_images_insert_admin" on storage.objects;
drop policy if exists "hall_images_update_admin" on storage.objects;
drop policy if exists "hall_images_delete_admin" on storage.objects;

create policy "profiles_select_admin_all"
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy "profiles_update_roles_admin"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "halls_select_admin_all"
on public.halls
for select
to authenticated
using (public.is_admin());

create policy "halls_insert_admin"
on public.halls
for insert
to authenticated
with check (public.is_admin());

create policy "halls_update_admin"
on public.halls
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "halls_delete_admin"
on public.halls
for delete
to authenticated
using (public.is_admin());

create policy "bookings_select_admin_all"
on public.bookings
for select
to authenticated
using (public.is_admin());

create policy "bookings_review_admin"
on public.bookings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "notifications_insert_admin"
on public.notifications
for insert
to authenticated
with check (public.is_admin());

create policy "push_tokens_select_admin"
on public.push_tokens
for select
to authenticated
using (public.is_admin());

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

drop function if exists public.is_admin_or_super_admin();
drop function if exists public.is_super_admin();
