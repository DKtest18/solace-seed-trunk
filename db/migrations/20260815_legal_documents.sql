-- =====================================================================
-- LEGAL DOCUMENTS (Seller Obligations PDF and future legal PDFs)
--
-- HOW TO UPLOAD THE PDF AFTER RUNNING THIS:
--   1. Supabase Dashboard -> Storage -> bucket "legal-documents"
--      (this migration creates it, private).
--   2. Upload your file as:  seller-obligations/Seller_Obligations.pdf
--   3. The INSERT at the bottom already points to that exact path.
--      If you upload under another name, update storage_path in
--      public.dkai_legal_documents accordingly.
-- =====================================================================

create table if not exists public.dkai_legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  version text not null,
  storage_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dkai_legal_documents_slug_version_key
  on public.dkai_legal_documents (slug, version);

grant select on public.dkai_legal_documents to anon, authenticated;
grant all on public.dkai_legal_documents to service_role;

alter table public.dkai_legal_documents enable row level security;

drop policy if exists "Anyone can read active legal documents" on public.dkai_legal_documents;
create policy "Anyone can read active legal documents"
on public.dkai_legal_documents
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins manage legal documents" on public.dkai_legal_documents;
create policy "Admins manage legal documents"
on public.dkai_legal_documents
for all
to authenticated
using (public.dkai_has_role(auth.uid(), 'admin'))
with check (public.dkai_has_role(auth.uid(), 'admin'));

-- ---------- storage bucket ------------------------------------------
insert into storage.buckets (id, name, public)
values ('legal-documents', 'legal-documents', false)
on conflict (id) do update set public = false;

-- Every signed-in user may READ (and create a signed download URL) for
-- legal PDFs. Only admins may upload/replace/delete them.
drop policy if exists "Authenticated can read legal documents" on storage.objects;
create policy "Authenticated can read legal documents"
on storage.objects
for select
to authenticated
using (bucket_id = 'legal-documents');

drop policy if exists "Admins write legal documents" on storage.objects;
create policy "Admins write legal documents"
on storage.objects
for all
to authenticated
using (bucket_id = 'legal-documents' and public.dkai_has_role(auth.uid(), 'admin'))
with check (bucket_id = 'legal-documents' and public.dkai_has_role(auth.uid(), 'admin'));

-- ---------- register the Seller Obligations PDF ----------------------
insert into public.dkai_legal_documents (slug, title, version, storage_path, is_active)
values (
  'seller_obligations',
  'Seller Obligations',
  '2026-08-15',
  'seller-obligations/Seller_Obligations.pdf',
  true
)
on conflict (slug, version) do update
  set storage_path = excluded.storage_path,
      title = excluded.title,
      is_active = true,
      updated_at = now();

-- ---------- track PDF acknowledgement on the profile -----------------
alter table public.dkai_profiles
  add column if not exists seller_obligations_pdf_acknowledged boolean not null default false,
  add column if not exists seller_obligations_pdf_version text;
