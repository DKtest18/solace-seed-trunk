-- ============================================================================
-- Public previews: enable for ALL products awaiting review (no seller-specific IDs)
-- Additive / idempotent. External Supabase project dwqpkdatzdqhplgyhigg.
-- Run AFTER 20260921_public_preview_pending_products.sql
-- ============================================================================

-- 1) New submissions get a public preview automatically
ALTER TABLE public.dkai_products
  ALTER COLUMN public_preview_enabled SET DEFAULT true;

-- 2) Turn previews on for every product currently submitted / in review
UPDATE public.dkai_products p
SET public_preview_enabled = true,
    public_preview_consented_at = COALESCE(p.public_preview_consented_at, now()),
    public_preview_consent_source = COALESCE(p.public_preview_consent_source, 'platform_default_all_sellers')
FROM (SELECT id, to_jsonb(dkai_products) AS j FROM public.dkai_products) x
WHERE x.id = p.id
  AND COALESCE(x.j->>'review_status', '') IN ('submitted', 'in_review')
  AND COALESCE((x.j->>'is_active')::boolean, true) = true
  AND (x.j->>'deleted_at') IS NULL
  AND COALESCE(p.public_preview_enabled, false) = false;

-- 3) Keep previews on automatically when a product enters review later
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
    IF NEW.public_preview_consented_at IS NULL THEN
      NEW.public_preview_consented_at := now();
      NEW.public_preview_consent_source := 'platform_default_all_sellers';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS dkai_preview_autoenable_trg ON public.dkai_products;
CREATE TRIGGER dkai_preview_autoenable_trg
BEFORE INSERT OR UPDATE ON public.dkai_products
FOR EACH ROW EXECUTE FUNCTION public.dkai_preview_autoenable();

-- 4) Anonymous visitors must be able to read the preview functions
GRANT EXECUTE ON FUNCTION public.dkai_public_previews() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_public_preview(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_public_preview_media(uuid) TO anon, authenticated, service_role;

-- 5) Verification
-- SELECT count(*) AS previews FROM public.dkai_public_previews();
