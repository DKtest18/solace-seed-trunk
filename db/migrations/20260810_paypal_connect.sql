-- =============================================================================
-- DK AI Marketplace — PayPal Commerce Platform (Partner Referrals) support
-- Phase 1: seller onboarding + connection status only.
-- Stripe behaviour is untouched.
-- =============================================================================

ALTER TABLE public.dkai_seller_payment_configs
  ADD COLUMN IF NOT EXISTS paypal_merchant_id            text,
  ADD COLUMN IF NOT EXISTS paypal_tracking_id            text,
  ADD COLUMN IF NOT EXISTS paypal_email                  text,
  ADD COLUMN IF NOT EXISTS paypal_onboarding_status      text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS paypal_payments_receivable    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_primary_email_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_partner_fee_granted    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_permissions_granted    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paypal_is_sandbox             boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS paypal_connected_at           timestamptz,
  ADD COLUMN IF NOT EXISTS paypal_last_synced_at         timestamptz,
  -- Which connected providers the seller lets buyers choose at checkout.
  ADD COLUMN IF NOT EXISTS accepts_stripe                boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_paypal                boolean DEFAULT true;

UPDATE public.dkai_seller_payment_configs
   SET accepts_stripe = COALESCE(accepts_stripe, true),
       accepts_paypal = COALESCE(accepts_paypal, true),
       paypal_onboarding_status = COALESCE(paypal_onboarding_status, 'not_connected');

CREATE UNIQUE INDEX IF NOT EXISTS dkai_seller_payment_configs_seller_id_key
  ON public.dkai_seller_payment_configs (seller_id);

CREATE INDEX IF NOT EXISTS dkai_seller_payment_configs_paypal_tracking_idx
  ON public.dkai_seller_payment_configs (paypal_tracking_id);

NOTIFY pgrst, 'reload schema';
