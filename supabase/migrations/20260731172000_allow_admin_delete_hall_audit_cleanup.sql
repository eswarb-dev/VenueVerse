create or replace function public.prevent_user_hall_department_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('venueverse.user_delete_context', true) = 'admin_delete_user' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if old.department is distinct from public.current_user_department()
    or new.department is distinct from old.department then
    raise exception 'Users cannot change venue department.';
  end if;

  return new;
end;
$$;
