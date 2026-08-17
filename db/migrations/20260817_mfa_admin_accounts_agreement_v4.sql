-- =====================================================================
-- 2026-08-17 — MFA recovery codes, aal2 enforcement, admin account
-- analytics support, seller agreement v4 enforcement.
-- Fully idempotent. Additive only: no existing policy is loosened.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) One-time MFA recovery codes (hashes only, never plaintext)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dkai_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dkai_mfa_recovery_codes_user_hash_idx
  ON public.dkai_mfa_recovery_codes (user_id, code_hash);
CREATE INDEX IF NOT EXISTS dkai_mfa_recovery_codes_user_idx
  ON public.dkai_mfa_recovery_codes (user_id);

GRANT SELECT, UPDATE ON public.dkai_mfa_recovery_codes TO authenticated;
GRANT ALL ON public.dkai_mfa_recovery_codes TO service_role;

ALTER TABLE public.dkai_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Owner may read only metadata rows (hashes are useless without the pepper);
-- admins are deliberately NOT granted any read access here.
DROP POLICY IF EXISTS "own recovery codes select" ON public.dkai_mfa_recovery_codes;
CREATE POLICY "own recovery codes select"
  ON public.dkai_mfa_recovery_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own recovery codes update" ON public.dkai_mfa_recovery_codes;
CREATE POLICY "own recovery codes update"
  ON public.dkai_mfa_recovery_codes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT/DELETE policy: only the service role (edge functions) may issue codes.

-- ---------------------------------------------------------------------
-- 2) Server-side MFA (aal2) enforcement helper
-- ---------------------------------------------------------------------
-- TRUE when the caller's JWT is at aal2, or when the account has no verified
-- TOTP factor at all (nothing to satisfy). Accounts WITH 2FA that present an
-- aal1 token are rejected by any policy that ANDs this in.
CREATE OR REPLACE FUNCTION public.dkai_mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN true                 -- anon / guest paths untouched
      WHEN coalesce(auth.jwt() ->> 'aal', '') = 'aal2' THEN true
      ELSE NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid() AND f.status = 'verified'
      )
    END;
$$;

GRANT EXECUTE ON FUNCTION public.dkai_mfa_satisfied() TO authenticated, service_role;

-- Tighten (never loosen) the policies of the most sensitive tables by ANDing the
-- MFA requirement into their existing expressions. Re-runnable: policies that
-- already reference the helper are skipped.
DO $do$
DECLARE
  t text;
  pol record;
  new_qual text;
  new_check text;
  sql text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dkai_credential_handovers',
    'dkai_seller_payment_configs',
    'dkai_payout_requests',
    'dkai_admin_account_actions'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname, cmd, permissive, roles, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      IF coalesce(pol.qual, '') LIKE '%dkai_mfa_satisfied%'
         OR coalesce(pol.with_check, '') LIKE '%dkai_mfa_satisfied%' THEN
        CONTINUE;
      END IF;

      new_qual := CASE WHEN pol.qual IS NULL THEN NULL
                       ELSE '((' || pol.qual || ') AND public.dkai_mfa_satisfied())' END;
      new_check := CASE WHEN pol.with_check IS NULL THEN NULL
                        ELSE '((' || pol.with_check || ') AND public.dkai_mfa_satisfied())' END;

      sql := format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
      EXECUTE sql;

      sql := format(
        'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
        pol.policyname, t,
        CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        CASE pol.cmd WHEN 'ALL' THEN 'ALL' ELSE pol.cmd END,
        array_to_string(pol.roles, ', ')
      );
      IF new_qual IS NOT NULL THEN
        sql := sql || ' USING ' || new_qual;
      END IF;
      IF new_check IS NOT NULL THEN
        sql := sql || ' WITH CHECK ' || new_check;
      END IF;
      EXECUTE sql || ';';
    END LOOP;
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------
-- 3) Admin account analytics support
-- ---------------------------------------------------------------------
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE TABLE IF NOT EXISTS public.dkai_admin_account_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dkai_admin_account_actions_reason_len'
  ) THEN
    ALTER TABLE public.dkai_admin_account_actions
      ADD CONSTRAINT dkai_admin_account_actions_reason_len
      CHECK (char_length(btrim(reason)) >= 15);
  END IF;
END $$;

GRANT SELECT, INSERT ON public.dkai_admin_account_actions TO authenticated;
GRANT ALL ON public.dkai_admin_account_actions TO service_role;

ALTER TABLE public.dkai_admin_account_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read account actions" ON public.dkai_admin_account_actions;
CREATE POLICY "admins read account actions"
  ON public.dkai_admin_account_actions
  FOR SELECT
  TO authenticated
  USING (
    (public.dkai_has_role(auth.uid(), 'admin') OR public.dkai_has_role(auth.uid(), 'super_admin'))
    AND public.dkai_mfa_satisfied()
  );

DROP POLICY IF EXISTS "admins insert account actions" ON public.dkai_admin_account_actions;
CREATE POLICY "admins insert account actions"
  ON public.dkai_admin_account_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (public.dkai_has_role(auth.uid(), 'admin') OR public.dkai_has_role(auth.uid(), 'super_admin'))
    AND public.dkai_mfa_satisfied()
  );
-- No UPDATE / DELETE policy: the audit trail is append-only.

-- Admin overview RPC: zero rows for non-admins. Role-based only, no email checks.
CREATE OR REPLACE FUNCTION public.dkai_admin_account_overview()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  username text,
  signed_up timestamptz,
  last_sign_in timestamptz,
  is_seller boolean,
  banned_at timestamptz,
  total_products bigint,
  published_products bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    u.email::text,
    p.display_name,
    p.username,
    u.created_at,
    u.last_sign_in_at,
    EXISTS (
      SELECT 1 FROM public.dkai_user_roles r
      WHERE r.user_id = p.id AND r.role::text = 'seller'
    ),
    p.banned_at,
    (SELECT count(*) FROM public.dkai_products pr WHERE pr.seller_id = p.id),
    (SELECT count(*) FROM public.dkai_products pr
      WHERE pr.seller_id = p.id AND pr.review_status = 'approved')
  FROM public.dkai_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE public.dkai_has_role(auth.uid(), 'admin')
     OR public.dkai_has_role(auth.uid(), 'super_admin');
$$;

REVOKE ALL ON FUNCTION public.dkai_admin_account_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.dkai_admin_account_overview() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) Seller agreement version bump to 2026-08-17-v4
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dkai_require_seller_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  required_version constant text := '2026-08-17-v4';
  accepted boolean;
  accepted_version text;
BEGIN
  SELECT p.seller_agreement_accepted, p.seller_agreement_version
    INTO accepted, accepted_version
  FROM public.dkai_profiles p
  WHERE p.id = NEW.seller_id;

  IF coalesce(accepted, false) IS NOT TRUE OR coalesce(accepted_version, '') <> required_version THEN
    RAISE EXCEPTION
      'Seller agreement version % must be accepted before creating or updating products.',
      required_version;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dkai_products_require_seller_agreement ON public.dkai_products;
CREATE TRIGGER dkai_products_require_seller_agreement
  BEFORE INSERT OR UPDATE OF title, description, price, review_status
  ON public.dkai_products
  FOR EACH ROW
  EXECUTE FUNCTION public.dkai_require_seller_agreement();

NOTIFY pgrst, 'reload schema';
