create or replace function public.admin_finalize_created_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_department text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := btrim(coalesce(p_role, ''));
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Only service role can finalize admin-created profiles.';
  end if;

  if p_user_id is null then
    raise exception 'User id is required.';
  end if;

  if v_email = '' then
    raise exception 'Email is required.';
  end if;

  if v_role not in ('user', 'admin', 'super_admin') then
    raise exception 'Invalid role.';
  end if;

  if v_role = 'super_admin' and v_email <> 'venueverse.srec@gmail.com' then
    raise exception 'Only the canonical super admin account can have super_admin role.';
  end if;

  perform set_config(
    'venueverse.role_update_context',
    'admin_role_management_function',
    true
  );

  insert into public.profiles (
    id,
    full_name,
    email,
    department,
    role
  )
  values (
    p_user_id,
    btrim(coalesce(p_full_name, '')),
    v_email,
    nullif(btrim(coalesce(p_department, '')), ''),
    v_role
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    department = excluded.department,
    role = excluded.role;

  return jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'email', v_email,
    'department', nullif(btrim(coalesce(p_department, '')), ''),
    'role', v_role
  );
end;
$$;

revoke all on function public.admin_finalize_created_user_profile(uuid, text, text, text, text) from anon;
revoke all on function public.admin_finalize_created_user_profile(uuid, text, text, text, text) from authenticated;
grant execute on function public.admin_finalize_created_user_profile(uuid, text, text, text, text) to service_role;
