-- ============================================================================
-- STEP 1 — Additive schema for SEPARATE CHARGES AND TRANSFERS (7-day hold)
-- Safe to run multiple times. No column is dropped, no data is deleted.
-- No escrow logic is reintroduced: escrow_status stays unused.
-- ============================================================================

-- 1) Order-level transfer tracking -------------------------------------------
ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS stripe_charge_id        text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_group   text,
  ADD COLUMN IF NOT EXISTS charge_mode             text NOT NULL DEFAULT 'destination',
  ADD COLUMN IF NOT EXISTS sale_completed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_eligible_at    timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_state          text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS transfer_amount         numeric(12,2),
  ADD COLUMN IF NOT EXISTS transfer_initiated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_attempts       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_last_error     text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_reversal_id text,
  ADD COLUMN IF NOT EXISTS transfer_destination_account text,
  ADD COLUMN IF NOT EXISTS platform_fee_percent_locked numeric(5,2),
  ADD COLUMN IF NOT EXISTS refunded_at             timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount           numeric(12,2),
  ADD COLUMN IF NOT EXISTS stripe_refund_id        text,
  ADD COLUMN IF NOT EXISTS seller_debt_amount      numeric(12,2) NOT NULL DEFAULT 0;

-- charge_mode: 'destination' = legacy pre-migration charges (money already at seller)
--              'separate'    = new platform charge, transfer happens later
ALTER TABLE public.dkai_orders DROP CONSTRAINT IF EXISTS dkai_orders_charge_mode_chk;
ALTER TABLE public.dkai_orders
  ADD CONSTRAINT dkai_orders_charge_mode_chk
  CHECK (charge_mode IN ('destination', 'separate'));

-- transfer_state lifecycle:
--   not_applicable -> pending -> eligible -> in_progress -> completed
--                                          \-> failed (retryable)
--                                          \-> blocked (refund/dispute)
--                                          \-> reversed
ALTER TABLE public.dkai_orders DROP CONSTRAINT IF EXISTS dkai_orders_transfer_state_chk;
ALTER TABLE public.dkai_orders
  ADD CONSTRAINT dkai_orders_transfer_state_chk
  CHECK (transfer_state IN (
    'not_applicable','pending','eligible','in_progress',
    'completed','failed','blocked','reversed'
  ));

CREATE INDEX IF NOT EXISTS idx_dkai_orders_transfer_due
  ON public.dkai_orders (transfer_eligible_at)
  WHERE transfer_state IN ('pending','eligible','failed');

CREATE INDEX IF NOT EXISTS idx_dkai_orders_transfer_state
  ON public.dkai_orders (transfer_state, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_orders_stripe_transfer_id
  ON public.dkai_orders (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

-- 2) Hold window configuration ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_transfer_config (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),
  hold_days     integer NOT NULL DEFAULT 7 CHECK (hold_days BETWEEN 0 AND 90),
  transfers_enabled boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dkai_transfer_config (id, hold_days)
VALUES (true, 7)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.dkai_transfer_config TO authenticated;
GRANT ALL    ON public.dkai_transfer_config TO service_role;

ALTER TABLE public.dkai_transfer_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfer_config_admin_read" ON public.dkai_transfer_config;
CREATE POLICY "transfer_config_admin_read"
  ON public.dkai_transfer_config FOR SELECT TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- 3) Transfer attempt audit log ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_transfer_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES public.dkai_orders(id) ON DELETE CASCADE,
  seller_id         uuid,
  destination_account text,
  amount            numeric(12,2),
  currency          text NOT NULL DEFAULT 'chf',
  idempotency_key   text,
  stripe_transfer_id text,
  outcome           text NOT NULL CHECK (outcome IN ('success','failure','skipped')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dkai_transfer_attempts_order
  ON public.dkai_transfer_attempts (order_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_transfer_attempts_idem
  ON public.dkai_transfer_attempts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

GRANT ALL ON public.dkai_transfer_attempts TO service_role;
ALTER TABLE public.dkai_transfer_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfer_attempts_admin_read" ON public.dkai_transfer_attempts;
CREATE POLICY "transfer_attempts_admin_read"
  ON public.dkai_transfer_attempts FOR SELECT TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- 4) Seller payout capability (cross-border readiness) ----------------------
ALTER TABLE public.dkai_seller_payment_configs
  ADD COLUMN IF NOT EXISTS transfers_capability_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_account_country      text,
  ADD COLUMN IF NOT EXISTS stripe_default_currency     text,
  ADD COLUMN IF NOT EXISTS capabilities_synced_at      timestamptz;

-- 5) Refund requests: know which side the money is on ----------------------
ALTER TABLE public.dkai_refund_requests
  ADD COLUMN IF NOT EXISTS transfer_reversed          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_transfer_reversal_id text,
  ADD COLUMN IF NOT EXISTS seller_debt_recorded       numeric(12,2);

-- 6) Backfill: every EXISTING order was a destination charge ---------------
-- Money already reached the connected account at charge time, so these must
-- never be transferred again.
UPDATE public.dkai_orders
SET charge_mode    = 'destination',
    transfer_state = 'not_applicable'
WHERE charge_mode IS DISTINCT FROM 'separate'
  AND transfer_state NOT IN ('completed','reversed');

-- Freeze the historic fee percentage where we can derive it, so reporting
-- stays stable once the founding-seller counters move on.
UPDATE public.dkai_orders
SET platform_fee_percent_locked = ROUND((platform_fee / NULLIF(price, 0)) * 100, 2)
WHERE platform_fee_percent_locked IS NULL
  AND price IS NOT NULL AND price > 0
  AND platform_fee IS NOT NULL;

-- 7) Helper: mark an order sale-complete and start the hold clock ----------
CREATE OR REPLACE FUNCTION public.dkai_start_transfer_hold(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _days integer;
BEGIN
  SELECT hold_days INTO _days FROM public.dkai_transfer_config WHERE id = true;
  _days := COALESCE(_days, 7);

  UPDATE public.dkai_orders
  SET sale_completed_at    = COALESCE(sale_completed_at, now()),
      transfer_eligible_at = COALESCE(transfer_eligible_at, now() + (_days || ' days')::interval),
      transfer_state       = CASE
                               WHEN transfer_state IN ('completed','reversed','blocked') THEN transfer_state
                               ELSE 'pending'
                             END
  WHERE id = _order_id
    AND charge_mode = 'separate';
END;
$$;

REVOKE ALL ON FUNCTION public.dkai_start_transfer_hold(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_start_transfer_hold(uuid) TO service_role;

-- 8) Admin read view for the payout dashboard ------------------------------
CREATE OR REPLACE VIEW public.dkai_order_transfer_status AS
SELECT
  o.id AS order_id,
  o.seller_id,
  o.product_id,
  o.price,
  o.platform_fee,
  o.seller_earnings,
  o.charge_mode,
  o.transfer_state,
  o.sale_completed_at,
  o.transfer_eligible_at,
  o.transfer_completed_at,
  o.transfer_amount,
  o.transfer_attempts,
  o.transfer_last_error,
  o.stripe_charge_id,
  o.stripe_transfer_id,
  o.stripe_refund_id,
  o.seller_debt_amount
FROM public.dkai_orders o;

GRANT SELECT ON public.dkai_order_transfer_status TO authenticated;
GRANT SELECT ON public.dkai_order_transfer_status TO service_role;
