create table if not exists public.booking_receipts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  receipt_no text not null unique,
  verification_token text not null unique,
  status text not null check (status in ('approved', 'rejected')),
  pdf_path text not null,
  qr_payload text not null,
  emailed_to text,
  emailed_at timestamptz,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists booking_receipts_booking_id_idx on public.booking_receipts(booking_id);
create index if not exists booking_receipts_receipt_no_idx on public.booking_receipts(receipt_no);
create index if not exists booking_receipts_verification_token_idx on public.booking_receipts(verification_token);

alter table public.booking_receipts enable row level security;

drop policy if exists "booking_receipts_select_admin" on public.booking_receipts;
drop policy if exists "booking_receipts_select_requester" on public.booking_receipts;
drop policy if exists "booking_receipts_select_department_approver" on public.booking_receipts;

create policy "booking_receipts_select_admin"
on public.booking_receipts
for select
to authenticated
using (public.is_admin());

create policy "booking_receipts_select_requester"
on public.booking_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_receipts.booking_id
      and b.user_id = auth.uid()
  )
);

create policy "booking_receipts_select_department_approver"
on public.booking_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.halls h on h.id = b.hall_id
    join public.department_approvers da on da.department = h.department
    where b.id = booking_receipts.booking_id
      and da.user_id = auth.uid()
      and da.is_active = true
  )
);

insert into storage.buckets (id, name, public)
values ('booking-receipts', 'booking-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "booking_receipts_read_admin" on storage.objects;
drop policy if exists "booking_receipts_read_requester" on storage.objects;
drop policy if exists "booking_receipts_read_department_approver" on storage.objects;

create policy "booking_receipts_read_admin"
on storage.objects
for select
to authenticated
using (bucket_id = 'booking-receipts' and public.is_admin());

create policy "booking_receipts_read_requester"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'booking-receipts'
  and exists (
    select 1
    from public.booking_receipts br
    join public.bookings b on b.id = br.booking_id
    where br.pdf_path = storage.objects.name
      and b.user_id = auth.uid()
  )
);

create policy "booking_receipts_read_department_approver"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'booking-receipts'
  and exists (
    select 1
    from public.booking_receipts br
    join public.bookings b on b.id = br.booking_id
    join public.halls h on h.id = b.hall_id
    join public.department_approvers da on da.department = h.department
    where br.pdf_path = storage.objects.name
      and da.user_id = auth.uid()
      and da.is_active = true
  )
);
