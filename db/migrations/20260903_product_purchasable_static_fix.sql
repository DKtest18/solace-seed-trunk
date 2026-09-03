-- =============================================================================
-- FIX: dkai_product_purchasable was built DYNAMICALLY (20260816). If a column
-- did not exist at build time, that branch silently disappeared — sellers with
-- a fully connected Stripe account still showed "not purchasable".
--
-- This migration replaces it with a STATIC, explicit definition that reads the
-- canonical table public.dkai_seller_payment_configs (plus dkai_profiles as a
-- legacy fallback). Additive only: no DROP TABLE, no data change, no policy
-- change. CREATE OR REPLACE keeps the same signature/grants.
-- =============================================================================

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
    LEFT JOIN public.dkai_profiles pr             ON pr.id       = p.seller_id
    WHERE p.id = p_product_id
      AND COALESCE(p.review_status, '') IN ('approved', 'locked_exclusive')
      AND (
        -- Stripe via canonical payment config
        (c.stripe_account_id IS NOT NULL AND (
            COALESCE(c.charges_enabled, false)
         OR COALESCE(c.card_payments_enabled, false)
         OR COALESCE(c.stripe_onboarded, false)
         OR c.stripe_onboarding_status = 'connected'
         OR c.onboarding_status = 'connected'
        ))
        -- PayPal via canonical payment config
        OR (c.paypal_merchant_id IS NOT NULL AND (
            COALESCE(c.paypal_payments_receivable, false)
         OR c.paypal_onboarding_status = 'connected'
        ))
        -- Legacy fallback: Stripe id kept on the profile row
        OR (pr.stripe_account_id IS NOT NULL AND COALESCE(pr.stripe_onboarded, false))
      )
  );
$body$;

REVOKE ALL ON FUNCTION public.dkai_product_purchasable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_product_purchasable(uuid) TO anon, authenticated, service_role;

-- Diagnostic helper: shows WHY a product is / is not purchasable.
-- Admin-only, returns no secrets (only booleans + status strings).
CREATE OR REPLACE FUNCTION public.dkai_product_purchasable_debug(p_product_id uuid)
RETURNS TABLE (
  review_status text,
  has_stripe_account boolean,
  charges_enabled boolean,
  card_payments_enabled boolean,
  stripe_onboarding_status text,
  has_paypal boolean,
  paypal_onboarding_status text,
  purchasable boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.dkai_has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(p.review_status, '')::text,
    c.stripe_account_id IS NOT NULL,
    COALESCE(c.charges_enabled, false),
    COALESCE(c.card_payments_enabled, false),
    COALESCE(c.stripe_onboarding_status, '')::text,
    c.paypal_merchant_id IS NOT NULL,
    COALESCE(c.paypal_onboarding_status, '')::text,
    public.dkai_product_purchasable(p.id)
  FROM public.dkai_products p
  LEFT JOIN public.dkai_seller_payment_configs c ON c.seller_id = p.seller_id
  WHERE p.id = p_product_id;
END
$fn$;

REVOKE ALL ON FUNCTION public.dkai_product_purchasable_debug(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_product_purchasable_debug(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
