-- =============================================================================
-- Fix: product gallery images/videos not saving.
--
-- Root cause of the "seller_agreement_not_accepted" error you saw: the
-- dkai_products trigger rejects any insert/update unless the seller's profile
-- has the CURRENT seller agreement version accepted. The wizard creates a draft
-- row before uploading media, so the draft insert failed and no media could be
-- attached. The app now routes such sellers to the account-level agreement gate.
--
-- This script makes storage + media rows correct and durable:
--   1. dkai_product_media table, grants, RLS (seller owns, public can read)
--   2. Storage policies for the product-images and product-media buckets
--   3. Media is NEVER cascade-deleted by product updates
-- Buckets must exist first (Supabase Dashboard > Storage):
--   product-images  -> PUBLIC, 10 MB per file
--   product-media   -> PUBLIC, 500 MB per file  (gallery videos, max 3 minutes)
-- =============================================================================

-- 1) Media table -------------------------------------------------------------
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS seller_agreement_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_agreement_version text,
  ADD COLUMN IF NOT EXISTS seller_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_obligations_pdf_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_obligations_pdf_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- The account-level acceptance screen writes these fields as the signed-in
-- profile owner. Without these explicit Data API grants, the UI can appear to
-- accept the agreement while the profile remains on an old version, causing
-- every product draft insert to fail with seller_agreement_not_accepted.
GRANT UPDATE (
  seller_agreement_accepted,
  seller_agreement_version,
  seller_agreement_accepted_at,
  seller_obligations_pdf_acknowledged,
  seller_obligations_pdf_version,
  terms_accepted,
  terms_accepted_at,
  updated_at
) ON public.dkai_profiles TO authenticated;
GRANT ALL ON public.dkai_profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.dkai_product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.dkai_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type text,
  size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dkai_product_media_product_idx
  ON public.dkai_product_media (product_id, sort_order);
CREATE INDEX IF NOT EXISTS dkai_product_media_seller_idx
  ON public.dkai_product_media (seller_id);

GRANT SELECT ON public.dkai_product_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_product_media TO authenticated;
GRANT ALL ON public.dkai_product_media TO service_role;

ALTER TABLE public.dkai_product_media ENABLE ROW LEVEL SECURITY;

-- Anyone (including logged-out visitors) can read media rows so galleries render.
DROP POLICY IF EXISTS "Product media is readable by everyone" ON public.dkai_product_media;
CREATE POLICY "Product media is readable by everyone"
  ON public.dkai_product_media FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only the owning seller writes/removes their own media rows.
DROP POLICY IF EXISTS "Sellers insert own product media" ON public.dkai_product_media;
CREATE POLICY "Sellers insert own product media"
  ON public.dkai_product_media FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dkai_products p
      WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers update own product media" ON public.dkai_product_media;
CREATE POLICY "Sellers update own product media"
  ON public.dkai_product_media FOR UPDATE
  TO authenticated
  USING (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dkai_products p
      WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dkai_products p
      WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers delete own product media" ON public.dkai_product_media;
CREATE POLICY "Sellers delete own product media"
  ON public.dkai_product_media FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());

-- 2) Storage policies --------------------------------------------------------
-- Upload path convention is "<auth.uid()>/<uuid>.<ext>" in both buckets.
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id IN ('product-images', 'product-media'));

DROP POLICY IF EXISTS "Owners upload product media files" ON storage.objects;
CREATE POLICY "Owners upload product media files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners update product media files" ON storage.objects;
CREATE POLICY "Owners update product media files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners delete product media files" ON storage.objects;
CREATE POLICY "Owners delete product media files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Legacy cover column stays available for listing cards -------------------
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS image_url text;

-- 4) Replace stale agreement triggers with the current authoritative check. --
-- Some older deployments raised the bare `seller_agreement_not_accepted`
-- error even after the UI had moved to agreement v4. Keep one trigger and one
-- shared version value so draft creation and media upload agree with the app.
CREATE OR REPLACE FUNCTION public.dkai_require_seller_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted boolean;
  accepted_version text;
BEGIN
  SELECT p.seller_agreement_accepted, p.seller_agreement_version
    INTO accepted, accepted_version
  FROM public.dkai_profiles p
  WHERE p.id = NEW.seller_id;

  IF coalesce(accepted, false) IS NOT TRUE
     OR coalesce(accepted_version, '') <> '2026-08-17-v4' THEN
    RAISE EXCEPTION 'seller_agreement_not_accepted'
      USING ERRCODE = 'P0001',
            HINT = 'Accept Seller Agreement version 2026-08-17-v4 before creating or updating a product.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dkai_products_require_seller_agreement ON public.dkai_products;
CREATE TRIGGER dkai_products_require_seller_agreement
  BEFORE INSERT OR UPDATE OF title, description, price, review_status
  ON public.dkai_products
  FOR EACH ROW
  EXECUTE FUNCTION public.dkai_require_seller_agreement();

NOTIFY pgrst, 'reload schema';
