-- ============================================================================
-- 20260823_delivery_files_and_refund_ack.sql
-- Additive + idempotent. Safe to run repeatedly.
--
-- 1. Ensures the product row can record the primary delivery file
--    (storage key / size / scan status) written by the wizard.
-- 2. Adds the refund-policy acceptance timestamp column used by the admin
--    review dialog ("Refund policy accepted: Yes — <timestamp>").
-- 3. Confirms the private 'product-files' bucket stays private and admins can
--    READ it (read only, no admin write/delete).
-- Nothing here weakens an existing policy.
-- ============================================================================

-- ---------- 1. Product row columns -----------------------------------------
alter table public.dkai_products
  add column if not exists file_storage_key   text,
  add column if not exists file_size_bytes    bigint,
  add column if not exists file_scan_status   text,
  add column if not exists return_conditions  text,
  add column if not exists refund_policy      text;

-- ---------- 2. Refund-policy acceptance ------------------------------------
alter table public.dkai_products
  add column if not exists seller_ack_refund_policy    boolean not null default false,
  add column if not exists seller_ack_refund_policy_at timestamptz;

-- Sellers must be able to write these on their own rows (RLS already scopes
-- dkai_products writes to the owning seller; this is only a column grant).
grant update (
  file_storage_key,
  file_size_bytes,
  file_scan_status,
  return_conditions,
  refund_policy,
  seller_ack_refund_policy,
  seller_ack_refund_policy_at
) on public.dkai_products to authenticated;

-- ---------- 3. Delivery file bucket: private + admin READ only -------------
update storage.buckets set public = false where id = 'product-files';

do $$
begin
  if exists (select 1 from pg_proc where proname = 'dkai_has_role') then
    -- Admin read-only access to the private delivery bucket.
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

-- Sanity check helper for the reviewer: list what a product row now holds.
-- select id, title, file_storage_key, file_size_bytes, file_scan_status,
--        return_conditions, refund_policy,
--        seller_ack_refund_policy, seller_ack_refund_policy_at
-- from public.dkai_products order by created_at desc limit 20;

NOTIFY pgrst, 'reload schema';
