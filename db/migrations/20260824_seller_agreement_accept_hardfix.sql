-- FINAL FIX: persist and read Seller Agreement v4 for existing accounts.
-- Re-runnable and safe. Both RPCs are self-only through auth.uid().

BEGIN;

-- 0) Columns
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS seller_agreement_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_agreement_version text,
  ADD COLUMN IF NOT EXISTS seller_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_obligations_pdf_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_obligations_pdf_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 1) Grants for existing direct profile reads/updates used elsewhere in the app.
GRANT SELECT ON public.dkai_profiles TO authenticated;
GRANT UPDATE (
  seller_agreement_accepted,
  seller_agreement_version,
  seller_agreement_accepted_at,
  seller_obligations_pdf_acknowledged,
  seller_obligations_pdf_version,
  terms_accepted,
  terms_accepted_at,
  updated_at
) ON public.dkai_profiles TO authenticated;
GRANT ALL ON public.dkai_profiles TO service_role;

-- 2) Rebuild the acceptance RPC. It never accepts a user id from the client.
DROP FUNCTION IF EXISTS public.dkai_accept_seller_agreement(text, text);
DROP FUNCTION IF EXISTS public.dkai_accept_seller_agreement(text);

CREATE FUNCTION public.dkai_accept_seller_agreement(
  p_version text DEFAULT '2026-08-17-v4',
  p_pdf_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_required_version constant text := '2026-08-17-v4';
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_version IS DISTINCT FROM v_required_version THEN
    RAISE EXCEPTION 'seller_agreement_version_mismatch: expected %, received %',
      v_required_version, COALESCE(p_version, '<null>')
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.dkai_profiles AS p
     SET seller_agreement_accepted = true,
         seller_agreement_version = v_required_version,
         seller_agreement_accepted_at = v_now,
         seller_obligations_pdf_acknowledged = true,
         seller_obligations_pdf_version = COALESCE(p_pdf_version, p.seller_obligations_pdf_version),
         terms_accepted = true,
         terms_accepted_at = COALESCE(p.terms_accepted_at, v_now),
         updated_at = v_now
   WHERE p.id = v_uid
   RETURNING jsonb_build_object(
     'id', p.id,
     'seller_agreement_accepted', p.seller_agreement_accepted,
     'seller_agreement_version', p.seller_agreement_version,
     'seller_agreement_accepted_at', p.seller_agreement_accepted_at
   ) INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seller_profile_not_found for authenticated user %', v_uid
      USING ERRCODE = 'P0002',
            HINT = 'The authenticated user must have a dkai_profiles row whose id equals auth.uid().';
  END IF;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dkai_accept_seller_agreement(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO service_role;

-- 3) Authoritative self-only read. This avoids public-profile RLS differences
-- making an already-saved acceptance look false after login or page reload.
DROP FUNCTION IF EXISTS public.dkai_get_my_seller_agreement();

CREATE FUNCTION public.dkai_get_my_seller_agreement()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
           'id', p.id,
           'seller_agreement_accepted', COALESCE(p.seller_agreement_accepted, false),
           'seller_agreement_version', p.seller_agreement_version,
           'seller_agreement_accepted_at', p.seller_agreement_accepted_at
         )
    INTO v_result
  FROM public.dkai_profiles AS p
  WHERE p.id = v_uid;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'seller_profile_not_found for authenticated user %', v_uid
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dkai_get_my_seller_agreement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_get_my_seller_agreement() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dkai_get_my_seller_agreement() TO service_role;

-- 4) Repair accounts that already accepted through either legacy field.
UPDATE public.dkai_profiles
   SET seller_agreement_accepted = true,
       seller_agreement_version = '2026-08-17-v4',
       seller_agreement_accepted_at = COALESCE(seller_agreement_accepted_at, terms_accepted_at, now()),
       seller_obligations_pdf_acknowledged = true,
       terms_accepted = true,
       terms_accepted_at = COALESCE(terms_accepted_at, seller_agreement_accepted_at, now()),
       updated_at = now()
 WHERE (seller_agreement_accepted IS TRUE OR terms_accepted IS TRUE)
   AND (seller_agreement_version IS DISTINCT FROM '2026-08-17-v4'
        OR seller_agreement_accepted IS DISTINCT FROM true
        OR seller_obligations_pdf_acknowledged IS DISTINCT FROM true);

COMMIT;

NOTIFY pgrst, 'reload schema';
