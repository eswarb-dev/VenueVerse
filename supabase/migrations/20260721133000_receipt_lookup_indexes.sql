create index if not exists booking_receipts_booking_generated_at_idx
  on public.booking_receipts(booking_id, generated_at desc);

create index if not exists booking_receipts_receipt_no_generated_at_idx
  on public.booking_receipts(receipt_no, generated_at desc);
