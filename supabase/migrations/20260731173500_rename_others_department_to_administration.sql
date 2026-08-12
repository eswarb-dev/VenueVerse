select set_config('venueverse.user_delete_context', 'admin_delete_user', true);

update public.profiles
set department = 'Administration'
where department in ('Others', 'Other');

update public.halls
set department = 'Administration'
where department in ('Others', 'Other');

update public.bookings
set department = 'Administration'
where department in ('Others', 'Other');

update public.department_approvers
set department = 'Administration'
where department in ('Others', 'Other');
