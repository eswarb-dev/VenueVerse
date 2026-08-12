create or replace function public.admin_apply_role_change(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_new_role text,
  p_department text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_old_role text;
  v_new_department text;
  v_super_admin_email text := 'venueverse.srec@gmail.com';
begin
  if p_new_role not in ('user', 'admin', 'super_admin') then
    raise exception 'Invalid role. Allowed roles are user, admin, and super_admin.';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_user_id;

  if not found then
    raise exception 'Actor profile not found.';
  end if;

  select * into v_target
  from public.profiles
  where id = p_target_user_id;

  if not found then
    raise exception 'Target profile not found.';
  end if;

  v_old_role := v_target.role;
  v_new_department := coalesce(nullif(trim(p_department), ''), v_target.department);

  if v_actor.role not in ('admin', 'super_admin') then
    raise exception 'Only admins can manage user roles.';
  end if;

  if p_target_user_id = p_actor_user_id and v_target.role is distinct from p_new_role then
    raise exception 'Admins cannot change their own role.';
  end if;

  if p_new_role = 'super_admin' and lower(coalesce(v_target.email, '')) <> v_super_admin_email then
    raise exception 'Only the canonical super admin account can have super_admin role.';
  end if;

  if lower(coalesce(v_target.email, '')) = v_super_admin_email
    and v_target.role = 'super_admin'
    and p_new_role <> 'super_admin'
  then
    raise exception 'The protected super admin account cannot be demoted.';
  end if;

  if v_actor.role = 'super_admin' then
    if lower(coalesce(v_actor.email, '')) <> v_super_admin_email then
      raise exception 'Invalid super admin account.';
    end if;

    if p_new_role = 'admin' and v_new_department is not null and exists (
      select 1
      from public.profiles
      where department = v_new_department
        and role = 'admin'
        and id <> p_target_user_id
    ) then
      raise exception 'This department already has an admin.';
    end if;
  else
    if v_actor.department is null then
      raise exception 'Admin department is not assigned.';
    end if;

    if v_target.department is distinct from v_actor.department
      or v_new_department is distinct from v_actor.department
    then
      raise exception 'Department admins can manage users only in their own department.';
    end if;

    if v_target.role = 'super_admin' then
      raise exception 'Department admins cannot manage Super Admin users.';
    end if;

    if p_new_role = 'super_admin' then
      raise exception 'Department admins cannot assign super_admin role.';
    end if;

    if p_new_role = 'admin' and exists (
      select 1
      from public.profiles
      where department = v_actor.department
        and role = 'admin'
        and id <> p_target_user_id
    ) then
      raise exception 'This department already has an admin.';
    end if;
  end if;

  perform set_config(
    'venueverse.role_update_context',
    'admin_role_management_function',
    true
  );

  update public.profiles
  set
    role = p_new_role,
    department = v_new_department
  where id = p_target_user_id;

  return jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'old_role', v_old_role,
    'new_role', p_new_role,
    'department', v_new_department
  );
end;
$$;

revoke all on function public.admin_apply_role_change(uuid, uuid, text, text) from anon;
revoke all on function public.admin_apply_role_change(uuid, uuid, text, text) from authenticated;
grant execute on function public.admin_apply_role_change(uuid, uuid, text, text) to service_role;

create or replace function public.prevent_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    if current_setting('venueverse.role_update_context', true) <> 'admin_role_management_function' then
      raise exception 'User role changes must use the admin role management function.';
    end if;
  end if;

  if new.role = 'super_admin'
    and lower(coalesce(new.email, '')) <> 'venueverse.srec@gmail.com'
  then
    raise exception 'Only the canonical super admin account can have super_admin role.';
  end if;

  if lower(coalesce(old.email, '')) = 'venueverse.srec@gmail.com'
    and old.role = 'super_admin'
    and new.role <> 'super_admin'
  then
    raise exception 'The protected super admin account cannot be demoted.';
  end if;

  return new;
end;
$$;
