alter table public.notifications
add column if not exists type text,
add column if not exists data jsonb not null default '{}'::jsonb;

create index if not exists notifications_type_created_at_idx
on public.notifications(type, created_at desc);

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
    select p.id as user_id
    from public.profiles p
    where p.role = 'admin'
      and p.department = booking_record.hall_department
  ),
  inserted as (
    insert into public.notifications (
      user_id,
      title,
      message,
      booking_id,
      type,
      data,
      is_read
    )
    select
      recipients.user_id,
      'New booking request',
      coalesce(booking_record.requester_name, 'A user') || ' requested ' || coalesce(booking_record.hall_name, 'a venue') || ' for ' || booking_record.event_title || '.',
      booking_record.id,
      'booking_request',
      jsonb_build_object(
        'type', 'booking_request',
        'booking_id', booking_record.id,
        'venue_name', coalesce(booking_record.hall_name, ''),
        'event_title', coalesce(booking_record.event_title, '')
      ),
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
      admin_remarks = nullif(btrim(coalesce(approval_remarks, '')), ''),
      updated_at = now()
  where id = target_booking_id;

  insert into public.notifications (user_id, title, message, booking_id, type, data, is_read)
  values (
    booking_record.user_id,
    'Booking approved',
    'Your booking for ' || coalesce(booking_record.hall_name, 'the venue') || ' has been approved.',
    booking_record.id,
    'booking_approved',
    jsonb_build_object(
      'type', 'booking_approved',
      'booking_id', booking_record.id,
      'venue_name', coalesce(booking_record.hall_name, ''),
      'event_title', coalesce(booking_record.event_title, '')
    ),
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
    raise exception 'Only pending bookings can be rejected.';
  end if;

  update public.bookings
  set status = 'rejected',
      approved_by = auth.uid(),
      admin_remarks = remarks,
      updated_at = now()
  where id = target_booking_id;

  insert into public.notifications (user_id, title, message, booking_id, type, data, is_read)
  values (
    booking_record.user_id,
    'Booking rejected',
    'Your booking for ' || coalesce(booking_record.hall_name, 'the venue') || ' was rejected. Reason: ' || remarks,
    booking_record.id,
    'booking_rejected',
    jsonb_build_object(
      'type', 'booking_rejected',
      'booking_id', booking_record.id,
      'venue_name', coalesce(booking_record.hall_name, ''),
      'event_title', coalesce(booking_record.event_title, '')
    ),
    false
  );

  return jsonb_build_object('ok', true, 'booking_id', target_booking_id, 'status', 'rejected');
end;
$$;

create or replace function public.revoke_booking(
  p_booking_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_booking public.bookings%rowtype;
  v_hall public.halls%rowtype;
  v_reason text := nullif(trim(p_reason), '');
begin
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Please enter a valid revoke reason.';
  end if;

  select *
  into v_actor
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Reviewer profile not found.';
  end if;

  if v_actor.role <> 'admin' then
    raise exception 'Only the respective department admin can revoke approved bookings.';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status <> 'approved' then
    raise exception 'Only approved bookings can be revoked.';
  end if;

  select *
  into v_hall
  from public.halls
  where id = v_booking.hall_id;

  if not found then
    raise exception 'Booked venue not found.';
  end if;

  if v_actor.department is null or v_actor.department is distinct from v_hall.department then
    raise exception 'Only the booked venue department admin can revoke this booking.';
  end if;

  update public.bookings
  set
    status = 'revoked',
    admin_remarks = v_reason,
    revoked_at = now(),
    revoked_by = v_actor.id,
    revocation_reason = v_reason,
    updated_at = now()
  where id = v_booking.id;

  insert into public.notifications (
    user_id,
    booking_id,
    title,
    message,
    type,
    data,
    is_read
  )
  values (
    v_booking.user_id,
    v_booking.id,
    'Booking revoked',
    'Your approved booking for ' || coalesce(v_hall.name, 'the venue') || ' was revoked. Reason: ' || v_reason,
    'booking_revoked',
    jsonb_build_object(
      'type', 'booking_revoked',
      'booking_id', v_booking.id,
      'venue_name', coalesce(v_hall.name, ''),
      'event_title', coalesce(v_booking.event_title, '')
    ),
    false
  );

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking.id,
    'status', 'revoked',
    'revoked_at', now(),
    'revoked_by', v_actor.id
  );
end;
$$;

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

  if v_old_role is not distinct from p_new_role
    and v_target.department is not distinct from v_new_department
  then
    return jsonb_build_object(
      'success', true,
      'target_user_id', p_target_user_id,
      'old_role', v_old_role,
      'new_role', p_new_role,
      'department', v_new_department,
      'changed', false
    );
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

  insert into public.notifications (user_id, title, message, type, data, is_read)
  values (
    p_target_user_id,
    'Role updated',
    'Your VenueVerse role has been updated to ' || p_new_role || '.',
    'role_changed',
    jsonb_build_object(
      'type', 'role_changed',
      'old_role', coalesce(v_old_role, ''),
      'new_role', p_new_role,
      'department', coalesce(v_new_department, '')
    ),
    false
  );

  return jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'old_role', v_old_role,
    'new_role', p_new_role,
    'department', v_new_department,
    'changed', true
  );
end;
$$;

grant execute on function public.notify_department_approver(uuid) to authenticated;
grant execute on function public.approve_booking(uuid, text) to authenticated;
grant execute on function public.reject_booking(uuid, text) to authenticated;
grant execute on function public.revoke_booking(uuid, text) to authenticated;
grant execute on function public.admin_apply_role_change(uuid, uuid, text, text) to service_role;
