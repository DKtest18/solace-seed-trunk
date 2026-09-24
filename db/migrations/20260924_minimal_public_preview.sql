-- =============================================================================
-- MINIMAL PUBLIC PREVIEW (replaces 20260921b and 20260921c — do NOT run those)
-- Project: dwqpkdatzdqhplgyhigg. Additive / repeat-safe.
-- Requires 20260921_public_preview_pending_products.sql (consent columns,
-- lifecycle guard) to have run first.
-- =============================================================================
BEGIN;

-- 1) Remove automatic consent / automatic media publishing (from 21b / 21c).
DROP TRIGGER IF EXISTS dkai_preview_autoenable_trg ON public.dkai_products;
DROP TRIGGER IF EXISTS dkai_preview_media_autoflag_trg ON public.dkai_product_media;
DROP FUNCTION IF EXISTS public.dkai_preview_autoenable();
DROP FUNCTION IF EXISTS public.dkai_preview_media_autoflag();

-- 2) Minimal list: id, title, description, cover image, review status.
DROP FUNCTION IF EXISTS public.dkai_public_preview(uuid);
DROP FUNCTION IF EXISTS public.dkai_public_previews();
CREATE FUNCTION public.dkai_public_previews()
RETURNS TABLE (id uuid, title text, description text, image_url text, review_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $body$
  SELECT p.id,
         (x.j->>'title')::text,
         (x.j->>'description')::text,
         -- cover = first explicitly public IMAGE, never products.image_url
         (SELECT COALESCE(to_jsonb(m)->>'storage_path', to_jsonb(m)->>'path')
            FROM public.dkai_product_media m
           WHERE m.product_id = p.id AND m.is_public_preview = true
             AND COALESCE(to_jsonb(m)->>'media_type','') = 'image'
           ORDER BY COALESCE(NULLIF(to_jsonb(m)->>'sort_order','')::int, 0) LIMIT 1),
         (x.j->>'review_status')::text
  FROM public.dkai_products p
  CROSS JOIN LATERAL (SELECT to_jsonb(p) AS j) x
  WHERE p.public_preview_enabled = true
    AND p.public_preview_consented_at IS NOT NULL
    AND COALESCE(x.j->>'review_status','') IN ('submitted','in_review')
    AND COALESCE((x.j->>'is_active')::boolean, true) = true
    AND (x.j->>'deleted_at') IS NULL
  ORDER BY NULLIF(x.j->>'created_at','')::timestamptz DESC NULLS LAST;
$body$;

CREATE FUNCTION public.dkai_public_preview(p_product_id uuid)
RETURNS TABLE (id uuid, title text, description text, image_url text, review_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $body$ SELECT * FROM public.dkai_public_previews() v WHERE v.id = p_product_id; $body$;

-- 3) Preview media: explicitly flagged IMAGES only, never videos.
DROP FUNCTION IF EXISTS public.dkai_public_preview_media(uuid);
CREATE FUNCTION public.dkai_public_preview_media(p_product_id uuid)
RETURNS TABLE (id uuid, storage_path text, media_type text, sort_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $body$
  SELECT m.id,
         COALESCE(to_jsonb(m)->>'storage_path', to_jsonb(m)->>'path')::text,
         'image'::text,
         COALESCE(NULLIF(to_jsonb(m)->>'sort_order','')::int, 0)
  FROM public.dkai_product_media m
  WHERE m.product_id = p_product_id
    AND m.is_public_preview = true
    AND COALESCE(to_jsonb(m)->>'media_type','') = 'image'
    AND EXISTS (SELECT 1 FROM public.dkai_public_previews() v WHERE v.id = p_product_id)
  ORDER BY 4;
$body$;

REVOKE ALL ON FUNCTION public.dkai_public_previews() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dkai_public_preview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dkai_public_preview_media(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_public_previews() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_public_preview(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_public_preview_media(uuid) TO anon, authenticated, service_role;

-- 4) Consent RPC: owner seller only, images only, never videos. No role table.
DROP FUNCTION IF EXISTS public.dkai_set_public_preview_consent(uuid, boolean, boolean, text);
CREATE FUNCTION public.dkai_set_public_preview_consent(
  p_product_id uuid, p_enabled boolean,
  p_demo_video boolean DEFAULT false, p_source text DEFAULT 'seller')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.dkai_products p
    WHERE p.id = p_product_id AND NULLIF(to_jsonb(p)->>'seller_id','')::uuid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.dkai_products SET
    public_preview_enabled = COALESCE(p_enabled,false),
    public_preview_demo_video_allowed = false,
    public_preview_consented_at = CASE WHEN p_enabled THEN now() END,
    public_preview_consent_source = CASE WHEN p_enabled THEN left(COALESCE(p_source,'seller'),64) END
  WHERE id = p_product_id;

  UPDATE public.dkai_product_media m SET is_public_preview =
    COALESCE(p_enabled,false) AND COALESCE(to_jsonb(m)->>'media_type','') = 'image'
  WHERE m.product_id = p_product_id;
  RETURN COALESCE(p_enabled,false);
END $fn$;
REVOKE ALL ON FUNCTION public.dkai_set_public_preview_consent(uuid,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dkai_set_public_preview_consent(uuid,boolean,boolean,text) TO authenticated;

-- 5) Media table: remove the old "everyone reads everything" policy.
--    Approved-product policy (20260903) and seller-own policy stay.
DROP POLICY IF EXISTS "Product media is publicly readable" ON public.dkai_product_media;

COMMIT;

-- ---------------------------------------------------------------------------
-- 6) OPTIONAL CLEANUP — only if you already ran 21b/21c. It resets consent that
--    was set automatically (source written by those scripts). Check first:
-- SELECT public_preview_consent_source, count(*) FROM public.dkai_products
--  WHERE public_preview_enabled GROUP BY 1;
-- Then, for the auto-set sources shown (NOT seller_* sources):
-- UPDATE public.dkai_products SET public_preview_enabled=false,
--   public_preview_consented_at=NULL, public_preview_consent_source=NULL
--  WHERE public_preview_consent_source IN ('<auto source from query above>');
-- UPDATE public.dkai_product_media m SET is_public_preview=false
--  WHERE NOT EXISTS (SELECT 1 FROM public.dkai_products p
--                    WHERE p.id=m.product_id AND p.public_preview_enabled);

-- ---------------------------------------------------------------------------
-- 7) READ-ONLY CHECKS
-- SELECT tgname FROM pg_trigger WHERE tgname LIKE 'dkai_preview%';          -- only lifecycle_guard
-- SELECT policyname, qual FROM pg_policies WHERE tablename='dkai_product_media';
-- SELECT id, public FROM storage.buckets;                                     -- product-deliveries must be false
-- SELECT * FROM public.dkai_public_previews() LIMIT 5;                        -- 5 columns only
