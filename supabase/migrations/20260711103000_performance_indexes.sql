create index if not exists bookings_hall_status_time_idx
on public.bookings(hall_id, status, start_time, end_time);

create index if not exists bookings_user_created_at_idx
on public.bookings(user_id, created_at desc);

create index if not exists bookings_status_created_at_idx
on public.bookings(status, created_at desc);

create index if not exists halls_department_active_idx
on public.halls(department, is_active);

create index if not exists halls_department_venue_type_active_idx
on public.halls(department, venue_type, is_active);

create index if not exists profiles_lower_email_idx
on public.profiles(lower(email));

create index if not exists profiles_department_idx
on public.profiles(department);

create index if not exists profiles_role_idx
on public.profiles(role);

create index if not exists profiles_department_role_idx
on public.profiles(department, role);

create index if not exists notifications_user_read_idx
on public.notifications(user_id, is_read);

create index if not exists notifications_user_created_at_idx
on public.notifications(user_id, created_at desc);

create index if not exists receipt_email_jobs_status_run_after_idx
on public.receipt_email_jobs(status, run_after);
