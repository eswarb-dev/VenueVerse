alter table public.push_tokens
add column if not exists device_id text;

alter table public.push_tokens
add column if not exists is_active boolean not null default true;

alter table public.booking_receipts
add column if not exists receipt_email_notification_sent_at timestamptz;

alter table public.booking_receipts
add column if not exists receipt_push_notification_sent_at timestamptz;

alter table public.booking_receipts
add column if not exists receipt_notification_error text;
