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
