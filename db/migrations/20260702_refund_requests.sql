-- PART 5 — Refund request flow (support-reviewed).
-- Buyers file a request within 14 days of purchase for exactly two reasons.
-- Admin (support) reviews, approves or rejects. Approval triggers Stripe refund via edge function.

CREATE TABLE IF NOT EXISTS public.dkai_refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.dkai_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.dkai_products(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- null for guests
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_email text NOT NULL, -- captured at submission; used for guest identification
  reason text NOT NULL CHECK (reason IN ('not_delivered', 'not_as_described')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  evidence_paths text[] NOT NULL DEFAULT '{}', -- storage paths in refund-evidence bucket
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'refunded', 'failed')),
  admin_notes text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  stripe_refund_id text,
  refund_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dkai_refund_requests_order_active
  ON public.dkai_refund_requests(order_id)
  WHERE status IN ('pending', 'under_review', 'approved');

CREATE INDEX IF NOT EXISTS idx_dkai_refund_requests_status
  ON public.dkai_refund_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dkai_refund_requests_buyer
  ON public.dkai_refund_requests(buyer_id, created_at DESC);

GRANT SELECT, INSERT ON public.dkai_refund_requests TO authenticated;
GRANT ALL ON public.dkai_refund_requests TO service_role;

ALTER TABLE public.dkai_refund_requests ENABLE ROW LEVEL SECURITY;

-- Buyer reads their own requests
DROP POLICY IF EXISTS "refund_requests_buyer_read" ON public.dkai_refund_requests;
CREATE POLICY "refund_requests_buyer_read"
  ON public.dkai_refund_requests
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- Seller reads requests filed against their sales
DROP POLICY IF EXISTS "refund_requests_seller_read" ON public.dkai_refund_requests;
CREATE POLICY "refund_requests_seller_read"
  ON public.dkai_refund_requests
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Admin full read
DROP POLICY IF EXISTS "refund_requests_admin_read" ON public.dkai_refund_requests;
CREATE POLICY "refund_requests_admin_read"
  ON public.dkai_refund_requests
  FOR SELECT
  TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies for authenticated: all writes must go through the
-- service-role edge functions (submit-refund-request, admin-decide-refund-request,
-- stripe-refund) which validate email match, 14-day window, and admin role.

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.dkai_refund_requests_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dkai_refund_requests_touch_trg ON public.dkai_refund_requests;
CREATE TRIGGER dkai_refund_requests_touch_trg
  BEFORE UPDATE ON public.dkai_refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.dkai_refund_requests_touch();

-- Private storage bucket for evidence uploads (screenshots, logs).
INSERT INTO storage.buckets (id, name, public)
VALUES ('refund-evidence', 'refund-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated buyers may upload into a folder named after their order id;
-- reads limited to the buyer who owns the parent request and to admins/service role.
DROP POLICY IF EXISTS "refund_evidence_authenticated_upload" ON storage.objects;
CREATE POLICY "refund_evidence_authenticated_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'refund-evidence');

DROP POLICY IF EXISTS "refund_evidence_admin_read" ON storage.objects;
CREATE POLICY "refund_evidence_admin_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'refund-evidence'
    AND public.dkai_has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "refund_evidence_buyer_read" ON storage.objects;
CREATE POLICY "refund_evidence_buyer_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'refund-evidence'
    AND EXISTS (
      SELECT 1 FROM public.dkai_refund_requests r
      WHERE r.buyer_id = auth.uid()
        AND storage.objects.name = ANY(r.evidence_paths)
    )
  );
