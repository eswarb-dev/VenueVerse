alter table public.booking_receipts
add column if not exists last_pdf_attachment_sent_at timestamptz,
add column if not exists pdf_attachment_send_count integer not null default 0,
add column if not exists pdf_attachment_last_error text;
