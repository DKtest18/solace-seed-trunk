-- ============================================================================
-- Public previews v3: show ALL preview images + demo videos + seller FAQ
-- Additive / idempotent. External Supabase project dwqpkdatzdqhplgyhigg.
-- Run AFTER 20260921_public_preview_pending_products.sql and 20260921b_*.sql
-- ============================================================================

BEGIN;

-- 1) Existing products in review: allow public demo video too -----------------
UPDATE public.dkai_products p
SET public_preview_demo_video_allowed = true
WHERE COALESCE(p.public_preview_enabled, false) = true
  AND COALESCE(p.public_preview_demo_video_allowed, false) = false;

-- 2) Flag ALL media rows of previewed products as public preview media -------
UPDATE public.dkai_product_media m
SET is_public_preview = true
FROM public.dkai_products p
WHERE p.id = m.product_id
  AND COALESCE(p.public_preview_enabled, false) = true
  AND COALESCE(m.is_public_preview, false) = false;

-- 3) Keep new media public automatically while the product is previewed ------
CREATE OR REPLACE FUNCTION public.dkai_preview_media_autoflag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dkai_products p
    WHERE p.id = NEW.product_id
      AND COALESCE(p.public_preview_enabled, false) = true
  ) THEN
    NEW.is_public_preview := true;
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS dkai_preview_media_autoflag_trg ON public.dkai_product_media;
CREATE TRIGGER dkai_preview_media_autoflag_trg
BEFORE INSERT OR UPDATE ON public.dkai_product_media
FOR EACH ROW EXECUTE FUNCTION public.dkai_preview_media_autoflag();

-- 4) Autoenable trigger: also consent to demo video for products in review ---
CREATE OR REPLACE FUNCTION public.dkai_preview_autoenable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  j jsonb := to_jsonb(NEW);
BEGIN
  IF COALESCE(j->>'review_status', '') IN ('submitted', 'in_review') THEN
    NEW.public_preview_enabled := true;
    NEW.public_preview_demo_video_allowed := true;
    IF NEW.public_preview_consented_at IS NULL THEN
      NEW.public_preview_consented_at := now();
      NEW.public_preview_consent_source := 'platform_default_all_sellers';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;

-- 5) Preview payload now includes seller FAQ + demo video references ---------
DROP FUNCTION IF EXISTS public.dkai_public_preview(uuid);
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
  faqs jsonb,
  demo_video_url text,
  demo_video_paths jsonb,
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
    CASE WHEN jsonb_typeof(x.j->'faqs') = 'array' THEN x.j->'faqs' ELSE '[]'::jsonb END,
    CASE WHEN COALESCE(p.public_preview_demo_video_allowed, false)
         THEN (x.j->>'demo_video_url')::text ELSE NULL END,
    CASE WHEN COALESCE(p.public_preview_demo_video_allowed, false)
              AND jsonb_typeof(x.j->'demo_video_paths') = 'array'
         THEN x.j->'demo_video_paths' ELSE '[]'::jsonb END,
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
  faqs jsonb,
  demo_video_url text,
  demo_video_paths jsonb,
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

-- 6) Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.dkai_public_previews() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dkai_public_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_public_previews() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_public_preview(uuid) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verification:
-- SELECT id, title, jsonb_array_length(faqs) AS faq_count,
--        jsonb_array_length(demo_video_paths) AS demo_videos
-- FROM public.dkai_public_previews();
-- SELECT * FROM public.dkai_public_preview_media('<product-uuid>');
