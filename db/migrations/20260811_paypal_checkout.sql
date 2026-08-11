-- =============================================================================
-- DK AI Marketplace — PayPal Phase 2: buyer-side checkout
-- Adds PayPal order tracking + refund fields to dkai_orders.
-- Stripe columns and behaviour untouched.
-- =============================================================================

ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS paypal_order_id        text,
  ADD COLUMN IF NOT EXISTS paypal_capture_id      text,
  ADD COLUMN IF NOT EXISTS paypal_merchant_id     text,
  ADD COLUMN IF NOT EXISTS paypal_refund_id       text,
  ADD COLUMN IF NOT EXISTS paypal_platform_fee    numeric,
  ADD COLUMN IF NOT EXISTS paypal_is_sandbox      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS paypal_captured_at     timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS dkai_orders_paypal_order_id_key
  ON public.dkai_orders (paypal_order_id) WHERE paypal_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dkai_orders_paypal_capture_idx
  ON public.dkai_orders (paypal_capture_id);

-- Idempotency + audit log for PayPal webhooks (service_role only).
CREATE TABLE IF NOT EXISTS public.dkai_paypal_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     text UNIQUE NOT NULL,
  event_type   text NOT NULL,
  resource_id  text,
  order_id     uuid REFERENCES public.dkai_orders(id) ON DELETE SET NULL,
  payload      jsonb,
  processed_at timestamptz DEFAULT now()
);

GRANT ALL ON public.dkai_paypal_webhook_events TO service_role;

ALTER TABLE public.dkai_paypal_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages paypal webhook events"
  ON public.dkai_paypal_webhook_events;
CREATE POLICY "service role manages paypal webhook events"
  ON public.dkai_paypal_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
