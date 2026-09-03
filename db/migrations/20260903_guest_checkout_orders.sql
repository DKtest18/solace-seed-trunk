-- =============================================================================
-- GUEST STRIPE CHECKOUT SUPPORT
-- Run this complete script in the standalone Supabase SQL editor.
-- Anonymous clients never insert orders directly; the checkout Edge Function
-- uses service_role after validating the product and Stripe account.
-- =============================================================================

BEGIN;

-- Registered buyers keep their auth.users reference. Guest orders store NULL
-- until Stripe Checkout returns the email in checkout.session.completed.
ALTER TABLE public.dkai_orders
  ALTER COLUMN buyer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_email text;

COMMENT ON COLUMN public.dkai_orders.buyer_id IS
  'Authenticated buyer UUID; NULL for guest Stripe/PayPal checkout.';

COMMENT ON COLUMN public.dkai_orders.guest_email IS
  'Guest email collected by the hosted payment provider; never trusted from the checkout request body.';

GRANT ALL ON public.dkai_orders TO service_role;

-- The public purchasability RPC is intentionally callable before login.
GRANT EXECUTE ON FUNCTION public.dkai_product_purchasable(uuid)
TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';