create or replace function public.prevent_user_hall_department_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists prevent_user_hall_department_change on public.halls;

create trigger prevent_user_hall_department_change
before update on public.halls
for each row
execute function public.prevent_user_hall_department_change();
