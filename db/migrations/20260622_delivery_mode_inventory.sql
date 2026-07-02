-- Part 2: Delivery mode + quantity + inventory audit
-- Run in Supabase SQL editor.

-- 1) Product columns
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS delivery_time_hours smallint
    CHECK (delivery_time_hours IN (12, 24, 48)),
  ADD COLUMN IF NOT EXISTS quantity_sold integer NOT NULL DEFAULT 0
    CHECK (quantity_sold >= 0);

-- Normalize legacy delivery_mode values to the new two-option domain.
UPDATE public.dkai_products
SET delivery_mode = 'instant'
WHERE delivery_mode IS NULL
   OR delivery_mode NOT IN ('instant', 'manual');

ALTER TABLE public.dkai_products
  DROP CONSTRAINT IF EXISTS dkai_products_delivery_mode_check;
ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_delivery_mode_check
  CHECK (delivery_mode IN ('instant', 'manual'));

-- 2) Inventory audit table
CREATE TABLE IF NOT EXISTS public.dkai_inventory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.dkai_products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.dkai_orders(id) ON DELETE SET NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dkai_inventory_audit_product
  ON public.dkai_inventory_audit(product_id, created_at DESC);

GRANT SELECT ON public.dkai_inventory_audit TO authenticated;
GRANT ALL    ON public.dkai_inventory_audit TO service_role;

ALTER TABLE public.dkai_inventory_audit ENABLE ROW LEVEL SECURITY;

-- Admin read-only
DROP POLICY IF EXISTS "inventory_audit_admin_read" ON public.dkai_inventory_audit;
CREATE POLICY "inventory_audit_admin_read"
  ON public.dkai_inventory_audit
  FOR SELECT
  TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- Seller may read audit for their own products
DROP POLICY IF EXISTS "inventory_audit_seller_read" ON public.dkai_inventory_audit;
CREATE POLICY "inventory_audit_seller_read"
  ON public.dkai_inventory_audit
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dkai_products p
    WHERE p.id = dkai_inventory_audit.product_id
      AND p.seller_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies on purpose: only service_role
-- (webhook / admin functions) can write, which bypasses RLS.

-- 3) Atomic decrement helper (invoked by webhook)
CREATE OR REPLACE FUNCTION public.dkai_decrement_stock(
  _product_id uuid,
  _order_id uuid,
  _reason text DEFAULT 'order_paid'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _qty integer;
  _sold integer;
BEGIN
  SELECT available_quantity, quantity_sold
    INTO _qty, _sold
  FROM public.dkai_products
  WHERE id = _product_id
  FOR UPDATE;

  -- Unlimited stock: still log for audit trail
  IF _qty IS NULL THEN
    UPDATE public.dkai_products
       SET quantity_sold = COALESCE(quantity_sold, 0) + 1
     WHERE id = _product_id;
    INSERT INTO public.dkai_inventory_audit(product_id, order_id, delta, reason, actor)
    VALUES (_product_id, _order_id, -1, _reason, 'webhook');
    RETURN;
  END IF;

  IF _sold >= _qty THEN
    RAISE EXCEPTION 'sold_out' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.dkai_products
     SET quantity_sold = quantity_sold + 1
   WHERE id = _product_id;

  INSERT INTO public.dkai_inventory_audit(product_id, order_id, delta, reason, actor)
  VALUES (_product_id, _order_id, -1, _reason, 'webhook');
END;
$$;

GRANT EXECUTE ON FUNCTION public.dkai_decrement_stock(uuid, uuid, text) TO service_role;
