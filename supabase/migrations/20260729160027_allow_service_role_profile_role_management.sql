create or replace function public.prevent_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role is distinct from new.role
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'User role changes must use the admin role management function.';
  end if;

  return new;
end;
$$;
