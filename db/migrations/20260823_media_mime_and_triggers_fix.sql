-- 20260823_media_mime_and_triggers_fix.sql
-- Idempotent repair: allow all common image/video formats in product media buckets,
-- relax review_status CHECK, and stop the seller-agreement trigger from blocking
-- review_status updates (admin decisions / resubmissions).

BEGIN;

-- 1) Buckets: create if missing, then remove MIME restrictions and raise size limits
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-files', 'product-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-demo-videos', 'product-demo-videos', false)
ON CONFLICT (id) DO NOTHING;

-- NULL allowed_mime_types = accept any content type (jpg/png/webp/gif/avif/bmp/tiff/heic/svg, mp4/webm/mov/mkv/avi ...)
UPDATE storage.buckets
SET allowed_mime_types = NULL,
    file_size_limit = 524288000 -- 500 MB
WHERE id IN ('product-images', 'product-media');

UPDATE storage.buckets
SET allowed_mime_types = NULL,
    file_size_limit = 2576980378 -- ~2.4 GB
WHERE id IN ('product-files', 'product-demo-videos');

-- 2) Storage RLS for the public media buckets (owner-folder writes, public reads)
DROP POLICY IF EXISTS "dkai_product_media_read" ON storage.objects;
CREATE POLICY "dkai_product_media_read"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('product-images', 'product-media'));

DROP POLICY IF EXISTS "dkai_product_media_insert" ON storage.objects;
CREATE POLICY "dkai_product_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "dkai_product_media_update" ON storage.objects;
CREATE POLICY "dkai_product_media_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "dkai_product_media_delete" ON storage.objects;
CREATE POLICY "dkai_product_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('product-images', 'product-media')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) review_status: normalise legacy values and relax the CHECK
UPDATE public.dkai_products SET review_status = 'in_review'         WHERE review_status = 'pending_review';
UPDATE public.dkai_products SET review_status = 'changes_requested' WHERE review_status = 'changes-requested';

ALTER TABLE public.dkai_products DROP CONSTRAINT IF EXISTS dkai_products_review_status_check;
ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_review_status_check
  CHECK (
    review_status IS NULL OR review_status IN (
      'draft','submitted','in_review','approved','rejected','changes_requested','locked_exclusive'
    )
  ) NOT VALID;

-- 4) Seller-agreement trigger must not block review_status / media / file writes
DROP TRIGGER IF EXISTS dkai_products_require_seller_agreement ON public.dkai_products;

CREATE OR REPLACE FUNCTION public.dkai_require_seller_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted boolean;
BEGIN
  -- service_role (edge functions) and admins bypass the gate entirely
  IF current_setting('request.jwt.claims', true) IS NULL
     OR COALESCE(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.dkai_has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.seller_agreement_accepted, false)
    INTO accepted
  FROM public.dkai_profiles p
  WHERE p.user_id = NEW.seller_id;

  IF COALESCE(accepted, false) = false THEN
    RAISE EXCEPTION 'seller_agreement_not_accepted' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Only re-check the agreement on the seller's own content edits, never on status changes
CREATE TRIGGER dkai_products_require_seller_agreement
  BEFORE INSERT OR UPDATE OF title, description, price
  ON public.dkai_products
  FOR EACH ROW EXECUTE FUNCTION public.dkai_require_seller_agreement();

-- 5) Demo video requirement only at publish time
ALTER TABLE public.dkai_products DROP CONSTRAINT IF EXISTS dkai_products_demo_video_required;
ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_demo_video_required
  CHECK (
    COALESCE(is_published, false) = false
    OR NULLIF(btrim(COALESCE(demo_video_url, '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(demo_video_storage_path, '')), '') IS NOT NULL
    OR COALESCE(jsonb_array_length(COALESCE(demo_video_paths, '[]'::jsonb)), 0) > 0
  ) NOT VALID;

-- 6) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_product_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_product_files TO authenticated;
GRANT SELECT ON public.dkai_products TO anon;
GRANT ALL ON public.dkai_products TO service_role;
GRANT ALL ON public.dkai_product_media TO service_role;
GRANT ALL ON public.dkai_product_files TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
