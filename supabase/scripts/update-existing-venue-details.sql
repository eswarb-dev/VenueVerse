-- VenueVerse existing venue update helper.
--
-- Purpose:
-- - Update details for venues that already exist in public.halls.
-- - Use this from Supabase SQL Editor after replacing the example values.
-- - This does not touch bookings, receipts, users, roles, or notification data.
--
-- Safe workflow:
-- 1. Run the PREVIEW query for the venue you want to edit.
-- 2. Copy the exact hall id from the result.
-- 3. Run the UPDATE BY ID block.
-- 4. Run the VERIFY query.

-- ==================================================
-- 1. Preview Current Venue Rows
-- ==================================================

select
  id,
  name,
  department,
  venue_type,
  location,
  block,
  floor,
  capacity,
  facilities,
  is_active,
  inactive_reason
from public.halls
order by department nulls last, name;

-- Optional: preview one venue by department + name.
-- Replace the values before running.
select
  id,
  name,
  department,
  venue_type,
  location,
  block,
  floor,
  capacity,
  facilities,
  is_active,
  inactive_reason
from public.halls
where department = 'AI&DS'
  and name = 'AI&DS Computer Lab';

-- ==================================================
-- 2. Update One Venue By ID
-- ==================================================
-- Recommended because it avoids accidentally updating similarly named venues.
-- Replace:
-- - 00000000-0000-0000-0000-000000000000
-- - name / department / venue_type / block / floor / capacity / facilities
--
-- Notes:
-- - location is intentionally set to null because the app displays block/floor
--   as "F - Block, 1st Floor".
-- - facilities must use current app values:
--   Projector, Microphone, Speakers, AC, Wi-Fi, Smart Board,
--   Whiteboard, Computer System, Stage, Recording Setup.

update public.halls
set
  name = 'AI&DS Computer Lab',
  department = 'AI&DS',
  venue_type = 'Computer Lab',
  location = null,
  block = 'F',
  floor = '1st',
  capacity = 70,
  facilities = array['AC', 'Wi-Fi', 'Computer System']::text[]
where id = '00000000-0000-0000-0000-000000000000';

-- ==================================================
-- 3. Update One Venue By Department + Current Name
-- ==================================================
-- Use this only when you are certain the department/name pair is unique.

update public.halls
set
  name = 'AI&DS BYOD Lab',
  venue_type = 'BYOD Lab',
  location = null,
  block = null,
  floor = null,
  capacity = 60,
  facilities = array['Wi-Fi', 'Computer System']::text[]
where department = 'AI&DS'
  and name = 'AI&DS Byod Lab';

-- ==================================================
-- 4. Clear Legacy/Demo Facility Values From All Venues
-- ==================================================
-- This removes only unsupported/legacy facility text and preserves valid manual entries.
-- Run this if old demo chips still appear on venue cards.

update public.halls
set facilities = coalesce(
  (
    select array_agg(facility order by facility)
    from unnest(coalesce(public.halls.facilities, array[]::text[])) as facility
    where facility = any(array[
      'Projector',
      'Microphone',
      'Speakers',
      'AC',
      'Wi-Fi',
      'Smart Board',
      'Whiteboard',
      'Computer System',
      'Stage',
      'Recording Setup'
    ]::text[])
  ),
  array[]::text[]
);

-- ==================================================
-- 5. Verify Updated Venue Rows
-- ==================================================

select
  id,
  name,
  department,
  venue_type,
  case
    when nullif(trim(coalesce(block, '')), '') is not null
      and nullif(trim(coalesce(floor, '')), '') is not null
      then trim(block) || ' - Block, ' || trim(floor) || ' Floor'
    when nullif(trim(coalesce(block, '')), '') is not null
      then trim(block) || ' - Block'
    when nullif(trim(coalesce(floor, '')), '') is not null
      then trim(floor) || ' Floor'
    else 'Campus venue'
  end as app_display_location,
  capacity,
  facilities,
  is_active,
  inactive_reason
from public.halls
order by department nulls last, name;
