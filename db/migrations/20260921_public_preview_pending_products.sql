-- =============================================================================
-- PUBLIC PREVIEWS FOR PRODUCTS AWAITING REVIEW
--
-- Additive and repeat-safe. Run the whole file in the Supabase SQL Editor of
-- project dwqpkdatzdqhplgyhigg. It does NOT touch existing rows' data except
-- adding new columns with safe defaults (preview OFF for everyone).
--
-- Design:
--   * Consent lives on NEW columns, completely separate from review_status.
--     Enabling a preview never approves a product and never marks payouts ready.
--   * Visitors never read dkai_products directly for previews. They call
--     SECURITY DEFINER functions that return an explicit ALLOWLIST of public
--     fields only. Private columns can never reach the browser.
--   * No storage bucket is made public. Only media rows explicitly flagged
--     `is_public_preview` are returned for previews.
--   * Purchasability is untouched: public.dkai_product_purchasable still
--     requires approval + a connected, ready payout account, so previews can
--     never be bought — including guest checkout and direct API calls.
-- =============================================================================

BEGIN;

-- 1) Consent columns (default OFF — no consent is ever assumed) --------------
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS public_preview_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_preview_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_preview_consent_source text,
  ADD COLUMN IF NOT EXISTS public_preview_demo_video_allowed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dkai_products.public_preview_enabled IS
  'Seller consent to show a public, non-purchasable preview while awaiting review. Independent of review_status.';
COMMENT ON COLUMN public.dkai_products.public_preview_demo_video_allowed IS
  'Separate, explicit consent for public demo video. Internal review videos stay private.';

-- 2) Public-preview flag on media (default OFF) -------------------------------
ALTER TABLE public.dkai_product_media
  ADD COLUMN IF NOT EXISTS is_public_preview boolean NOT NULL DEFAULT false;

-- 3) Eligibility: genuinely submitted / in review, consented, alive ----------
CREATE OR REPLACE FUNCTION public.dkai_preview_eligible(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT EXISTS (
    SELECT 1
    FROM public.dkai_products p
    WHERE p.id = p_product_id
      AND p.public_preview_enabled = true
      AND COALESCE(p.review_status, '') IN ('submitted', 'in_review')
      AND COALESCE(p.is_active, true) = true
      AND p.deleted_at IS NULL
  );
$body$;

-- 4) Allowlisted public preview list -----------------------------------------
DROP FUNCTION IF EXISTS public.dkai_public_previews();
CREATE FUNCTION public.dkai_public_previews()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  image_url text,
  price numeric,
  currency text,
  pricing_model text,
  product_type text,
  category_id uuid,
  tags text[],
  delivery_mode text,
  setup_requirements jsonb,
  seller_id uuid,
  seller_name text,
  seller_username text,
  seller_avatar_url text,
  seller_linkedin_verified boolean,
  demo_video_allowed boolean,
  submitted_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT
    p.id,
    p.title,
    p.description,
    p.image_url,
    p.price,
    COALESCE(p.currency, 'USD')::text,
    p.pricing_model::text,
    p.product_type::text,
    p.category_id,
    p.tags,
    p.delivery_mode::text,
    to_jsonb(p.setup_requirements),
    p.seller_id,
    pr.full_name::text,
    pr.username::text,
    pr.avatar_url::text,
    COALESCE(pr.is_linkedin_verified, false),
    COALESCE(p.public_preview_demo_video_allowed, false),
    p.submitted_at,
    p.created_at
  FROM public.dkai_products p
  LEFT JOIN public.dkai_profiles pr ON pr.id = p.seller_id
  WHERE p.public_preview_enabled = true
    AND COALESCE(p.review_status, '') IN ('submitted', 'in_review')
    AND COALESCE(p.is_active, true) = true
    AND p.deleted_at IS NULL
  ORDER BY COALESCE(p.submitted_at, p.created_at) DESC;
$body$;

-- 5) Allowlisted single preview ----------------------------------------------
DROP FUNCTION IF EXISTS public.dkai_public_preview(uuid);
CREATE FUNCTION public.dkai_public_preview(p_product_id uuid)
RETURNS SETOF public.dkai_products
LANGUAGE sql
STABLE
AS $body$
  SELECT * FROM public.dkai_products WHERE false;
$body$;
DROP FUNCTION IF EXISTS public.dkai_public_preview(uuid);

CREATE FUNCTION public.dkai_public_preview(p_product_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  image_url text,
  price numeric,
  currency text,
  pricing_model text,
  product_type text,
  category_id uuid,
  tags text[],
  delivery_mode text,
  setup_requirements jsonb,
  seller_id uuid,
  seller_name text,
  seller_username text,
  seller_avatar_url text,
  seller_linkedin_verified boolean,
  demo_video_allowed boolean,
  submitted_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT * FROM public.dkai_public_previews() v WHERE v.id = p_product_id;
$body$;

-- 6) Public preview media: only rows explicitly flagged public ---------------
DROP FUNCTION IF EXISTS public.dkai_public_preview_media(uuid);
CREATE FUNCTION public.dkai_public_preview_media(p_product_id uuid)
RETURNS TABLE (
  id uuid,
  storage_path text,
  media_type text,
  mime_type text,
  sort_order integer,
  is_cover boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT m.id, m.storage_path::text, m.media_type::text, m.mime_type::text,
         m.sort_order, COALESCE(m.is_cover, false)
  FROM public.dkai_product_media m
  JOIN public.dkai_products p ON p.id = m.product_id
  WHERE m.product_id = p_product_id
    AND m.is_public_preview = true
    AND public.dkai_preview_eligible(p_product_id)
    -- videos need the separate explicit demo-video consent
    AND (m.media_type <> 'video' OR COALESCE(p.public_preview_demo_video_allowed, false) = true)
  ORDER BY m.sort_order ASC;
$body$;

-- 7) Seller-side consent RPC (own products only, never changes review state) --
DROP FUNCTION IF EXISTS public.dkai_set_public_preview_consent(uuid, boolean, boolean, text);
CREATE FUNCTION public.dkai_set_public_preview_consent(
  p_product_id uuid,
  p_enabled boolean,
  p_demo_video boolean DEFAULT false,
  p_source text DEFAULT 'seller_submission_acknowledgement'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_owner uuid;
BEGIN
  SELECT seller_id INTO v_owner FROM public.dkai_products WHERE id = p_product_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'product not found';
  END IF;
  IF v_owner <> auth.uid() AND NOT public.dkai_has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.dkai_products
  SET public_preview_enabled = COALESCE(p_enabled, false),
      public_preview_demo_video_allowed = COALESCE(p_enabled, false) AND COALESCE(p_demo_video, false),
      -- real entry timestamp; cleared on withdrawal
      public_preview_consented_at = CASE WHEN COALESCE(p_enabled, false) THEN now() ELSE NULL END,
      public_preview_consent_source = CASE WHEN COALESCE(p_enabled, false) THEN p_source ELSE NULL END
  WHERE id = p_product_id;

  -- Mirror the media flag: consent covers images always, videos only when the
  -- separate demo-video permission is given.
  UPDATE public.dkai_product_media m
  SET is_public_preview = CASE
        WHEN COALESCE(p_enabled, false) = false THEN false
        WHEN m.media_type = 'video' THEN COALESCE(p_demo_video, false)
        ELSE true
      END
  WHERE m.product_id = p_product_id;

  RETURN COALESCE(p_enabled, false);
END
$fn$;

-- 8) Lifecycle safety: leaving submitted/in_review kills the preview ---------
CREATE OR REPLACE FUNCTION public.dkai_preview_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF COALESCE(NEW.review_status, '') NOT IN ('submitted', 'in_review')
     OR COALESCE(NEW.is_active, true) = false
     OR NEW.deleted_at IS NOT NULL THEN
    NEW.public_preview_enabled := false;
    NEW.public_preview_demo_video_allowed := false;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS dkai_preview_lifecycle_guard_trg ON public.dkai_products;
CREATE TRIGGER dkai_preview_lifecycle_guard_trg
BEFORE INSERT OR UPDATE ON public.dkai_products
FOR EACH ROW EXECUTE FUNCTION public.dkai_preview_lifecycle_guard();

-- 9) Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.dkai_public_previews() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dkai_public_preview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dkai_public_preview_media(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dkai_preview_eligible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dkai_set_public_preview_consent(uuid, boolean, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.dkai_public_previews() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_public_preview(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_public_preview_media(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_preview_eligible(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_set_public_preview_consent(uuid, boolean, boolean, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION QUERIES (run separately, read-only)
-- =============================================================================
-- a) No consent was invented — must return 0 before any seller confirms:
-- SELECT count(*) FROM public.dkai_products WHERE public_preview_enabled;
--
-- b) How many existing submissions are eligible vs. still need confirmation:
-- SELECT
--   count(*) FILTER (WHERE public_preview_enabled)        AS preview_live,
--   count(*) FILTER (WHERE NOT public_preview_enabled)    AS needs_confirmation
-- FROM public.dkai_products
-- WHERE COALESCE(review_status,'') IN ('submitted','in_review')
--   AND COALESCE(is_active,true) AND deleted_at IS NULL;
--
-- c) Public API returns only allowlisted fields and only eligible rows:
-- SELECT * FROM public.dkai_public_previews();
--
-- d) A preview can never be purchased (must be false for every preview id):
-- SELECT id, public.dkai_product_purchasable(id) FROM public.dkai_public_previews();
--
-- e) No private media leaks (must return 0 rows for a product without consent):
-- SELECT * FROM public.dkai_public_preview_media('<product-uuid>');
