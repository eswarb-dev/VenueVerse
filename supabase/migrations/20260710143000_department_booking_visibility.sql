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

grant execute on function public.get_my_department_bookings() to authenticated;

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

grant execute on function public.get_visible_booking_details(uuid) to authenticated;
