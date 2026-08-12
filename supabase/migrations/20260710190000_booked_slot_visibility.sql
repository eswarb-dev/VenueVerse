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
