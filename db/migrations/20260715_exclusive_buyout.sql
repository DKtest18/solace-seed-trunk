-- Part B: Exclusive Ownership Buyout
-- Adds product-lock + IP-assignment tracking + capture status for exclusive orders.

-- 1) Product lock columns
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS exclusive_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusive_owner_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS exclusive_sold_at timestamptz;

CREATE INDEX IF NOT EXISTS dkai_products_exclusive_locked_idx
  ON public.dkai_products (exclusive_locked);

-- 2) Order-level exclusive handover columns
ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS exclusive_status text,           -- awaiting_delivery | awaiting_buyer | captured | refunded
  ADD COLUMN IF NOT EXISTS ip_assignment_buyer_at timestamptz,
  ADD COLUMN IF NOT EXISTS ip_assignment_seller_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_files_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS exclusive_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_capture_method text;      -- 'automatic' | 'manual'

-- 3) When an exclusive order is fully confirmed + captured, lock the product.
CREATE OR REPLACE FUNCTION public.dkai_lock_exclusive_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.license_tier = 'exclusive'
     AND NEW.exclusive_status = 'captured'
     AND (OLD.exclusive_status IS DISTINCT FROM 'captured') THEN
    UPDATE public.dkai_products
       SET exclusive_locked = true,
           exclusive_owner_id = NEW.buyer_id,
           exclusive_sold_at = now(),
           is_published = false
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dkai_orders_lock_exclusive ON public.dkai_orders;
CREATE TRIGGER dkai_orders_lock_exclusive
  AFTER UPDATE ON public.dkai_orders
  FOR EACH ROW EXECUTE FUNCTION public.dkai_lock_exclusive_product();
