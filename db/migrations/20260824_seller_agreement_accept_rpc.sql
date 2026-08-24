-- Fixes "Acceptance could not be saved to your profile".
-- Root cause: public.dkai_profiles has COLUMN-LEVEL GRANT UPDATE (see
-- 20260815_profile_save_permissions.sql). Because column grants exist, the
-- `authenticated` role may only update the listed columns — the seller
-- agreement / terms columns were never granted, so the Confirm write was
-- rejected (or silently affected 0 rows) for every seller.
--
-- This migration:
--   1) grants UPDATE on the consent columns,
--   2) adds a SECURITY DEFINER RPC the client can call so acceptance is
--      recorded atomically on the caller's own row only.

BEGIN;

-- 0) Make sure every column we touch exists.
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS seller_agreement_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_agreement_version text,
  ADD COLUMN IF NOT EXISTS seller_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_obligations_pdf_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_obligations_pdf_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 1) Column-level grants for the consent fields (RLS still limits the row).
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

GRANT SELECT ON public.dkai_profiles TO authenticated;
GRANT ALL ON public.dkai_profiles TO service_role;

-- 2) Atomic, self-only acceptance RPC.
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
AS $$
DECLARE
  uid uuid := auth.uid();
  now_ts timestamptz := now();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.dkai_profiles p
     SET seller_agreement_accepted = true,
         seller_agreement_version = p_version,
         seller_agreement_accepted_at = now_ts,
         seller_obligations_pdf_acknowledged = true,
         seller_obligations_pdf_version = COALESCE(p_pdf_version, p.seller_obligations_pdf_version),
         terms_accepted = true,
         terms_accepted_at = COALESCE(p.terms_accepted_at, now_ts),
         updated_at = now_ts
   WHERE p.id = uid;

  IF NOT FOUND THEN
    INSERT INTO public.dkai_profiles (
      id, seller_agreement_accepted, seller_agreement_version, seller_agreement_accepted_at,
      seller_obligations_pdf_acknowledged, seller_obligations_pdf_version,
      terms_accepted, terms_accepted_at, updated_at
    ) VALUES (
      uid, true, p_version, now_ts, true, p_pdf_version, true, now_ts, now_ts
    )
    ON CONFLICT (id) DO UPDATE
      SET seller_agreement_accepted = true,
          seller_agreement_version = EXCLUDED.seller_agreement_version,
          seller_agreement_accepted_at = EXCLUDED.seller_agreement_accepted_at,
          seller_obligations_pdf_acknowledged = true,
          seller_obligations_pdf_version = EXCLUDED.seller_obligations_pdf_version,
          terms_accepted = true,
          updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN QUERY
    SELECT p.id, p.seller_agreement_accepted, p.seller_agreement_version
    FROM public.dkai_profiles p
    WHERE p.id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.dkai_accept_seller_agreement(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dkai_accept_seller_agreement(text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
