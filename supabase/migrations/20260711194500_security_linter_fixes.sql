-- Address Supabase security linter warnings without changing app workflows.
-- The app does not call storage.from('hall-images').list(); it uploads hall
-- images and stores public URLs, so broad object listing policies are removed.

alter function public.check_booking_overlap(uuid, timestamptz, timestamptz)
  set search_path = public, pg_temp;

alter function public.check_approved_booking_overlap(uuid, uuid, timestamptz, timestamptz)
  set search_path = public, pg_temp;

alter function public.set_booking_updated_at()
  set search_path = public, pg_temp;

drop policy if exists "Public read email assets" on storage.objects;
drop policy if exists "hall_images_read_authenticated" on storage.objects;

revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

grant execute on function public.check_booking_overlap(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.check_approved_booking_overlap(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_today_booked_halls(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_department_pending_requests() to authenticated;
grant execute on function public.get_my_department_bookings() to authenticated;
grant execute on function public.get_visible_booking_details(uuid) to authenticated;
grant execute on function public.notify_department_approver(uuid) to authenticated;
grant execute on function public.approve_booking(uuid, text) to authenticated;
grant execute on function public.reject_booking(uuid, text) to authenticated;
grant execute on function public.create_admin_booking_notifications(uuid) to authenticated;
grant execute on function public.get_global_admin_bookings(text) to authenticated;
grant execute on function public.get_hall_booked_slots_for_range(uuid, timestamptz, timestamptz) to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_department_admin() to authenticated;
grant execute on function public.current_user_department() to authenticated;
grant execute on function public.is_department_approver(text) to authenticated;
grant execute on function public.can_admin_manage_department(text) to authenticated;
grant execute on function public.can_review_booking(uuid) to authenticated;
grant execute on function public.can_view_requester_department_booking(uuid) to authenticated;
grant execute on function public.can_view_booking(uuid) to authenticated;

grant execute on function public.check_rate_limit(text, int, int) to service_role;
