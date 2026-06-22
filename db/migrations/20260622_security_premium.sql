-- ============================================================
-- 20260622 — Security + Premium feature set (Parts C & D)
-- Idempotent. Run in Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- C.5 DSA Reports (idempotent: matches existing dkai_reports usage)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('user','product','comment','post')),
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_product_id uuid REFERENCES public.dkai_products(id) ON DELETE SET NULL,
  reported_comment_id uuid,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.dkai_reports TO authenticated;
GRANT ALL ON public.dkai_reports TO service_role;

ALTER TABLE public.dkai_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users insert own reports" ON public.dkai_reports;
CREATE POLICY "users insert own reports" ON public.dkai_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reporter reads own" ON public.dkai_reports;
CREATE POLICY "reporter reads own" ON public.dkai_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "admins read all reports" ON public.dkai_reports;
CREATE POLICY "admins read all reports" ON public.dkai_reports
  FOR SELECT TO authenticated USING (public.dkai_has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update reports" ON public.dkai_reports;
CREATE POLICY "admins update reports" ON public.dkai_reports
  FOR UPDATE TO authenticated USING (public.dkai_has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------
-- D.6 Coupons
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.dkai_products(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  usage_limit int,
  times_redeemed int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_coupons TO authenticated;
GRANT ALL ON public.dkai_coupons TO service_role;
ALTER TABLE public.dkai_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller manages own coupons" ON public.dkai_coupons;
CREATE POLICY "seller manages own coupons" ON public.dkai_coupons
  FOR ALL TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "public reads active coupons" ON public.dkai_coupons;
CREATE POLICY "public reads active coupons" ON public.dkai_coupons
  FOR SELECT TO authenticated USING (active = true);

CREATE TABLE IF NOT EXISTS public.dkai_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.dkai_coupons(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.dkai_orders(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dkai_coupon_redemptions TO authenticated;
GRANT ALL ON public.dkai_coupon_redemptions TO service_role;
ALTER TABLE public.dkai_coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer reads own redemptions" ON public.dkai_coupon_redemptions;
CREATE POLICY "buyer reads own redemptions" ON public.dkai_coupon_redemptions
  FOR SELECT TO authenticated USING (buyer_id = auth.uid());

-- ------------------------------------------------------------
-- D.7 Verification / Trust badges
-- ------------------------------------------------------------
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- Mark verified automatically when Stripe onboarding completes.
CREATE OR REPLACE FUNCTION public.dkai_sync_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stripe_onboarded IS TRUE THEN
    UPDATE public.dkai_profiles SET verified = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dkai_sync_verified_trg ON public.dkaim_user_id;
CREATE TRIGGER dkai_sync_verified_trg
AFTER UPDATE OF stripe_onboarded ON public.dkaim_user_id
FOR EACH ROW EXECUTE FUNCTION public.dkai_sync_verified();

-- Manual flag template:
-- UPDATE public.dkai_profiles SET verified = true,  seller_type = 'founding' WHERE id = '<user-uuid>';

-- ------------------------------------------------------------
-- D.8 Per-seller product & storage limits
-- ------------------------------------------------------------
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS max_products int NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS max_storage_mb int NOT NULL DEFAULT 10240;

-- ------------------------------------------------------------
-- D.10 Affiliate / referral attribution (no payout splits)
-- ------------------------------------------------------------
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Backfill referral codes for existing products
UPDATE public.dkai_products
SET referral_code = substr(replace(id::text,'-',''),1,8)
WHERE referral_code IS NULL;

ALTER TABLE public.dkai_orders
  ADD COLUMN IF NOT EXISTS referral_source text;

CREATE TABLE IF NOT EXISTS public.dkai_referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.dkai_products(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  visitor_session text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dkai_referral_clicks TO authenticated, anon;
GRANT ALL ON public.dkai_referral_clicks TO service_role;
ALTER TABLE public.dkai_referral_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone records click" ON public.dkai_referral_clicks;
CREATE POLICY "anyone records click" ON public.dkai_referral_clicks
  FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "seller reads own clicks" ON public.dkai_referral_clicks;
CREATE POLICY "seller reads own clicks" ON public.dkai_referral_clicks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.dkai_products p
            WHERE p.id = product_id AND p.seller_id = auth.uid())
  );

-- ------------------------------------------------------------
-- D.11 Email broadcasts log (rate-limited via edge function)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_email_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  recipient_count int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dkai_email_broadcasts TO authenticated;
GRANT ALL ON public.dkai_email_broadcasts TO service_role;
ALTER TABLE public.dkai_email_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller reads own broadcasts" ON public.dkai_email_broadcasts;
CREATE POLICY "seller reads own broadcasts" ON public.dkai_email_broadcasts
  FOR SELECT TO authenticated USING (seller_id = auth.uid());

-- ------------------------------------------------------------
-- D.12 Storefront customization
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_storefront_settings (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_url text,
  accent_color text DEFAULT '#2563eb',
  tagline text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.dkai_storefront_settings TO authenticated;
GRANT SELECT ON public.dkai_storefront_settings TO anon;
GRANT ALL ON public.dkai_storefront_settings TO service_role;
ALTER TABLE public.dkai_storefront_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller manages storefront" ON public.dkai_storefront_settings;
CREATE POLICY "seller manages storefront" ON public.dkai_storefront_settings
  FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "anyone reads storefront" ON public.dkai_storefront_settings;
CREATE POLICY "anyone reads storefront" ON public.dkai_storefront_settings
  FOR SELECT TO anon, authenticated USING (true);

-- ------------------------------------------------------------
-- D.13 Watermarked / sample previews on products (public)
-- ------------------------------------------------------------
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS sample_preview_url text,
  ADD COLUMN IF NOT EXISTS sample_output_text text,
  ADD COLUMN IF NOT EXISTS sample_is_watermarked boolean NOT NULL DEFAULT false;

-- ============================================================
-- Done.
-- ============================================================
