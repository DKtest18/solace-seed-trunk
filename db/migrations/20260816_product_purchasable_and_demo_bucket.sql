-- =============================================================================
-- DK AI Marketplace — purchasability guard + PRIVATE demo-video bucket
-- Idempotent. Safe to re-run.
--
-- Stripe/PayPal state has historically drifted across several tables, so this
-- migration DISCOVERS the real columns at run time (information_schema) and
-- builds dkai_product_purchasable() only from columns that actually exist.
-- No column name is assumed.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1) dkai_product_purchasable(product_id)
--    TRUE only when the product is approved AND the seller has a connected
--    payout provider (Stripe OR PayPal). Used by the UI (fail-closed) and by
--    every checkout edge function.
-- ─────────────────────────────────────────────────────────────
DO $do$
DECLARE
  v_parts   text[] := ARRAY[]::text[];
  v_joins   text   := '';
  v_where   text;
  v_sql     text;

  FUNCTION_EXISTS boolean;

  has_cfg          boolean;
  cfg_stripe_acct  boolean;
  cfg_stripe_stat  boolean;
  cfg_card_enabled boolean;
  cfg_charges      boolean;
  cfg_pp_recv      boolean;
  cfg_pp_status    boolean;
  cfg_pp_merchant  boolean;

  prof_stripe_acct boolean;
  prof_onboarded   boolean;
  prof_onb_complete boolean;

  has_dkaim        boolean;
  dkaim_acct       boolean;
  dkaim_onboarded  boolean;
BEGIN
  has_cfg := to_regclass('public.dkai_seller_payment_configs') IS NOT NULL;
  has_dkaim := to_regclass('public.dkaim_user_id') IS NOT NULL;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_seller_payment_configs' AND column_name='stripe_account_id')          INTO cfg_stripe_acct;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_seller_payment_configs' AND column_name='stripe_onboarding_status')    INTO cfg_stripe_stat;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_seller_payment_configs' AND column_name='card_payments_enabled')       INTO cfg_card_enabled;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_seller_payment_configs' AND column_name='charges_enabled')             INTO cfg_charges;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_seller_payment_configs' AND column_name='paypal_payments_receivable')  INTO cfg_pp_recv;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_seller_payment_configs' AND column_name='paypal_onboarding_status')    INTO cfg_pp_status;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_seller_payment_configs' AND column_name='paypal_merchant_id')          INTO cfg_pp_merchant;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_profiles' AND column_name='stripe_account_id')            INTO prof_stripe_acct;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_profiles' AND column_name='stripe_onboarded')             INTO prof_onboarded;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkai_profiles' AND column_name='stripe_onboarding_complete')   INTO prof_onb_complete;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkaim_user_id' AND column_name='stripe_account_id') INTO dkaim_acct;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dkaim_user_id' AND column_name='stripe_onboarded')  INTO dkaim_onboarded;

  -- ---- Stripe / PayPal via dkai_seller_payment_configs -------------------
  IF has_cfg THEN
    v_joins := v_joins || ' LEFT JOIN public.dkai_seller_payment_configs c ON c.seller_id = p.seller_id';

    IF cfg_stripe_acct THEN
      v_parts := v_parts || ARRAY[
        '(c.stripe_account_id IS NOT NULL AND ('
        || CASE WHEN cfg_card_enabled THEN 'COALESCE(c.card_payments_enabled,false) OR ' ELSE '' END
        || CASE WHEN cfg_charges      THEN 'COALESCE(c.charges_enabled,false) OR '      ELSE '' END
        || CASE WHEN cfg_stripe_stat  THEN 'c.stripe_onboarding_status = ''connected'' OR ' ELSE '' END
        || 'false))'
      ];
    END IF;

    IF cfg_pp_recv OR cfg_pp_status OR cfg_pp_merchant THEN
      v_parts := v_parts || ARRAY[
        '('
        || CASE WHEN cfg_pp_recv     THEN 'COALESCE(c.paypal_payments_receivable,false) AND ' ELSE '' END
        || CASE WHEN cfg_pp_status   THEN 'c.paypal_onboarding_status = ''connected'' AND '   ELSE '' END
        || CASE WHEN cfg_pp_merchant THEN 'c.paypal_merchant_id IS NOT NULL AND '             ELSE '' END
        || 'true)'
      ];
    END IF;
  END IF;

  -- ---- Legacy Stripe state on dkai_profiles ------------------------------
  IF prof_stripe_acct THEN
    v_parts := v_parts || ARRAY[
      '(pr.stripe_account_id IS NOT NULL AND ('
      || CASE WHEN prof_onboarded     THEN 'COALESCE(pr.stripe_onboarded,false) OR '        ELSE '' END
      || CASE WHEN prof_onb_complete  THEN 'pr.stripe_onboarding_complete IS NOT NULL OR '  ELSE '' END
      || 'false))'
    ];
  END IF;
  v_joins := v_joins || ' LEFT JOIN public.dkai_profiles pr ON pr.id = p.seller_id';

  -- ---- Legacy Stripe state on dkaim_user_id ------------------------------
  IF has_dkaim AND dkaim_acct THEN
    v_joins := v_joins || ' LEFT JOIN public.dkaim_user_id u ON u.id = p.seller_id';
    v_parts := v_parts || ARRAY[
      '(u.stripe_account_id IS NOT NULL AND ('
      || CASE WHEN dkaim_onboarded THEN 'COALESCE(u.stripe_onboarded,false) OR ' ELSE '' END
      || 'true))'
    ];
  END IF;

  IF array_length(v_parts, 1) IS NULL THEN
    -- No provider columns found anywhere: fail closed (nothing purchasable).
    v_where := 'false';
  ELSE
    v_where := array_to_string(v_parts, ' OR ');
  END IF;

  v_sql := format($f$
    CREATE OR REPLACE FUNCTION public.dkai_product_purchasable(p_product_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT EXISTS (
        SELECT 1
        FROM public.dkai_products p
        %s
        WHERE p.id = p_product_id
          AND COALESCE(p.review_status, '') = 'approved'
          AND (%s)
      );
    $body$;
  $f$, v_joins, v_where);

  EXECUTE v_sql;
  RAISE NOTICE 'dkai_product_purchasable built with: %', v_where;
END
$do$;

REVOKE ALL ON FUNCTION public.dkai_product_purchasable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_product_purchasable(uuid) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 2) PRIVATE demo-video bucket: product-demo-videos
--    Uploads must be "<auth.uid()>/<filename>". Reads: owner + admins only,
--    always through signed URLs. Additive — no existing policy is weakened.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Sellers upload own demo videos" ON storage.objects;
CREATE POLICY "Sellers upload own demo videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-demo-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers update own demo videos" ON storage.objects;
CREATE POLICY "Sellers update own demo videos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-demo-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers delete own demo videos" ON storage.objects;
CREATE POLICY "Sellers delete own demo videos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-demo-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers read own demo videos" ON storage.objects;
CREATE POLICY "Sellers read own demo videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-demo-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Admins read demo videos for review" ON storage.objects;
CREATE POLICY "Admins read demo videos for review"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-demo-videos'
  AND public.dkai_has_role(auth.uid(), 'admin')
);

-- Report any demo videos still stored in the PUBLIC product-media bucket so we
-- know whether a data migration is needed (no rows = nothing to migrate).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.dkai_products
  WHERE (demo_video_storage_path LIKE 'product-media/%')
     OR (demo_video_paths::text LIKE '%product-media/%');
  RAISE NOTICE 'Products with demo videos still in product-media: %', n;
END $$;

NOTIFY pgrst, 'reload schema';
