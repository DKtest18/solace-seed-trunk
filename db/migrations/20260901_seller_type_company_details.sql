-- Part C — seller type (private / company) + optional company details.
-- ADDITIVE ONLY: new nullable columns on public.dkai_seller_applications.
-- No DROP / DELETE / TRUNCATE, no changes to existing columns, rows or policies.
--
-- NOTE: public.dkai_profiles.seller_type already exists and carries FEE semantics
-- ('founding' | 'private' | 'standard', see 20260606_dynamic_platform_fee.sql).
-- It is NOT touched here. The new onboarding seller type lives on the seller
-- application row instead.

ALTER TABLE public.dkai_seller_applications
  ADD COLUMN IF NOT EXISTS seller_type text,
  ADD COLUMN IF NOT EXISTS company_legal_name text,
  ADD COLUMN IF NOT EXISTS company_legal_form text,
  ADD COLUMN IF NOT EXISTS company_registration_country text,
  ADD COLUMN IF NOT EXISTS company_registration_number text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_representative_name text,
  ADD COLUMN IF NOT EXISTS company_contact_email text,
  ADD COLUMN IF NOT EXISTS seller_type_updated_at timestamptz;

-- NULL stays valid so existing seller rows are untouched and never blocked.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dkai_seller_applications_seller_type_check'
  ) THEN
    ALTER TABLE public.dkai_seller_applications
      ADD CONSTRAINT dkai_seller_applications_seller_type_check
      CHECK (seller_type IS NULL OR seller_type IN ('private', 'company')) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.dkai_seller_applications.seller_type IS
  'Onboarding seller type chosen by the user: private | company (NULL = not yet answered).';
