-- Add super_admin as a first-class app role so authorization for the
-- super-admin console can be enforced via dkai_has_role() server-side,
-- replacing the previous hardcoded-email client-side check.
--
-- Idempotent: safe to re-run if the value already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END $$;
