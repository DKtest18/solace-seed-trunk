-- =============================================================================
-- PUBLIC MARKETPLACE (guests) + PURCHASABILITY / "PRODUCT_NOT_AVAILABLE" FIX
-- Additive only. Run in the Supabase SQL editor.
--
-- 1) anon (no account) can READ approved listings + public seller info + reviews
-- 2) approved listings are published (is_published = true) so checkout stops
--    answering PRODUCT_NOT_AVAILABLE
-- 3) dkai_product_purchasable() = approved product + seller has a connected
--    Stripe (or PayPal) account. Never depends on is_published.
-- =============================================================================

-- ---------- 1. DATA API GRANTS ----------------------------------------------
GRANT SELECT ON public.dkai_products TO anon, authenticated;
GRANT ALL    ON public.dkai_products TO service_role;

GRANT SELECT ON public.dkai_reviews TO anon, authenticated;
GRANT ALL    ON public.dkai_reviews TO service_role;

GRANT SELECT ON public.dkai_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dkai_profiles TO authenticated;
GRANT ALL    ON public.dkai_profiles TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'dkai_product_media') THEN
    EXECUTE 'GRANT SELECT ON public.dkai_product_media TO anon, authenticated';
    EXECUTE 'GRANT ALL ON public.dkai_product_media TO service_role';
  END IF;
END $$;

-- ---------- 2. PUBLIC READ POLICIES (guests included) ------------------------
ALTER TABLE public.dkai_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view approved products" ON public.dkai_products;
CREATE POLICY "Public can view approved products"
ON public.dkai_products
FOR SELECT
TO anon, authenticated
USING (review_status IN ('approved', 'locked_exclusive'));

ALTER TABLE public.dkai_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read reviews" ON public.dkai_reviews;
CREATE POLICY "Public can read reviews"
ON public.dkai_reviews
FOR SELECT
TO anon, authenticated
USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'dkai_product_media') THEN
    EXECUTE 'ALTER TABLE public.dkai_product_media ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public can read media of approved products" ON public.dkai_product_media';
    EXECUTE $p$
      CREATE POLICY "Public can read media of approved products"
      ON public.dkai_product_media
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM public.dkai_products p
        WHERE p.id = dkai_product_media.product_id
          AND p.review_status IN ('approved','locked_exclusive')
      ))
    $p$;
  END IF;
END $$;

-- ---------- 3. NORMALISE LEGACY / NULL FLAGS ---------------------------------
DO $$
BEGIN
  -- Guests were losing rows where exclusive_locked was NULL instead of false.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='dkai_products' AND column_name='exclusive_locked') THEN
    UPDATE public.dkai_products SET exclusive_locked = false WHERE exclusive_locked IS NULL;
  END IF;

  -- Approved products must be live, otherwise checkout answers PRODUCT_NOT_AVAILABLE.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='dkai_products' AND column_name='is_published') THEN
    UPDATE public.dkai_products
       SET is_published = true
     WHERE review_status = 'approved'
       AND COALESCE(is_published, false) = false;
  END IF;
END $$;

-- ---------- 4. PURCHASABILITY (static, no is_published dependency) -----------
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
    LEFT JOIN public.dkai_profiles pr              ON pr.id      = p.seller_id
    WHERE p.id = p_product_id
      AND COALESCE(p.review_status, '') IN ('approved', 'locked_exclusive')
      AND (
        c.stripe_account_id IS NOT NULL
        OR c.paypal_merchant_id IS NOT NULL
        OR pr.stripe_account_id IS NOT NULL
      )
  );
$body$;

REVOKE ALL ON FUNCTION public.dkai_product_purchasable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_product_purchasable(uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
