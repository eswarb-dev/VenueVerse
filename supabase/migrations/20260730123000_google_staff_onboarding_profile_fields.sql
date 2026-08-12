alter table public.profiles
add column if not exists auth_provider text,
add column if not exists is_staff_verified boolean not null default false,
add column if not exists onboarding_completed boolean not null default false,
add column if not exists updated_at timestamptz default now();

update public.profiles
set onboarding_completed = true,
    updated_at = coalesce(updated_at, now())
where onboarding_completed = false;
