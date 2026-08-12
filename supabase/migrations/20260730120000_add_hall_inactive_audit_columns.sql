alter table public.halls
add column if not exists inactive_reason text,
add column if not exists deactivated_at timestamptz,
add column if not exists deactivated_by uuid references public.profiles(id),
add column if not exists reactivated_at timestamptz,
add column if not exists reactivated_by uuid references public.profiles(id);
