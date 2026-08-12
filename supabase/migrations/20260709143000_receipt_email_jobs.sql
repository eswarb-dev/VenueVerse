create table if not exists public.receipt_email_jobs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid references public.booking_receipts(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  run_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receipt_email_jobs_status_idx
on public.receipt_email_jobs(status);

create index if not exists receipt_email_jobs_run_after_idx
on public.receipt_email_jobs(run_after);

create index if not exists receipt_email_jobs_booking_id_idx
on public.receipt_email_jobs(booking_id);

create unique index if not exists receipt_email_jobs_unique_receipt_pending_sent_idx
on public.receipt_email_jobs(receipt_id)
where status in ('pending', 'processing', 'sent');

alter table public.receipt_email_jobs enable row level security;

alter table public.booking_receipts
add column if not exists email_status text default 'pending';

alter table public.booking_receipts
add column if not exists email_error text;

alter table public.booking_receipts
add column if not exists email_attempts integer not null default 0;

alter table public.booking_receipts
add column if not exists last_email_attempt_at timestamptz;
