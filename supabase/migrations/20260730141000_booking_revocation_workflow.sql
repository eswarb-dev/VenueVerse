alter table public.bookings
drop constraint if exists bookings_status_check;

alter table public.bookings
add constraint bookings_status_check check (
  status in ('pending', 'approved', 'rejected', 'cancelled', 'completed', 'revoked')
);

alter table public.bookings
add column if not exists revoked_at timestamptz,
add column if not exists revoked_by uuid references public.profiles(id),
add column if not exists revocation_reason text;

alter table public.bookings
drop constraint if exists bookings_revoked_metadata_check;

alter table public.bookings
add constraint bookings_revoked_metadata_check check (
  status <> 'revoked'
  or (
    revoked_at is not null
    and revoked_by is not null
    and length(btrim(coalesce(revocation_reason, ''))) >= 5
  )
);

create index if not exists bookings_status_updated_at_idx
on public.bookings(status, updated_at desc);

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
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if length(v_reason) < 5 then
    raise exception 'Please enter a valid revoke reason.';
  end if;

  select *
  into v_actor
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Actor profile not found.';
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

  if v_actor.department is distinct from v_hall.department then
    raise exception 'Only the booked venue department admin can revoke this booking.';
  end if;

  update public.bookings
  set
    status = 'revoked',
    revocation_reason = v_reason,
    revoked_at = now(),
    revoked_by = v_actor.id,
    updated_at = now()
  where id = p_booking_id;

  insert into public.notifications (
    user_id,
    booking_id,
    title,
    message,
    is_read,
    created_at
  )
  values (
    v_booking.user_id,
    v_booking.id,
    'Booking revoked',
    'Your approved venue booking for ' || coalesce(v_hall.name, 'the venue') || ' has been revoked. Reason: ' || v_reason,
    false,
    now()
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'revoked',
    'revoked_at', now(),
    'revocation_reason', v_reason
  );
end;
$$;

revoke all on function public.revoke_booking(uuid, text) from anon;
grant execute on function public.revoke_booking(uuid, text) to authenticated;

create or replace function public.enforce_booking_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

    if new.status not in ('approved', 'rejected', 'revoked', old.status) then
      raise exception 'Reviewers can only approve, reject, or revoke bookings.';
    end if;

    if new.status = 'revoked' and old.status <> 'approved' then
      raise exception 'Only approved bookings can be revoked.';
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
    and new.revoked_at is not distinct from old.revoked_at
    and new.revoked_by is not distinct from old.revoked_by
    and new.revocation_reason is not distinct from old.revocation_reason
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception 'Users can only cancel their own pending bookings.';
end;
$$;

drop function if exists public.get_visible_booking_details(uuid);

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
  revocation_reason text,
  revoked_at timestamptz,
  revoked_by_name text,
  revoked_by_department text,
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
set search_path = public, pg_temp
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
    b.revocation_reason,
    b.revoked_at,
    revoker.full_name as revoked_by_name,
    revoker.department as revoked_by_department,
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
  left join public.profiles revoker on revoker.id = b.revoked_by
  where b.id = target_booking
    and public.can_view_booking(b.id);
$$;

grant execute on function public.get_visible_booking_details(uuid) to authenticated;
