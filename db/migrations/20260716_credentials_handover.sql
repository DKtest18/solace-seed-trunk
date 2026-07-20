-- Part C: Temporary Credentials Handover
-- Adds setup-requirement specs on products and a secure, encrypted store
-- for buyer-supplied credentials with full access auditing.

-- 1) Setup requirement specs on products (seller-defined)
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS requires_setup_credentials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS setup_access_window_hours integer NOT NULL DEFAULT 48;
-- setup_requirements shape:
-- [{ "key":"openai_api_key", "label":"OpenAI API Key", "description":"Read-only key with GPT-4 access",
--    "type":"api_key|password|oauth_token|url|text", "required":true }]

-- 2) Encrypted handover store (one row per order, per credential spec)
CREATE TABLE IF NOT EXISTS public.dkai_credential_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.dkai_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.dkai_products(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spec_key text NOT NULL,          -- matches setup_requirements[].key
  spec_label text NOT NULL,
  -- AES-256-GCM payload written by the edge function
  ciphertext text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  access_expires_at timestamptz NOT NULL,
  purged_at timestamptz,
  purged_reason text,
  UNIQUE (order_id, spec_key)
);

GRANT SELECT ON public.dkai_credential_handovers TO authenticated;
GRANT ALL    ON public.dkai_credential_handovers TO service_role;
ALTER TABLE public.dkai_credential_handovers ENABLE ROW LEVEL SECURITY;

-- Buyers may see their own submissions (metadata only — ciphertext is opaque)
CREATE POLICY "Buyer reads own handovers"
ON public.dkai_credential_handovers FOR SELECT TO authenticated
USING (buyer_id = auth.uid());

-- Sellers may see metadata of their own product handovers (decryption goes through edge function + audit)
CREATE POLICY "Seller reads own product handovers"
ON public.dkai_credential_handovers FOR SELECT TO authenticated
USING (seller_id = auth.uid());

-- All writes and decrypt reads happen via service_role in edge functions.

-- 3) Access audit log — every seller decrypt and every purge is recorded
CREATE TABLE IF NOT EXISTS public.dkai_credential_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.dkai_credential_handovers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL,        -- 'seller' | 'admin' | 'system'
  action text NOT NULL,            -- 'decrypt' | 'purge' | 'expired_auto_purge'
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dkai_credential_access_log TO authenticated;
GRANT ALL    ON public.dkai_credential_access_log TO service_role;
ALTER TABLE public.dkai_credential_access_log ENABLE ROW LEVEL SECURITY;

-- Buyers can see who accessed their credentials
CREATE POLICY "Buyer reads own credential audit"
ON public.dkai_credential_access_log FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.dkai_credential_handovers h
  WHERE h.id = handover_id AND h.buyer_id = auth.uid()
));

-- Sellers see their own access history
CREATE POLICY "Seller reads own credential audit"
ON public.dkai_credential_access_log FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.dkai_credential_handovers h
  WHERE h.id = handover_id AND h.seller_id = auth.uid()
));

-- 4) Order-level handover state flags (idempotent adds)
ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS handover_status text NOT NULL DEFAULT 'not_required'
    CHECK (handover_status IN ('not_required','pending_buyer','submitted','completed','purged','expired')),
  ADD COLUMN IF NOT EXISTS handover_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS handover_purge_at timestamptz;

-- 5) Helper index for the auto-purge job
CREATE INDEX IF NOT EXISTS idx_dkai_credential_handovers_expiry
  ON public.dkai_credential_handovers (access_expires_at)
  WHERE purged_at IS NULL;
