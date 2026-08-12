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
  for update of b;

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

  perform set_config('venueverse.booking_review_context', 'admin_booking_review_function', true);

  update public.bookings
  set status = 'approved',
      approved_by = auth.uid(),
      admin_remarks = nullif(btrim(coalesce(approval_remarks, '')), ''),
      updated_at = now()
  where id = target_booking_id;

  if booking_record.user_id is not null then
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
  end if;

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
  for update of b;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if booking_record.status <> 'pending' then
    raise exception 'Only pending bookings can be rejected.';
  end if;

  perform set_config('venueverse.booking_review_context', 'admin_booking_review_function', true);

  update public.bookings
  set status = 'rejected',
      approved_by = auth.uid(),
      admin_remarks = remarks,
      updated_at = now()
  where id = target_booking_id;

  if booking_record.user_id is not null then
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
  end if;

  return jsonb_build_object('ok', true, 'booking_id', target_booking_id, 'status', 'rejected');
end;
$$;

grant execute on function public.approve_booking(uuid, text) to authenticated;
grant execute on function public.reject_booking(uuid, text) to authenticated;
