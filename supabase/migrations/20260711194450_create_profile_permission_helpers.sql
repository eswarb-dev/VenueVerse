create or replace function public.current_user_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_department_approver(target_department text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.department_approvers da
    where da.user_id = auth.uid()
      and da.department = target_department
      and da.is_active = true
  );
$$;
