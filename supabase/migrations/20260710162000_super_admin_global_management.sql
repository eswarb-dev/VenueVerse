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

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_department_admin() to authenticated;
grant execute on function public.can_admin_manage_department(text) to authenticated;
grant execute on function public.can_view_booking(uuid) to authenticated;
grant execute on function public.get_global_admin_bookings(text) to authenticated;

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
