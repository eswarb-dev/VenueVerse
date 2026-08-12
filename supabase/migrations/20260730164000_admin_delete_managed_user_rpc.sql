create or replace function public.enforce_booking_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('venueverse.user_delete_context', true) = 'admin_delete_user' then
    return new;
  end if;

  if public.can_review_booking(old.id) then
    if new.hall_id is distinct from old.hall_id
      or new.user_id is distinct from old.user_id
      or new.event_title is distinct from old.event_title
      or new.event_type is distinct from old.event_type
      or new.purpose is distinct from old.purpose
      or new.department is distinct from old.department
      or new.audience_count is distinct from old.audience_count
      or new.faculty_coordinator is distinct from old.faculty_coordinator
      or new.additional_requirements is distinct from old.additional_requirements
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.created_at is distinct from old.created_at then
      raise exception 'Reviewers can only update booking status, admin remarks, and approval metadata.';
    end if;

    if new.status not in ('approved', 'rejected', 'revoked', old.status) then
      raise exception 'Reviewers can only approve, reject, or revoke bookings.';
    end if;

    return new;
  end if;

  if old.user_id = auth.uid()
    and old.status = 'pending'
    and new.status = 'cancelled'
    and new.hall_id is not distinct from old.hall_id
    and new.user_id is not distinct from old.user_id
    and new.event_title is not distinct from old.event_title
    and new.event_type is not distinct from old.event_type
    and new.purpose is not distinct from old.purpose
    and new.department is not distinct from old.department
    and new.audience_count is not distinct from old.audience_count
    and new.faculty_coordinator is not distinct from old.faculty_coordinator
    and new.additional_requirements is not distinct from old.additional_requirements
    and new.start_time is not distinct from old.start_time
    and new.end_time is not distinct from old.end_time
    and new.admin_remarks is not distinct from old.admin_remarks
    and new.approved_by is not distinct from old.approved_by
    and new.revoked_at is not distinct from old.revoked_at
    and new.revoked_by is not distinct from old.revoked_by
    and new.revocation_reason is not distinct from old.revocation_reason
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception 'Users can only cancel their own pending bookings.';
end;
$$;

create or replace function public.admin_prepare_user_delete(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'Target user not found.';
  end if;

  if v_profile.role = 'super_admin' then
    raise exception 'Super Admin accounts cannot be removed from user management.';
  end if;

  perform set_config('venueverse.user_delete_context', 'admin_delete_user', true);

  update public.bookings
  set approved_by = null
  where approved_by = p_target_user_id;

  update public.bookings
  set revoked_by = null
  where revoked_by = p_target_user_id;

  update public.bookings
  set user_id = null
  where user_id = p_target_user_id;

  update public.halls
  set deactivated_by = null
  where deactivated_by = p_target_user_id;

  update public.halls
  set reactivated_by = null
  where reactivated_by = p_target_user_id;

  update public.booking_receipts
  set generated_by = null
  where generated_by = p_target_user_id;

  delete from public.profiles
  where id = p_target_user_id;

  return jsonb_build_object('success', true, 'target_user_id', p_target_user_id);
end;
$$;

revoke all on function public.admin_prepare_user_delete(uuid) from anon;
revoke all on function public.admin_prepare_user_delete(uuid) from authenticated;
grant execute on function public.admin_prepare_user_delete(uuid) to service_role;
