-- Remove legacy/demo duplicate facility text from existing hall rows.
-- The current manual picker uses "Computer System"; this removes only the old
-- plural "Computer Systems" value while preserving manually selected facilities.

alter table public.halls disable trigger prevent_user_hall_department_change;

update public.halls
set facilities = array_remove(coalesce(facilities, array[]::text[]), 'Computer Systems')
where coalesce(facilities, array[]::text[]) @> array['Computer Systems']::text[];

alter table public.halls enable trigger prevent_user_hall_department_change;
