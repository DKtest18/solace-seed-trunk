-- =============================================================================
-- FINAL PUBLIC PRODUCT VISIBILITY + AUTO-PUBLISH + PURCHASABILITY FIX
-- Run this complete script once in the Supabase SQL editor.
-- It does not use Lovable Cloud and does not change private seller write rules.
-- =============================================================================

BEGIN;

-- 1. DATA API privileges. RLS below still decides which rows are visible.
GRANT SELECT ON public.dkai_products TO anon, authenticated;
GRANT ALL ON public.dkai_products TO service_role;

GRANT SELECT ON public.dkai_reviews TO anon, authenticated;
GRANT ALL ON public.dkai_reviews TO service_role;

GRANT SELECT ON public.dkai_profiles TO anon, authenticated;
GRANT ALL ON public.dkai_profiles TO service_role;

DO $grant_media$
BEGIN
  IF to_regclass('public.dkai_product_media') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.dkai_product_media TO anon, authenticated';
    EXECUTE 'GRANT ALL ON public.dkai_product_media TO service_role';
  END IF;
END
$grant_media$;

-- Existing policies may call dkai_has_role while evaluating a public SELECT.
-- Granting EXECUTE exposes only its boolean answer and prevents anon reads from
-- failing with "permission denied for function dkai_has_role".
DO $grant_role_check$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'dkai_has_role'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', fn.signature);
  END LOOP;
END
$grant_role_check$;

-- 2. Public visitors see only products approved by an admin and published.
ALTER TABLE public.dkai_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view approved products" ON public.dkai_products;
DROP POLICY IF EXISTS "Public can view published products" ON public.dkai_products;
CREATE POLICY "Public can view published products"
ON public.dkai_products
FOR SELECT
TO anon, authenticated
USING (
  review_status = 'approved'
  AND COALESCE(is_published, false) = true
  AND COALESCE(exclusive_locked, false) = false
);

ALTER TABLE public.dkai_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read reviews" ON public.dkai_reviews;
CREATE POLICY "Public can read reviews"
ON public.dkai_reviews
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.dkai_products p
    WHERE p.id = dkai_reviews.product_id
      AND p.review_status = 'approved'
      AND COALESCE(p.is_published, false) = true
      AND COALESCE(p.exclusive_locked, false) = false
  )
);

DO $media_policy$
BEGIN
  IF to_regclass('public.dkai_product_media') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.dkai_product_media ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public can read media of approved products" ON public.dkai_product_media';
    EXECUTE 'DROP POLICY IF EXISTS "Product media is readable by everyone" ON public.dkai_product_media';
    EXECUTE $policy$
      CREATE POLICY "Public can read media of approved products"
      ON public.dkai_product_media
      FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.dkai_products p
          WHERE p.id = dkai_product_media.product_id
            AND p.review_status = 'approved'
            AND COALESCE(p.is_published, false) = true
            AND COALESCE(p.exclusive_locked, false) = false
        )
      )
    $policy$;
  END IF;
END
$media_policy$;

-- 3. Replace the obsolete publish-readiness trigger body. It must never query
-- the removed dkai_product_delivery_files table or block an admin approval.
CREATE OR REPLACE FUNCTION public.dkai_check_publish_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN NEW;
END
$fn$;

-- 4. Every admin approval immediately publishes the listing.
CREATE OR REPLACE FUNCTION public.dkai_autopublish_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF COALESCE(NEW.review_status, '') = 'approved' THEN
    NEW.is_published := true;
    BEGIN NEW.approval_status := 'approved'; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.moderation_status := 'approved'; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.is_active := true; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.available := true; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.approved_at := COALESCE(NEW.approved_at, now()); EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.published_at := COALESCE(NEW.published_at, now()); EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN NEW.exclusive_locked := false; EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS dkai_autopublish_on_approval_trg ON public.dkai_products;
CREATE TRIGGER dkai_autopublish_on_approval_trg
BEFORE INSERT OR UPDATE OF review_status ON public.dkai_products
FOR EACH ROW
EXECUTE FUNCTION public.dkai_autopublish_on_approval();

-- Normalize existing approved rows without touching drafts/rejected products.
UPDATE public.dkai_products
SET is_published = true,
    exclusive_locked = COALESCE(exclusive_locked, false)
WHERE review_status = 'approved'
  AND (
    COALESCE(is_published, false) = false
    OR exclusive_locked IS NULL
  );

-- 5. Public, fail-closed purchase check. Account IDs are only an eligibility
-- hint; the checkout Edge Function must verify the Stripe account live.
CREATE OR REPLACE FUNCTION public.dkai_product_purchasable(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT EXISTS (
    SELECT 1
    FROM public.dkai_products p
    LEFT JOIN public.dkai_seller_payment_configs c ON c.seller_id = p.seller_id
    LEFT JOIN public.dkai_profiles pr ON pr.id = p.seller_id
    WHERE p.id = p_product_id
      AND p.review_status = 'approved'
      AND COALESCE(p.is_published, false) = true
      AND COALESCE(p.exclusive_locked, false) = false
      AND COALESCE(c.stripe_account_id, pr.stripe_account_id) IS NOT NULL
  );
$body$;

REVOKE ALL ON FUNCTION public.dkai_product_purchasable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_product_purchasable(uuid)
TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';