-- Launch promo: 0% platform fee for the first 20 completed sales platform-wide.
-- After 20 completed sales, the per-seller dkai_profiles.platform_fee_percent
-- applies (default 5%).
--
-- We do not need a stored counter; instead we count completed orders from
-- dkai_orders. This view + function give a single canonical source of truth
-- the edge function and the client hook can both read.

-- 1) Ensure the column has a sane default (5%) for future use.
ALTER TABLE public.dkai_profiles
  ALTER COLUMN platform_fee_percent SET DEFAULT 5;

UPDATE public.dkai_profiles
  SET platform_fee_percent = 5
  WHERE platform_fee_percent IS NULL;

-- 2) Stable function returning the platform-wide completed sales count.
CREATE OR REPLACE FUNCTION public.dkai_platform_completed_sales_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.dkai_orders
  WHERE status IN ('completed','delivered','released');
$$;

REVOKE ALL ON FUNCTION public.dkai_platform_completed_sales_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_platform_completed_sales_count() TO anon, authenticated, service_role;

-- 3) Optional view for dashboards / debugging.
CREATE OR REPLACE VIEW public.dkai_launch_promo_status AS
SELECT
  public.dkai_platform_completed_sales_count() AS sales_used,
  20 AS sales_limit,
  (public.dkai_platform_completed_sales_count() < 20) AS promo_active;

GRANT SELECT ON public.dkai_launch_promo_status TO anon, authenticated, service_role;
