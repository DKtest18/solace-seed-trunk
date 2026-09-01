-- =============================================================================
-- 20260902 — Admin directory, founding sellers, company logos
-- ADDITIVE ONLY. No DROP / DELETE / TRUNCATE, no changes to existing columns,
-- rows or policies. All new columns are nullable so existing rows stay valid.
-- =============================================================================

-- 0) Enum-agnostic admin check.
--    The role column on dkai_user_roles is an enum (dkai_app_role / app_role)
--    whose label set differs per environment: some projects have 'super_admin',
--    some do not. Comparing an enum literal that does not exist raises
--    22P02 "invalid input value for enum". Casting role to text avoids that
--    entirely, so this works no matter which labels exist.
CREATE OR REPLACE FUNCTION public.dkai_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dkai_user_roles r
    WHERE r.user_id = auth.uid()
      AND r.role::text IN ('admin', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.dkai_is_platform_admin() TO authenticated, service_role;

-- 1) Founding-seller markers on the user profile (nullable, badge + fee rule).
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS is_founding_seller boolean,
  ADD COLUMN IF NOT EXISTS founding_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS founding_granted_by uuid,
  ADD COLUMN IF NOT EXISTS founding_free_sales_limit integer;

-- 2) Company logo + explicit public-display consent (own records + logo wall).
ALTER TABLE public.dkai_seller_applications
  ADD COLUMN IF NOT EXISTS company_logo_path text,
  ADD COLUMN IF NOT EXISTS company_logo_public boolean,
  ADD COLUMN IF NOT EXISTS company_logo_updated_at timestamptz;

-- 3) Public read of company logos in the 'company-logos' storage bucket.
--    (Create the bucket first: Storage -> New bucket -> name 'company-logos',
--     Public = ON, file size limit 2 MB.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'company_logos_public_read'
  ) THEN
    CREATE POLICY company_logos_public_read ON storage.objects
      FOR SELECT USING (bucket_id = 'company-logos');
  END IF;
END $$;

-- 4) Sellers may write only inside their own <uid>/ folder of that bucket.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'company_logos_owner_insert'
  ) THEN
    CREATE POLICY company_logos_owner_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'company-logos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'company_logos_owner_update'
  ) THEN
    CREATE POLICY company_logos_owner_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'company-logos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- 5) Canonical "this sale really happened and the money stayed" counter.
--    Shared by Stripe and PayPal so the fee rule is identical everywhere.
--    Merely 'paid' does NOT count; refunded/reversed orders never count.
CREATE OR REPLACE FUNCTION public.dkai_seller_settled_sales_count(_seller_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.dkai_orders o
  WHERE o.seller_id = _seller_id
    AND o.status IN ('completed', 'delivered', 'released')
    AND COALESCE(o.payout_status, '') <> 'refunded'
    AND COALESCE(o.exclusive_status, '') <> 'refunded'
    AND NOT EXISTS (
      SELECT 1 FROM public.dkai_refund_requests r
      WHERE r.order_id = o.id AND r.status IN ('approved', 'refunded')
    );
$$;

-- 6) Single source of truth for the platform fee percentage.
--    Founding sellers pay 0% on their own first N settled sales (default 4),
--    then the normal per-seller fee. The old platform-wide 20-sale promo is
--    intentionally NOT part of this function any more.
CREATE OR REPLACE FUNCTION public.dkai_effective_platform_fee_percent(_seller_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee numeric;
  v_founding boolean;
  v_limit integer;
  v_used integer;
BEGIN
  SELECT COALESCE(platform_fee_percent, 5),
         COALESCE(is_founding_seller, false),
         COALESCE(founding_free_sales_limit, 4)
    INTO v_fee, v_founding, v_limit
  FROM public.dkai_profiles WHERE id = _seller_id;

  IF v_fee IS NULL THEN v_fee := 5; END IF;

  IF v_founding THEN
    v_used := public.dkai_seller_settled_sales_count(_seller_id);
    IF v_used < v_limit THEN
      RETURN 0;
    END IF;
  END IF;

  RETURN GREATEST(0, LEAST(100, v_fee));
END $$;

GRANT EXECUTE ON FUNCTION public.dkai_seller_settled_sales_count(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.dkai_effective_platform_fee_percent(uuid) TO authenticated, anon, service_role;

-- 7) Public logo wall: only companies that ticked the consent box.
CREATE OR REPLACE FUNCTION public.dkai_public_company_logos()
RETURNS TABLE (company_name text, logo_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.company_legal_name, a.company_logo_path
  FROM public.dkai_seller_applications a
  WHERE a.seller_type = 'company'
    AND a.company_logo_public IS TRUE
    AND a.company_logo_path IS NOT NULL
  ORDER BY a.company_logo_updated_at DESC NULLS LAST
  LIMIT 40;
$$;

GRANT EXECUTE ON FUNCTION public.dkai_public_company_logos() TO anon, authenticated, service_role;

-- 8) ADMIN-ONLY read of users (server-side guard, never trusts the client).
--    Deliberately excludes password hashes, tokens, MFA secrets and every
--    column of dkai_credential_handovers.
CREATE OR REPLACE FUNCTION public.dkai_admin_user_directory(
  _search text DEFAULT NULL,
  _limit integer DEFAULT 25,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  username text,
  avatar_url text,
  country text,
  is_founding_seller boolean,
  platform_fee_percent numeric,
  settled_sales integer,
  product_count integer,
  is_seller boolean,
  seller_kind text,
  company_legal_name text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.dkai_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT u.id, u.email::text AS email, u.created_at, u.last_sign_in_at,
           p.full_name, p.username, p.avatar_url, p.country,
           COALESCE(p.is_founding_seller, false) AS is_founding_seller,
           COALESCE(p.platform_fee_percent, 5)::numeric AS platform_fee_percent,
           a.seller_type AS seller_kind,
           a.company_legal_name
    FROM auth.users u
    LEFT JOIN public.dkai_profiles p ON p.id = u.id
    LEFT JOIN public.dkai_seller_applications a ON a.user_id = u.id
    WHERE _search IS NULL
       OR u.email ILIKE '%' || _search || '%'
       OR COALESCE(p.full_name, '') ILIKE '%' || _search || '%'
       OR COALESCE(p.username, '') ILIKE '%' || _search || '%'
       OR COALESCE(a.company_legal_name, '') ILIKE '%' || _search || '%'
  )
  SELECT b.id, b.email, b.created_at, b.last_sign_in_at, b.full_name, b.username,
         b.avatar_url, b.country, b.is_founding_seller, b.platform_fee_percent,
         public.dkai_seller_settled_sales_count(b.id) AS settled_sales,
         (SELECT COUNT(*)::int FROM public.dkai_products pr WHERE pr.seller_id = b.id) AS product_count,
         EXISTS (SELECT 1 FROM public.dkai_user_roles r WHERE r.user_id = b.id AND r.role::text = 'seller') AS is_seller,
         b.seller_kind, b.company_legal_name,
         (SELECT COUNT(*) FROM base) AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT GREATEST(1, LEAST(100, _limit)) OFFSET GREATEST(0, _offset);
END $$;

GRANT EXECUTE ON FUNCTION public.dkai_admin_user_directory(text, integer, integer) TO authenticated;

-- 9) ADMIN-ONLY company list (our own records, no registry verification).
CREATE OR REPLACE FUNCTION public.dkai_admin_companies()
RETURNS TABLE (
  user_id uuid,
  company_legal_name text,
  company_legal_form text,
  company_registration_country text,
  company_registration_number text,
  company_address text,
  company_representative_name text,
  company_contact_email text,
  company_logo_path text,
  company_logo_public boolean,
  seller_type_updated_at timestamptz,
  is_founding_seller boolean,
  settled_sales integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id, a.company_legal_name, a.company_legal_form,
         a.company_registration_country, a.company_registration_number,
         a.company_address, a.company_representative_name, a.company_contact_email,
         a.company_logo_path, a.company_logo_public, a.seller_type_updated_at,
         COALESCE(p.is_founding_seller, false),
         public.dkai_seller_settled_sales_count(a.user_id)
  FROM public.dkai_seller_applications a
  LEFT JOIN public.dkai_profiles p ON p.id = a.user_id
  WHERE public.dkai_is_platform_admin()
    AND a.seller_type = 'company'
  ORDER BY a.seller_type_updated_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.dkai_admin_companies() TO authenticated;

-- 10) ADMIN-ONLY platform analytics (aggregates only, no buyer credentials).
CREATE OR REPLACE FUNCTION public.dkai_admin_platform_analytics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.dkai_is_platform_admin()
    THEN jsonb_build_object('error', 'forbidden')
    ELSE jsonb_build_object(
      'users_total', (SELECT COUNT(*) FROM auth.users),
      'users_last_30d', (SELECT COUNT(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
      'sellers_total', (SELECT COUNT(DISTINCT user_id) FROM public.dkai_user_roles WHERE role::text = 'seller'),
      'companies_total', (SELECT COUNT(*) FROM public.dkai_seller_applications WHERE seller_type = 'company'),
      'founding_sellers', (SELECT COUNT(*) FROM public.dkai_profiles WHERE is_founding_seller IS TRUE),
      'products_total', (SELECT COUNT(*) FROM public.dkai_products),
      'products_live', (SELECT COUNT(*) FROM public.dkai_products WHERE review_status = 'approved'),
      'products_pending', (SELECT COUNT(*) FROM public.dkai_products WHERE review_status IN ('submitted','pending','in_review')),
      'orders_total', (SELECT COUNT(*) FROM public.dkai_orders),
      'orders_paid', (SELECT COUNT(*) FROM public.dkai_orders WHERE status IN ('paid','completed','delivered','released')),
      'orders_settled', (SELECT COUNT(*) FROM public.dkai_orders WHERE status IN ('completed','delivered','released')),
      'gmv', (SELECT COALESCE(SUM(price), 0) FROM public.dkai_orders WHERE status IN ('paid','completed','delivered','released')),
      'platform_fees', (SELECT COALESCE(SUM(platform_fee), 0) FROM public.dkai_orders WHERE status IN ('paid','completed','delivered','released')),
      'gmv_last_30d', (SELECT COALESCE(SUM(price), 0) FROM public.dkai_orders WHERE status IN ('paid','completed','delivered','released') AND created_at > now() - interval '30 days'),
      'revenue_by_month', (
        SELECT COALESCE(jsonb_agg(x ORDER BY x->>'month'), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
                   'month', to_char(date_trunc('month', created_at), 'YYYY-MM'),
                   'gmv', COALESCE(SUM(price), 0),
                   'fees', COALESCE(SUM(platform_fee), 0),
                   'orders', COUNT(*)
                 ) AS x
          FROM public.dkai_orders
          WHERE status IN ('paid','completed','delivered','released')
            AND created_at > now() - interval '12 months'
          GROUP BY date_trunc('month', created_at)
        ) m
      )
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.dkai_admin_platform_analytics() TO authenticated;

-- 11) ADMIN-ONLY founding toggle, hard-capped at 5 concurrent founding sellers.
CREATE OR REPLACE FUNCTION public.dkai_admin_set_founding_seller(
  _user_id uuid,
  _is_founding boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
BEGIN
  IF NOT public.dkai_is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF _is_founding THEN
    SELECT COUNT(*) INTO v_current
    FROM public.dkai_profiles
    WHERE is_founding_seller IS TRUE AND id <> _user_id;

    IF v_current >= 5 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'founding_limit_reached', 'limit', 5);
    END IF;

    UPDATE public.dkai_profiles
      SET is_founding_seller = true,
          founding_granted_at = COALESCE(founding_granted_at, now()),
          founding_granted_by = auth.uid(),
          founding_free_sales_limit = COALESCE(founding_free_sales_limit, 4)
      WHERE id = _user_id;
  ELSE
    UPDATE public.dkai_profiles
      SET is_founding_seller = false
      WHERE id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', _user_id,
    'is_founding_seller', _is_founding,
    'settled_sales', public.dkai_seller_settled_sales_count(_user_id)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.dkai_admin_set_founding_seller(uuid, boolean) TO authenticated;

-- 12) Public founding badge lookup for profile pages (badge only, no fee data).
CREATE OR REPLACE FUNCTION public.dkai_is_founding_seller(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_founding_seller, false) FROM public.dkai_profiles WHERE id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.dkai_is_founding_seller(uuid) TO anon, authenticated, service_role;
