-- =====================================================================
-- ADMIN-ONLY ACCESS TO PRODUCT SUBMISSIONS + UPLOADED DELIVERY FILES
-- Run this in the Supabase SQL editor.
--
-- Result:
--   * Everything a seller typed into the product wizard (all steps) is
--     readable in full ONLY by the seller who owns it and by admins.
--   * Buyers/guests keep reading only APPROVED products (public listings).
--   * dkai_product_files rows: seller (own) + admins only.
--   * Storage objects in the private 'product-files' bucket: seller (own
--     folder) + admins. Admins can therefore download every file.
-- =====================================================================

-- ---------- 1. PRODUCTS ----------------------------------------------
alter table public.dkai_products enable row level security;

-- drop older/looser read policies if they exist
drop policy if exists "Public can view approved products" on public.dkai_products;
drop policy if exists "Anyone can view products" on public.dkai_products;
drop policy if exists "Sellers can view own products" on public.dkai_products;
drop policy if exists "Admins can view all products" on public.dkai_products;

-- public / guests / buyers: approved listings only
create policy "Public can view approved products"
on public.dkai_products
for select
to anon, authenticated
using (review_status = 'approved' or review_status = 'locked_exclusive');

-- seller: full access to their own submissions (drafts + pending)
create policy "Sellers can view own products"
on public.dkai_products
for select
to authenticated
using (seller_id = auth.uid());

-- admin: everything, in every state
create policy "Admins can view all products"
on public.dkai_products
for select
to authenticated
using (public.dkai_has_role(auth.uid(), 'admin'));

-- ---------- 2. PRODUCT FILE METADATA --------------------------------
alter table public.dkai_product_files enable row level security;

revoke all on public.dkai_product_files from anon;
grant select, insert, delete on public.dkai_product_files to authenticated;
grant all on public.dkai_product_files to service_role;

drop policy if exists "Buyers can view purchased product files" on public.dkai_product_files;
drop policy if exists "Sellers manage own product files" on public.dkai_product_files;
drop policy if exists "Admins can view all product files" on public.dkai_product_files;

create policy "Sellers manage own product files"
on public.dkai_product_files
for all
to authenticated
using (
  exists (
    select 1 from public.dkai_products p
    where p.id = dkai_product_files.product_id
      and p.seller_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.dkai_products p
    where p.id = dkai_product_files.product_id
      and p.seller_id = auth.uid()
  )
);

create policy "Admins can view all product files"
on public.dkai_product_files
for select
to authenticated
using (public.dkai_has_role(auth.uid(), 'admin'));

-- ---------- 3. STORAGE: private 'product-files' bucket ---------------
-- The bucket must stay PRIVATE. Buyer downloads keep working because they
-- go through the edge functions (service_role), which bypass RLS.
update storage.buckets set public = false where id = 'product-files';

drop policy if exists "Sellers manage own product file objects" on storage.objects;
drop policy if exists "Admins read all product file objects" on storage.objects;

-- seller: only their own top-level folder (folder name = auth.uid())
create policy "Sellers manage own product file objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'product-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'product-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- admin: read + download every uploaded product file
create policy "Admins read all product file objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-files'
  and public.dkai_has_role(auth.uid(), 'admin')
);
