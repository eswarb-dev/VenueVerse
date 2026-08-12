create extension if not exists btree_gist;

do $$
begin
  if exists (
    select 1
    from public.bookings b1
    join public.bookings b2
      on b1.hall_id = b2.hall_id
     and b1.id < b2.id
     and b1.status in ('pending', 'approved')
     and b2.status in ('pending', 'approved')
     and tstzrange(b1.start_time, b1.end_time, '[)')
         && tstzrange(b2.start_time, b2.end_time, '[)')
  ) then
    raise exception 'Cannot add first-come-first-served booking lock: overlapping pending/approved bookings already exist.';
  end if;
end $$;

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

grant execute on function public.check_booking_overlap(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.check_approved_booking_overlap(uuid, uuid, timestamptz, timestamptz) to authenticated;
