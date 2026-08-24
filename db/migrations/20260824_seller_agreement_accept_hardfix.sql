-- FINAL FIX: "Acceptance could not be saved to your profile."
--
-- Root causes addressed here:
--   1) The previous RPC declared OUT columns with the SAME NAMES as
--      dkai_profiles columns (seller_agreement_accepted, seller_agreement_version).
--      In PL/pgSQL that makes those identifiers ambiguous inside the UPDATE /
--      SELECT, which aborts the function -> the client fell through to the
--      direct UPDATE and showed "could not be saved".
--   2) Column-level UPDATE grants on dkai_profiles did not always include the
--      consent columns, so the direct-UPDATE fallback also failed.
--   3) Missing profile row for the user (no INSERT fallback).
--
-- This migration is re-runnable and safe.

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

-- 1) Grants (RLS still restricts which row)
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

-- 2) Self-update RLS policy so the fallback path works too
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dkai_profiles'
      AND policyname = 'dkai_profiles_self_update'
  ) THEN
    CREATE POLICY dkai_profiles_self_update
      ON public.dkai_profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END
$$;

-- 3) Rebuild the acceptance RPC without ambiguous OUT names.
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
  v_version text := COALESCE(NULLIF(p_version, ''), '2026-08-17-v4');
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.dkai_profiles p
     SET seller_agreement_accepted = true,
         seller_agreement_version = v_version,
         seller_agreement_accepted_at = v_now,
         seller_obligations_pdf_acknowledged = true,
         seller_obligations_pdf_version = COALESCE(p_pdf_version, p.seller_obligations_pdf_version),
         terms_accepted = true,
         terms_accepted_at = COALESCE(p.terms_accepted_at, v_now),
         updated_at = v_now
   WHERE p.id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.dkai_profiles (
      id, seller_agreement_accepted, seller_agreement_version, seller_agreement_accepted_at,
      seller_obligations_pdf_acknowledged, seller_obligations_pdf_version,
      terms_accepted, terms_accepted_at, updated_at
    ) VALUES (
      v_uid, true, v_version, v_now, true, p_pdf_version, true, v_now, v_now
    )
    ON CONFLICT (id) DO UPDATE
      SET seller_agreement_accepted = true,
          seller_agreement_version = EXCLUDED.seller_agreement_version,
          seller_agreement_accepted_at = EXCLUDED.seller_agreement_accepted_at,
          seller_obligations_pdf_acknowledged = true,
          terms_accepted = true,
          updated_at = EXCLUDED.updated_at;
  END IF;

  SELECT jsonb_build_object(
           'id', p.id,
           'seller_agreement_accepted', p.seller_agreement_accepted,
           'seller_agreement_version', p.seller_agreement_version,
           'seller_agreement_accepted_at', p.seller_agreement_accepted_at
         )
    INTO v_result
  FROM public.dkai_profiles p
  WHERE p.id = v_uid;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dkai_accept_seller_agreement(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO service_role;

-- 4) Repair everyone who already accepted at any point.
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
