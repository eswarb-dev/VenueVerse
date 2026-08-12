alter table public.booking_receipts
add column if not exists storage_deleted_at timestamptz;

create index if not exists booking_receipts_cleanup_idx
on public.booking_receipts(created_at, storage_deleted_at)
where pdf_path is not null;
