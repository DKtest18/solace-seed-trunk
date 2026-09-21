-- =============================================================================
-- PUBLIC PREVIEWS FOR PRODUCTS AWAITING REVIEW  (schema-tolerant v2)
--
-- Fix for: ERROR 42703 column p.is_active does not exist
-- All optional columns are now read through to_jsonb(row), so the script works
-- no matter which optional columns your tables actually have.
--
-- Additive and repeat-safe. Run the whole file in the Supabase SQL Editor of
-- project dwqpkdatzdqhplgyhigg.
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

-- 3) Eligibility (schema-tolerant) -------------------------------------------
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
    CROSS JOIN LATERAL (SELECT to_jsonb(p) AS j) x
    WHERE p.id = p_product_id
      AND p.public_preview_enabled = true
      AND COALESCE(x.j->>'review_status', '') IN ('submitted', 'in_review')
      AND COALESCE((x.j->>'is_active')::boolean, true) = true
      AND (x.j->>'deleted_at') IS NULL
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
    (x.j->>'title')::text,
    (x.j->>'description')::text,
    (x.j->>'image_url')::text,
    NULLIF(x.j->>'price', '')::numeric,
    COALESCE(x.j->>'currency', 'USD')::text,
    (x.j->>'pricing_model')::text,
    (x.j->>'product_type')::text,
    NULLIF(x.j->>'category_id', '')::uuid,
    CASE WHEN jsonb_typeof(x.j->'tags') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(x.j->'tags'))
         ELSE NULL END,
    (x.j->>'delivery_mode')::text,
    CASE WHEN x.j ? 'setup_requirements' THEN x.j->'setup_requirements' ELSE NULL END,
    NULLIF(x.j->>'seller_id', '')::uuid,
    (y.pj->>'full_name')::text,
    (y.pj->>'username')::text,
    (y.pj->>'avatar_url')::text,
    COALESCE((y.pj->>'is_linkedin_verified')::boolean, false),
    COALESCE(p.public_preview_demo_video_allowed, false),
    NULLIF(x.j->>'submitted_at', '')::timestamptz,
    NULLIF(x.j->>'created_at', '')::timestamptz
  FROM public.dkai_products p
  CROSS JOIN LATERAL (SELECT to_jsonb(p) AS j) x
  LEFT JOIN public.dkai_profiles pr ON pr.id = NULLIF(x.j->>'seller_id', '')::uuid
  LEFT JOIN LATERAL (SELECT to_jsonb(pr) AS pj) y ON true
  WHERE p.public_preview_enabled = true
    AND COALESCE(x.j->>'review_status', '') IN ('submitted', 'in_review')
    AND COALESCE((x.j->>'is_active')::boolean, true) = true
    AND (x.j->>'deleted_at') IS NULL
  ORDER BY COALESCE(NULLIF(x.j->>'submitted_at','')::timestamptz,
                    NULLIF(x.j->>'created_at','')::timestamptz) DESC NULLS LAST;
$body$;

-- 5) Allowlisted single preview ----------------------------------------------
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
  SELECT
    m.id,
    COALESCE(mj.j->>'storage_path', mj.j->>'path', mj.j->>'file_path')::text,
    (mj.j->>'media_type')::text,
    (mj.j->>'mime_type')::text,
    COALESCE(NULLIF(mj.j->>'sort_order','')::integer, 0),
    COALESCE((mj.j->>'is_cover')::boolean, false)
  FROM public.dkai_product_media m
  CROSS JOIN LATERAL (SELECT to_jsonb(m) AS j) mj
  JOIN public.dkai_products p ON p.id = m.product_id
  WHERE m.product_id = p_product_id
    AND m.is_public_preview = true
    AND public.dkai_preview_eligible(p_product_id)
    -- videos need the separate explicit demo-video consent
    AND (COALESCE(mj.j->>'media_type','') <> 'video'
         OR COALESCE(p.public_preview_demo_video_allowed, false) = true)
  ORDER BY COALESCE(NULLIF(mj.j->>'sort_order','')::integer, 0) ASC;
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
  v_is_admin boolean := false;
BEGIN
  SELECT NULLIF(to_jsonb(p)->>'seller_id','')::uuid INTO v_owner
  FROM public.dkai_products p WHERE p.id = p_product_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'product not found or has no seller';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.dkai_user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin','super_admin')
  ) INTO v_is_admin;

  IF v_owner <> auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.dkai_products
  SET public_preview_enabled = COALESCE(p_enabled, false),
      public_preview_demo_video_allowed = COALESCE(p_enabled, false) AND COALESCE(p_demo_video, false),
      public_preview_consented_at = CASE WHEN COALESCE(p_enabled, false) THEN now() ELSE NULL END,
      public_preview_consent_source = CASE WHEN COALESCE(p_enabled, false) THEN p_source ELSE NULL END
  WHERE id = p_product_id;

  -- Mirror the media flag: consent covers images always, videos only when the
  -- separate demo-video permission is given.
  UPDATE public.dkai_product_media m
  SET is_public_preview = CASE
        WHEN COALESCE(p_enabled, false) = false THEN false
        WHEN COALESCE(to_jsonb(m)->>'media_type','') = 'video' THEN COALESCE(p_demo_video, false)
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
DECLARE
  j jsonb := to_jsonb(NEW);
BEGIN
  IF COALESCE(j->>'review_status', '') NOT IN ('submitted', 'in_review')
     OR COALESCE((j->>'is_active')::boolean, true) = false
     OR (j->>'deleted_at') IS NOT NULL THEN
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
-- a) SELECT count(*) FROM public.dkai_products WHERE public_preview_enabled;
-- b) SELECT count(*) FILTER (WHERE public_preview_enabled) AS preview_live,
--           count(*) FILTER (WHERE NOT public_preview_enabled) AS needs_confirmation
--    FROM public.dkai_products
--    WHERE COALESCE(to_jsonb(dkai_products)->>'review_status','') IN ('submitted','in_review');
-- c) SELECT * FROM public.dkai_public_previews();
-- d) SELECT id, public.dkai_product_purchasable(id) FROM public.dkai_public_previews();
-- e) SELECT * FROM public.dkai_public_preview_media('<product-uuid>');
