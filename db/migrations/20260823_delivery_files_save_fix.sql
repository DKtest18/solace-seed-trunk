-- ============================================================================
-- 20260823_delivery_files_save_fix.sql
-- Idempotent. Safe to run repeatedly. Additive only.
--
-- Purpose: the Delivery Files step saved files into dkai_product_files but the
-- product row's primary-file columns stayed NULL (stale React state), so the
-- admin review page showed "Not provided by seller".
--
-- This script:
--   1. Guarantees the columns the wizard writes exist (+ column grants).
--   2. Guarantees dkai_product_files exists with the columns the app reads.
--   3. Guarantees admins can READ product files metadata (no write/delete).
--   4. Keeps the 'product-files' bucket PRIVATE (admin read-only policy).
--   5. Backfills existing submissions from dkai_product_files.
-- Nothing here touches checkout, the Stripe webhook, Stripe Connect onboarding,
-- /admin/product-review, the seller agreement gate, demo videos, product media
-- or the purchasability guard.
-- ============================================================================

-- ---------- 1. Product row columns -----------------------------------------
alter table public.dkai_products
  add column if not exists delivery_mode        text,
  add column if not exists delivery_time_hours  integer,
  add column if not exists file_storage_key     text,
  add column if not exists file_size_bytes      bigint,
  add column if not exists file_scan_status     text,
  add column if not exists return_conditions    text,
  add column if not exists refund_policy        text,
  add column if not exists seller_ack_refund_policy    boolean not null default false,
  add column if not exists seller_ack_refund_policy_at timestamptz;

-- Column-level UPDATE grants (RLS still scopes writes to the owning seller).
grant update (
  delivery_mode,
  delivery_time_hours,
  file_storage_key,
  file_size_bytes,
  file_scan_status,
  return_conditions,
  refund_policy,
  seller_ack_refund_policy,
  seller_ack_refund_policy_at
) on public.dkai_products to authenticated;

-- ---------- 2. dkai_product_files ------------------------------------------
create table if not exists public.dkai_product_files (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.dkai_products(id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  file_size   bigint not null default 0,
  mime_type   text,
  scan_status text not null default 'pending',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.dkai_product_files
  add column if not exists file_path   text,
  add column if not exists file_name   text,
  add column if not exists file_size   bigint,
  add column if not exists mime_type   text,
  add column if not exists scan_status text,
  add column if not exists uploaded_by uuid,
  add column if not exists created_at  timestamptz default now();

create index if not exists dkai_product_files_product_id_idx
  on public.dkai_product_files (product_id);

alter table public.dkai_product_files enable row level security;

revoke all on public.dkai_product_files from anon;
grant select, insert, delete on public.dkai_product_files to authenticated;
grant all on public.dkai_product_files to service_role;

-- ---------- 3. Policies: seller (own) + admin read -------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'dkai_has_role') then
    drop policy if exists "Sellers manage own product files" on public.dkai_product_files;
    create policy "Sellers manage own product files"
      on public.dkai_product_files
      for all
      to authenticated
      using (
        exists (select 1 from public.dkai_products p
                where p.id = dkai_product_files.product_id and p.seller_id = auth.uid())
      )
      with check (
        exists (select 1 from public.dkai_products p
                where p.id = dkai_product_files.product_id and p.seller_id = auth.uid())
      );

    drop policy if exists "Admins can view all product files" on public.dkai_product_files;
    create policy "Admins can view all product files"
      on public.dkai_product_files
      for select
      to authenticated
      using (public.dkai_has_role(auth.uid(), 'admin'));
  end if;
end $$;

-- ---------- 4. Storage: 'product-files' stays PRIVATE ----------------------
update storage.buckets set public = false where id = 'product-files';

do $$
begin
  if exists (select 1 from pg_proc where proname = 'dkai_has_role') then
    drop policy if exists "Admins can read product files" on storage.objects;
    create policy "Admins can read product files"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'product-files'
        and public.dkai_has_role(auth.uid(), 'admin')
      );
  end if;
end $$;

-- ---------- 5. Backfill existing submissions -------------------------------
-- Mirror the earliest uploaded delivery file onto the product row for every
-- product whose primary-file columns were lost.
with primary_file as (
  select distinct on (f.product_id)
         f.product_id, f.file_path, f.file_size, f.scan_status
  from public.dkai_product_files f
  where f.file_path is not null
  order by f.product_id, f.created_at asc
)
update public.dkai_products p
set file_storage_key = pf.file_path,
    file_size_bytes  = coalesce(p.file_size_bytes, pf.file_size),
    file_scan_status = coalesce(p.file_scan_status, pf.scan_status)
from primary_file pf
where pf.product_id = p.id
  and p.file_storage_key is null;

-- Products delivered manually or via seller setup must have a delivery window.
update public.dkai_products
set delivery_time_hours = 24
where delivery_time_hours is null
  and delivery_mode in ('manual', 'setup');

NOTIFY pgrst, 'reload schema';
