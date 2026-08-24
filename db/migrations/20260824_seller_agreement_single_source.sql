-- Seller Agreement v4: align acceptance, onboarding, and product enforcement.
-- Re-runnable. Existing accepted users retain their acceptance.

BEGIN;

DO $verify_schema$
DECLARE
  missing_columns text;
BEGIN
  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
    INTO missing_columns
  FROM (
    VALUES
      ('id'),
      ('seller_agreement_accepted'),
      ('seller_agreement_version'),
      ('seller_agreement_accepted_at'),
      ('seller_obligations_pdf_acknowledged'),
      ('seller_obligations_pdf_version'),
      ('terms_accepted'),
      ('terms_accepted_at'),
      ('updated_at')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'dkai_profiles'
      AND c.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'public.dkai_profiles is missing required seller-agreement columns: %',
      missing_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dkai_products'
      AND column_name = 'seller_id'
  ) THEN
    RAISE EXCEPTION 'public.dkai_products is missing required column seller_id';
  END IF;
END;
$verify_schema$;

-- Preserve prior acceptance while normalising all accepted accounts to v4.
-- terms_accepted=true is included because the legacy Seller Terms checklist
-- wrote/read that field as its acceptance record. This repairs those stuck
-- users without asking them to accept a document they already accepted.
UPDATE public.dkai_profiles
SET seller_agreement_accepted = true,
    seller_agreement_version = '2026-08-17-v4',
    seller_agreement_accepted_at = COALESCE(seller_agreement_accepted_at, terms_accepted_at, now()),
    seller_obligations_pdf_acknowledged = true,
    terms_accepted = true,
    terms_accepted_at = COALESCE(terms_accepted_at, seller_agreement_accepted_at, now()),
    updated_at = now()
WHERE (seller_agreement_accepted IS TRUE OR terms_accepted IS TRUE)
  AND (
    seller_agreement_accepted IS DISTINCT FROM true
    OR seller_agreement_version IS DISTINCT FROM '2026-08-17-v4'
    OR seller_agreement_accepted_at IS NULL
    OR seller_obligations_pdf_acknowledged IS DISTINCT FROM true
    OR terms_accepted IS DISTINCT FROM true
    OR terms_accepted_at IS NULL
  );

-- Atomic self-only acceptance. The database refuses stale/unknown versions.
CREATE OR REPLACE FUNCTION public.dkai_accept_seller_agreement(
  p_version text,
  p_pdf_version text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  seller_agreement_accepted boolean,
  seller_agreement_version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid uuid := auth.uid();
  now_ts timestamptz := now();
  required_version constant text := '2026-08-17-v4';
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_version IS DISTINCT FROM required_version THEN
    RAISE EXCEPTION 'seller_agreement_version_mismatch: expected %, received %',
      required_version, COALESCE(p_version, '<null>')
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.dkai_profiles p
  SET seller_agreement_accepted = true,
      seller_agreement_version = required_version,
      seller_agreement_accepted_at = now_ts,
      seller_obligations_pdf_acknowledged = true,
      seller_obligations_pdf_version = COALESCE(p_pdf_version, p.seller_obligations_pdf_version),
      terms_accepted = true,
      terms_accepted_at = COALESCE(p.terms_accepted_at, now_ts),
      updated_at = now_ts
  WHERE p.id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seller_profile_not_found for authenticated user %', uid
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT p.id, p.seller_agreement_accepted, p.seller_agreement_version
  FROM public.dkai_profiles p
  WHERE p.id = uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.dkai_accept_seller_agreement(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO service_role;

-- Keep database enforcement and the application on the exact same version.
CREATE OR REPLACE FUNCTION public.dkai_require_seller_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  accepted boolean;
  accepted_version text;
  required_version constant text := '2026-08-17-v4';
BEGIN
  IF COALESCE(current_setting('request.jwt.claims', true), '') = ''
     OR COALESCE(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.dkai_has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT p.seller_agreement_accepted, p.seller_agreement_version
    INTO accepted, accepted_version
  FROM public.dkai_profiles p
  WHERE p.id = NEW.seller_id;

  IF COALESCE(accepted, false) IS NOT TRUE
     OR accepted_version IS DISTINCT FROM required_version THEN
    RAISE EXCEPTION
      'seller_agreement_not_accepted: version % is required (stored version: %)',
      required_version, COALESCE(accepted_version, '<null>')
      USING ERRCODE = 'P0001',
            HINT = 'Accept the current Seller Agreement before creating or editing a product.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS dkai_products_require_seller_agreement ON public.dkai_products;
CREATE TRIGGER dkai_products_require_seller_agreement
  BEFORE INSERT OR UPDATE OF title, description, price
  ON public.dkai_products
  FOR EACH ROW
  EXECUTE FUNCTION public.dkai_require_seller_agreement();

COMMIT;

NOTIFY pgrst, 'reload schema';