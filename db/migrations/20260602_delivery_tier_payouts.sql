-- =============================================================================
-- DK AI Marketplace — Delivery Tier Payout Flow
-- Adds escrow/payout columns to dkai_orders so Stripe Connect destination
-- charges can hold the seller payout per tier while the 5% platform fee is
-- ALWAYS captured at charge time.
--
-- Tier windows (must resolve <90 days — Swiss Stripe limit):
--   tier1 = instant      → payout_status='pending' (normal Stripe payout)
--   tier2 = protected    → payout_status='held', auto_release in 7 days
--   tier3 = direct       → payout_status='held', auto_release in 14 days
-- =============================================================================

-- 1. New columns on dkai_orders ------------------------------------------------
ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS payout_status text
    NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending','held','released','auto_released','refunded','disputed')),
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_release_at    timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_opened_at  timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_tier      text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS application_fee_amount numeric,
  ADD COLUMN IF NOT EXISTS eu_withdrawal_waiver_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_marked_delivered_at timestamptz;

-- Backfill delivery_tier on existing orders from product
UPDATE public.dkai_orders o
SET delivery_tier = p.delivery_tier
FROM public.dkai_products p
WHERE o.product_id = p.id
  AND o.delivery_tier IS NULL
  AND p.delivery_tier IS NOT NULL;

-- 2. Cron-relevant indexes -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_dkai_orders_payout_release
  ON public.dkai_orders (payout_status, auto_release_at)
  WHERE payout_status = 'held';

CREATE INDEX IF NOT EXISTS idx_dkai_orders_tier
  ON public.dkai_orders (delivery_tier);

-- 3. Config table for per-tier release windows --------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_payout_config (
  tier text PRIMARY KEY CHECK (tier IN ('tier1','tier2','tier3')),
  auto_release_days int NOT NULL CHECK (auto_release_days BETWEEN 1 AND 85),
  dispute_window_days int NOT NULL CHECK (dispute_window_days BETWEEN 1 AND 85),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dkai_payout_config TO anon, authenticated;
GRANT ALL ON public.dkai_payout_config TO service_role;

ALTER TABLE public.dkai_payout_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_config_read_all" ON public.dkai_payout_config;
CREATE POLICY "payout_config_read_all"
  ON public.dkai_payout_config FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "payout_config_admin_write" ON public.dkai_payout_config;
CREATE POLICY "payout_config_admin_write"
  ON public.dkai_payout_config FOR ALL
  TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'))
  WITH CHECK (public.dkai_has_role(auth.uid(), 'admin'));

INSERT INTO public.dkai_payout_config (tier, auto_release_days, dispute_window_days) VALUES
  ('tier1', 0,  0),
  ('tier2', 7,  7),
  ('tier3', 14, 14)
ON CONFLICT (tier) DO NOTHING;

-- 4. Schedule auto-release cron (pg_cron) -------------------------------------
-- Run hourly; the auto-release-payouts edge function processes due orders.
-- Requires the vault secret 'service_role_key' to exist (set via dashboard).
DO $$
DECLARE
  v_proj text := current_setting('app.settings.project_url', true);
BEGIN
  IF v_proj IS NULL THEN
    RAISE NOTICE 'app.settings.project_url not set — schedule cron manually.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('dkai-auto-release-payouts')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='dkai-auto-release-payouts');

  PERFORM cron.schedule(
    'dkai-auto-release-payouts',
    '17 * * * *',  -- every hour at :17
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='service_role_key'), 'Content-Type','application/json'),
        body := '{}'::jsonb
      );
    $cmd$, v_proj || '/functions/v1/auto-release-payouts')
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron schedule skipped: %', SQLERRM;
END $$;
