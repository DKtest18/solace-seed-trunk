-- Part 8 follow-up: persistent product media, multi demo videos, and
-- seller-only (admin-excluded) credential handover access.
-- Fully self-contained & idempotent: safe to run even if the earlier
-- 20260716_credentials_handover.sql migration was never applied.

-- ─────────────────────────────────────────────────────────────
-- 1) Product gallery media (uploaded immediately in the wizard)
-- ─────────────────────────────────────────────────────────────
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

ALTER TABLE public.dkai_product_media
  ADD COLUMN IF NOT EXISTS is_cover boolean NOT NULL DEFAULT false;

GRANT SELECT ON public.dkai_product_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_product_media TO authenticated;
GRANT ALL ON public.dkai_product_media TO service_role;
ALTER TABLE public.dkai_product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Product media is publicly readable" ON public.dkai_product_media;
CREATE POLICY "Product media is publicly readable"
ON public.dkai_product_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers manage own product media" ON public.dkai_product_media;
CREATE POLICY "Sellers manage own product media"
ON public.dkai_product_media FOR ALL TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_dkai_product_media_product
  ON public.dkai_product_media (product_id, sort_order);

-- ─────────────────────────────────────────────────────────────
-- 2) Multiple demo videos per product (up to 2.5 GB each)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS demo_video_url text,
  ADD COLUMN IF NOT EXISTS demo_video_storage_path text,
  ADD COLUMN IF NOT EXISTS demo_video_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill the array from the legacy single-path column.
UPDATE public.dkai_products
SET demo_video_paths = jsonb_build_array(demo_video_storage_path)
WHERE demo_video_storage_path IS NOT NULL
  AND btrim(demo_video_storage_path) <> ''
  AND demo_video_paths = '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 3) Storage policies used by the wizard
--    (buckets product-images / product-media must exist in Storage)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Sellers upload own gallery media" ON storage.objects;
CREATE POLICY "Sellers upload own gallery media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('product-images', 'product-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers manage own gallery media" ON storage.objects;
CREATE POLICY "Sellers manage own gallery media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('product-images', 'product-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers delete own gallery media" ON storage.objects;
CREATE POLICY "Sellers delete own gallery media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('product-images', 'product-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Public read gallery media" ON storage.objects;
CREATE POLICY "Public read gallery media"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-images', 'product-media'));

-- ─────────────────────────────────────────────────────────────
-- 4) Credential handover tables (created here if missing)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS requires_setup_credentials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS setup_access_window_hours integer NOT NULL DEFAULT 48;

CREATE TABLE IF NOT EXISTS public.dkai_credential_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.dkai_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.dkai_products(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spec_key text NOT NULL,
  spec_label text NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  access_expires_at timestamptz NOT NULL,
  purged_at timestamptz,
  purged_reason text,
  UNIQUE (order_id, spec_key)
);

CREATE TABLE IF NOT EXISTS public.dkai_credential_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.dkai_credential_handovers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS handover_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS handover_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS handover_purge_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_dkai_credential_handovers_expiry
  ON public.dkai_credential_handovers (access_expires_at)
  WHERE purged_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 5) Handover access: seller + buyer only, admins excluded
-- ─────────────────────────────────────────────────────────────
-- Buyer-entered credentials stay encrypted at rest (AES-256-GCM). The key lives
-- only in the DKAIM_HANDOVER_ENCRYPTION_KEY edge-function secret, so no DB role —
-- not even an admin — can read a credential value.
ALTER TABLE public.dkai_credential_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dkai_credential_access_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dkai_credential_handovers FROM anon;
GRANT SELECT ON public.dkai_credential_handovers TO authenticated;
GRANT ALL ON public.dkai_credential_handovers TO service_role;

REVOKE ALL ON public.dkai_credential_access_log FROM anon;
GRANT SELECT ON public.dkai_credential_access_log TO authenticated;
GRANT ALL ON public.dkai_credential_access_log TO service_role;

DROP POLICY IF EXISTS "Buyer reads own handovers" ON public.dkai_credential_handovers;
CREATE POLICY "Buyer reads own handovers"
ON public.dkai_credential_handovers FOR SELECT TO authenticated
USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Seller reads own product handovers" ON public.dkai_credential_handovers;
CREATE POLICY "Seller reads own product handovers"
ON public.dkai_credential_handovers FOR SELECT TO authenticated
USING (seller_id = auth.uid());

-- No admin policy on purpose. Any admin-oriented policy from an earlier run is dropped.
DROP POLICY IF EXISTS "Admins read handovers" ON public.dkai_credential_handovers;
DROP POLICY IF EXISTS "Admins manage handovers" ON public.dkai_credential_handovers;

DROP POLICY IF EXISTS "Buyer reads own credential audit" ON public.dkai_credential_access_log;
CREATE POLICY "Buyer reads own credential audit"
ON public.dkai_credential_access_log FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.dkai_credential_handovers h
  WHERE h.id = handover_id AND h.buyer_id = auth.uid()
));

DROP POLICY IF EXISTS "Seller reads own credential audit" ON public.dkai_credential_access_log;
CREATE POLICY "Seller reads own credential audit"
ON public.dkai_credential_access_log FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.dkai_credential_handovers h
  WHERE h.id = handover_id AND h.seller_id = auth.uid()
));

NOTIFY pgrst, 'reload schema';
