alter table public.booking_receipts
add column if not exists email_status text default 'pending';

alter table public.booking_receipts
add column if not exists email_error text;

alter table public.booking_receipts
add column if not exists email_attempts integer not null default 0;

alter table public.booking_receipts
add column if not exists last_email_attempt_at timestamptz;
