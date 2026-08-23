-- Fix: "column p.user_id does not exist" when submitting a product.
-- public.dkai_profiles does not have a user_id column on this database
-- (the owner column is id / profile_id / auth_user_id depending on age of the row set).
-- This migration rebuilds public.dkai_require_seller_agreement() so it resolves the
-- correct owner column dynamically. Idempotent, safe to re-run.

BEGIN;

DO $do$
DECLARE
  owner_col text;
BEGIN
  SELECT c.column_name
    INTO owner_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'dkai_profiles'
    AND c.column_name IN ('user_id', 'id', 'auth_user_id', 'profile_id')
  ORDER BY array_position(
    ARRAY['user_id','auth_user_id','profile_id','id'], c.column_name
  )
  LIMIT 1;

  IF owner_col IS NULL THEN
    RAISE EXCEPTION 'No owner column found on public.dkai_profiles';
  END IF;

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.dkai_require_seller_agreement()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      accepted boolean;
    BEGIN
      -- service_role (edge functions) bypasses the gate entirely
      IF current_setting('request.jwt.claims', true) IS NULL
         OR COALESCE(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role' THEN
        RETURN NEW;
      END IF;

      IF auth.uid() IS NOT NULL AND public.dkai_has_role(auth.uid(), 'admin') THEN
        RETURN NEW;
      END IF;

      SELECT COALESCE(p.seller_agreement_accepted, false)
        INTO accepted
      FROM public.dkai_profiles p
      WHERE p.%1$I = NEW.seller_id;

      IF COALESCE(accepted, false) = false THEN
        RAISE EXCEPTION 'seller_agreement_not_accepted' USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END;
    $body$;
  $fn$, owner_col);
END
$do$;

-- Re-attach the trigger only for the seller's own content edits,
-- never for status / media / file writes.
DROP TRIGGER IF EXISTS dkai_products_require_seller_agreement ON public.dkai_products;
CREATE TRIGGER dkai_products_require_seller_agreement
  BEFORE INSERT OR UPDATE OF title, description, price
  ON public.dkai_products
  FOR EACH ROW EXECUTE FUNCTION public.dkai_require_seller_agreement();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Sanity check:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='dkai_profiles' ORDER BY 1;
