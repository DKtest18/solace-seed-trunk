-- ============================================================================
-- STEP 2 — Separate charges & transfers: financial ledger, 7-day hold,
-- concurrency-safe founding-seller benefit, worker claim/lease.
--
-- Additive and idempotent. Nothing is dropped, no order data is deleted.
-- Run AFTER db/migrations/20260905_separate_charges_transfers.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Columns missing from step 1 + the money ledger on dkai_orders (minor units)
-- ---------------------------------------------------------------------------
ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS stripe_transfer_id          text,
  ADD COLUMN IF NOT EXISTS stripe_platform_account_id  text,
  ADD COLUMN IF NOT EXISTS livemode                    boolean,
  ADD COLUMN IF NOT EXISTS currency                    text NOT NULL DEFAULT 'chf',
  ADD COLUMN IF NOT EXISTS paid_at                     timestamptz,
  ADD COLUMN IF NOT EXISTS gross_amount_minor          bigint,
  ADD COLUMN IF NOT EXISTS commission_rate             numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_amount_minor     bigint,
  ADD COLUMN IF NOT EXISTS processing_fee_minor        bigint,
  ADD COLUMN IF NOT EXISTS processing_fee_bearer       text NOT NULL DEFAULT 'seller',
  ADD COLUMN IF NOT EXISTS seller_entitlement_minor    bigint,
  ADD COLUMN IF NOT EXISTS stripe_balance_transaction_id text,
  ADD COLUMN IF NOT EXISTS refunded_amount_minor       bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversed_amount_minor       bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_debt_minor           bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS founding_benefit_applied    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_locked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_state               text,
  ADD COLUMN IF NOT EXISTS transfer_idempotency_key    text,
  ADD COLUMN IF NOT EXISTS transfer_request_params     jsonb,
  ADD COLUMN IF NOT EXISTS transfer_lease_until        timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_next_attempt_at    timestamptz;

ALTER TABLE public.dkai_orders DROP CONSTRAINT IF EXISTS dkai_orders_fee_bearer_chk;
ALTER TABLE public.dkai_orders
  ADD CONSTRAINT dkai_orders_fee_bearer_chk
  CHECK (processing_fee_bearer IN ('seller', 'platform'));


-- Keep the legacy label but make it explicit: older Stripe checkouts were
-- platform-created Connect destination charges (application_fee_amount +
-- transfer_data.destination, no Stripe-Account header). `direct` is reserved
-- only for any separately verified historical object that was actually created
-- on a connected account; the current repo history did not show that pattern.
ALTER TABLE public.dkai_orders DROP CONSTRAINT IF EXISTS dkai_orders_charge_mode_chk;
ALTER TABLE public.dkai_orders
  ADD CONSTRAINT dkai_orders_charge_mode_chk
  CHECK (charge_mode IN ('destination', 'direct', 'separate', 'manual'));

COMMENT ON COLUMN public.dkai_orders.charge_mode IS
  'destination = legacy platform-created Connect destination charge label; direct = connected-account charge only if verified from Stripe account context; separate = new platform charge with later transfer; manual = non-Stripe/manual path.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_orders_transfer_idem
  ON public.dkai_orders (transfer_idempotency_key)
  WHERE transfer_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dkai_orders_transfer_claim
  ON public.dkai_orders (transfer_state, transfer_eligible_at, transfer_next_attempt_at)
  WHERE charge_mode = 'separate';

-- Backfill the minor-unit ledger from the existing decimal columns.
UPDATE public.dkai_orders
SET gross_amount_minor       = COALESCE(gross_amount_minor, ROUND(COALESCE(price, 0) * 100)::bigint),
    commission_amount_minor  = COALESCE(commission_amount_minor, ROUND(COALESCE(platform_fee, 0) * 100)::bigint),
    seller_entitlement_minor = COALESCE(seller_entitlement_minor, ROUND(COALESCE(seller_earnings, 0) * 100)::bigint),
    commission_rate          = COALESCE(commission_rate, platform_fee_percent_locked)
WHERE gross_amount_minor IS NULL
   OR commission_amount_minor IS NULL
   OR seller_entitlement_minor IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Seller country allowlist (server-side source of truth for onboarding)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_seller_country_allowlist (
  country_code text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  label        text NOT NULL,
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dkai_seller_country_allowlist (country_code, label) VALUES
  ('CH', 'Switzerland'),
  ('LI', 'Liechtenstein'),
  ('DE', 'Germany'),
  ('AT', 'Austria'),
  ('US', 'United States')
ON CONFLICT (country_code) DO NOTHING;

GRANT SELECT ON public.dkai_seller_country_allowlist TO anon, authenticated;
GRANT ALL    ON public.dkai_seller_country_allowlist TO service_role;
ALTER TABLE public.dkai_seller_country_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country_allowlist_public_read" ON public.dkai_seller_country_allowlist;
CREATE POLICY "country_allowlist_public_read"
  ON public.dkai_seller_country_allowlist FOR SELECT TO anon, authenticated
  USING (enabled);

-- Persist the country the seller declared during onboarding.
ALTER TABLE public.dkai_seller_payment_configs
  ADD COLUMN IF NOT EXISTS declared_country          text,
  ADD COLUMN IF NOT EXISTS stripe_service_agreement  text,
  ADD COLUMN IF NOT EXISTS payouts_enabled           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_restricted        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requirements_snapshot     jsonb;

-- ---------------------------------------------------------------------------
-- 3) Transfer operation ledger (one row per Stripe transfer attempt intent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_transfer_operations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES public.dkai_orders(id) ON DELETE CASCADE,
  seller_id          uuid,
  destination_account text NOT NULL,
  transfer_group     text,
  source_transaction text,
  amount_minor       bigint NOT NULL CHECK (amount_minor > 0),
  currency           text NOT NULL DEFAULT 'chf',
  idempotency_key    text NOT NULL,
  request_params     jsonb NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','succeeded','failed','ambiguous','reversed')),
  stripe_transfer_id text,
  error_code         text,
  error_message      text,
  attempts           integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_transfer_ops_idem
  ON public.dkai_transfer_operations (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_transfer_ops_stripe_id
  ON public.dkai_transfer_operations (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dkai_transfer_ops_order
  ON public.dkai_transfer_operations (order_id, created_at DESC);

GRANT ALL ON public.dkai_transfer_operations TO service_role;
ALTER TABLE public.dkai_transfer_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transfer_ops_admin_read" ON public.dkai_transfer_operations;
CREATE POLICY "transfer_ops_admin_read"
  ON public.dkai_transfer_operations FOR SELECT TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 4) Refund + reversal ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_refund_ledger (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid REFERENCES public.dkai_orders(id) ON DELETE SET NULL,
  stripe_refund_id   text,
  stripe_charge_id   text,
  amount_minor       bigint NOT NULL,
  currency           text NOT NULL DEFAULT 'chf',
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','succeeded','failed','canceled')),
  origin             text NOT NULL DEFAULT 'stripe'
                     CHECK (origin IN ('app','stripe','dispute')),
  seller_recovery_minor bigint NOT NULL DEFAULT 0,
  reversal_id        text,
  reversal_status    text NOT NULL DEFAULT 'not_required'
                     CHECK (reversal_status IN ('not_required','pending','succeeded','failed','partial')),
  reversal_error     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_refund_ledger_refund
  ON public.dkai_refund_ledger (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dkai_refund_ledger_order
  ON public.dkai_refund_ledger (order_id, created_at DESC);

GRANT ALL ON public.dkai_refund_ledger TO service_role;
ALTER TABLE public.dkai_refund_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refund_ledger_admin_read" ON public.dkai_refund_ledger;
CREATE POLICY "refund_ledger_admin_read"
  ON public.dkai_refund_ledger FOR SELECT TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 5) Dispute ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_stripe_dispute_ledger (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid REFERENCES public.dkai_orders(id) ON DELETE SET NULL,
  stripe_dispute_id  text NOT NULL,
  stripe_charge_id   text,
  amount_minor       bigint NOT NULL DEFAULT 0,
  currency           text NOT NULL DEFAULT 'chf',
  status             text,
  outcome            text CHECK (outcome IN ('open','won','lost','withdrawn')),
  seller_recovery_minor bigint NOT NULL DEFAULT 0,
  reversal_id        text,
  reversal_status    text NOT NULL DEFAULT 'not_required'
                     CHECK (reversal_status IN ('not_required','pending','succeeded','failed','partial')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_dispute_ledger_dispute
  ON public.dkai_stripe_dispute_ledger (stripe_dispute_id);

GRANT ALL ON public.dkai_stripe_dispute_ledger TO service_role;
ALTER TABLE public.dkai_stripe_dispute_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dispute_ledger_admin_read" ON public.dkai_stripe_dispute_ledger;
CREATE POLICY "dispute_ledger_admin_read"
  ON public.dkai_stripe_dispute_ledger FOR SELECT TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 6) Webhook processing records (hardening of the existing table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  provider_event_id text NOT NULL,
  event_type        text,
  payload           jsonb,
  processed         boolean NOT NULL DEFAULT false,
  processed_at      timestamptz,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event
  ON public.webhook_events (provider, provider_event_id);

GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 7) Concurrency-safe commission lock (founding benefit: 0% on first 4 sales,
--    max 5 founding sellers). Called once per order, before Stripe checkout.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dkai_lock_order_commission(
  _order_id uuid,
  _gross_minor bigint,
  _currency text DEFAULT 'chf'
)
RETURNS TABLE (
  commission_rate numeric,
  commission_amount_minor bigint,
  seller_entitlement_minor bigint,
  founding_applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller uuid;
  _is_founding boolean := false;
  _founding_rank integer;
  _consumed integer := 0;
  _rate numeric := NULL;
  _commission bigint;
  _entitlement bigint;
  _applied boolean := false;
BEGIN
  SELECT seller_id, commission_rate, commission_amount_minor,
         seller_entitlement_minor, founding_benefit_applied
    INTO _seller, _rate, _commission, _entitlement, _applied
  FROM public.dkai_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF _seller IS NULL THEN
    RAISE EXCEPTION 'Order % has no seller', _order_id;
  END IF;

  -- Already locked: immutable, return the frozen values.
  IF _rate IS NOT NULL AND _commission IS NOT NULL THEN
    RETURN QUERY SELECT _rate, _commission, _entitlement, _applied;
    RETURN;
  END IF;

  -- Serialise all concurrent purchases of the same seller.
  PERFORM pg_advisory_xact_lock(hashtextextended('dkai_commission:' || _seller::text, 0));

  SELECT COALESCE(p.is_founding_seller, false) INTO _is_founding
  FROM public.dkai_profiles p WHERE p.id = _seller;

  IF _is_founding THEN
    -- Only the first 5 founding sellers (by grant time) qualify.
    SELECT rnk INTO _founding_rank FROM (
      SELECT id, ROW_NUMBER() OVER (
               ORDER BY COALESCE(founding_seller_since, created_at), id
             ) AS rnk
      FROM public.dkai_profiles
      WHERE COALESCE(is_founding_seller, false)
    ) ranked WHERE id = _seller;

    IF COALESCE(_founding_rank, 99) > 5 THEN
      _is_founding := false;
    END IF;
  END IF;

  IF _is_founding THEN
    SELECT count(*) INTO _consumed
    FROM public.dkai_orders o
    WHERE o.seller_id = _seller
      AND o.founding_benefit_applied
      AND o.id <> _order_id
      AND COALESCE(o.refunded_amount_minor, 0) = 0
      AND COALESCE(o.status, '') <> 'failed';

    IF _consumed < 4 THEN
      _rate := 0;
      _applied := true;
    END IF;
  END IF;

  IF _rate IS NULL THEN
    _rate := public.dkai_effective_platform_fee_percent(_seller);
    _applied := false;
  END IF;

  _rate := GREATEST(0, LEAST(100, COALESCE(_rate, 5)));
  _commission := ROUND(_gross_minor * _rate / 100.0)::bigint;
  _entitlement := _gross_minor - _commission;

  UPDATE public.dkai_orders
  SET commission_rate            = _rate,
      commission_amount_minor    = _commission,
      seller_entitlement_minor   = _entitlement,
      gross_amount_minor         = _gross_minor,
      currency                   = lower(_currency),
      platform_fee               = ROUND(_commission / 100.0, 2),
      seller_earnings            = ROUND(_entitlement / 100.0, 2),
      platform_fee_percent_locked = _rate,
      founding_benefit_applied   = _applied,
      commission_locked_at       = now()
  WHERE id = _order_id;

  RETURN QUERY SELECT _rate, _commission, _entitlement, _applied;
END;
$$;

REVOKE ALL ON FUNCTION public.dkai_lock_order_commission(uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_lock_order_commission(uuid, bigint, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Start the 7-day hold from the trusted paid_at (separate charges only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dkai_start_transfer_hold_at(
  _order_id uuid,
  _paid_at timestamptz
)
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
  SET paid_at              = COALESCE(paid_at, _paid_at),
      sale_completed_at    = COALESCE(sale_completed_at, _paid_at),
      transfer_eligible_at = COALESCE(transfer_eligible_at, _paid_at + (_days || ' days')::interval),
      transfer_state       = CASE
                               WHEN transfer_state IN ('completed','reversed','blocked','in_progress') THEN transfer_state
                               ELSE 'pending'
                             END
  WHERE id = _order_id
    AND charge_mode = 'separate';
END;
$$;

REVOKE ALL ON FUNCTION public.dkai_start_transfer_hold_at(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_start_transfer_hold_at(uuid, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 9) Worker claim: row-locked, leased, bounded batch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dkai_claim_transfer_batch(
  _limit integer DEFAULT 20,
  _lease_seconds integer DEFAULT 300
)
RETURNS TABLE (
  order_id uuid,
  seller_id uuid,
  currency text,
  amount_minor bigint,
  stripe_charge_id text,
  stripe_transfer_group text,
  transfer_idempotency_key text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
BEGIN
  SELECT transfers_enabled INTO _enabled FROM public.dkai_transfer_config WHERE id = true;
  IF NOT COALESCE(_enabled, true) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM public.dkai_orders o
    WHERE o.charge_mode = 'separate'
      AND o.transfer_state IN ('pending','eligible','failed')
      AND o.status IN ('paid','completed','delivered')
      AND o.paid_at IS NOT NULL
      AND o.transfer_eligible_at IS NOT NULL
      AND o.transfer_eligible_at <= now()
      AND COALESCE(o.transfer_lease_until, to_timestamp(0)) < now()
      AND COALESCE(o.transfer_next_attempt_at, to_timestamp(0)) <= now()
      AND COALESCE(o.refunded_amount_minor, 0) = 0
      AND o.dispute_opened_at IS NULL
      AND COALESCE(o.seller_entitlement_minor, 0) > 0
      AND o.stripe_charge_id IS NOT NULL
    ORDER BY o.transfer_eligible_at
    LIMIT GREATEST(1, LEAST(_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dkai_orders o
  SET transfer_state    = 'in_progress',
      transfer_lease_until = now() + (GREATEST(30, _lease_seconds) || ' seconds')::interval,
      transfer_attempts = o.transfer_attempts + 1,
      transfer_idempotency_key = COALESCE(
        o.transfer_idempotency_key,
        'dkaim_transfer_' || o.id::text || '_' || COALESCE(o.stripe_charge_id, 'nocharge')
      )
  FROM claimed c
  WHERE o.id = c.id
  RETURNING o.id, o.seller_id, o.currency,
            (COALESCE(o.seller_entitlement_minor, 0) - COALESCE(o.reversed_amount_minor, 0))::bigint,
            o.stripe_charge_id, o.stripe_transfer_group,
            o.transfer_idempotency_key, o.transfer_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.dkai_claim_transfer_batch(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_claim_transfer_batch(integer, integer) TO service_role;


-- ---------------------------------------------------------------------------
-- 10) Recalculate seller entitlement after actual Stripe fees/refunds/disputes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dkai_recalculate_order_financials(
  _order_id uuid,
  _processing_fee_minor bigint DEFAULT NULL,
  _refunded_amount_minor bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gross bigint;
  _commission bigint;
  _fee bigint;
  _refunded bigint;
  _entitlement bigint;
BEGIN
  SELECT COALESCE(gross_amount_minor, ROUND(COALESCE(price, 0) * 100)::bigint),
         COALESCE(commission_amount_minor, ROUND(COALESCE(platform_fee, 0) * 100)::bigint),
         COALESCE(processing_fee_minor, 0),
         COALESCE(refunded_amount_minor, 0)
    INTO _gross, _commission, _fee, _refunded
  FROM public.dkai_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF _gross IS NULL THEN
    RAISE EXCEPTION 'Order % not found', _order_id;
  END IF;

  IF _processing_fee_minor IS NOT NULL THEN
    _fee := GREATEST(0, _processing_fee_minor);
  END IF;
  IF _refunded_amount_minor IS NOT NULL THEN
    _refunded := GREATEST(0, LEAST(_gross, _refunded_amount_minor));
  END IF;

  -- Seller-borne provider fees: entitlement is gross minus platform commission,
  -- actual Stripe fee once known, and successful refunds/disputes. Stripe fees
  -- are never guessed; NULL means not known yet and is stored as 0 until webhook
  -- balance_transaction data arrives.
  _entitlement := GREATEST(0, _gross - COALESCE(_commission, 0) - COALESCE(_fee, 0) - COALESCE(_refunded, 0));

  UPDATE public.dkai_orders
  SET processing_fee_minor     = _fee,
      processing_fee_bearer    = 'seller',
      refunded_amount_minor    = _refunded,
      seller_entitlement_minor = _entitlement,
      seller_earnings          = ROUND(_entitlement / 100.0, 2),
      transfer_state           = CASE
                                   WHEN charge_mode <> 'separate' THEN transfer_state
                                   WHEN _entitlement <= 0 AND transfer_state <> 'completed' THEN 'blocked'
                                   ELSE transfer_state
                                 END,
      updated_at               = now()
  WHERE id = _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dkai_recalculate_order_financials(uuid, bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_recalculate_order_financials(uuid, bigint, bigint) TO service_role;

-- ---------------------------------------------------------------------------
-- 10) Seller-facing payout view (read-only, own rows). Sellers can never
--     write financial state: no INSERT/UPDATE grants anywhere above.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.dkai_seller_payout_overview AS
SELECT
  o.id                      AS order_id,
  o.seller_id,
  o.product_id,
  o.currency,
  o.gross_amount_minor,
  o.commission_rate,
  o.commission_amount_minor,
  o.processing_fee_minor,
  o.processing_fee_bearer,
  o.seller_entitlement_minor,
  o.refunded_amount_minor,
  o.reversed_amount_minor,
  o.seller_debt_minor,
  o.charge_mode,
  o.transfer_state,
  o.paid_at,
  o.transfer_eligible_at,
  o.transfer_completed_at,
  o.founding_benefit_applied,
  o.status
FROM public.dkai_orders o;

ALTER VIEW public.dkai_seller_payout_overview SET (security_invoker = true);
GRANT SELECT ON public.dkai_seller_payout_overview TO authenticated;
GRANT SELECT ON public.dkai_seller_payout_overview TO service_role;
