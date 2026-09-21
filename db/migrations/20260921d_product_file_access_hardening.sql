-- =====================================================================
-- PRODUCT FILE ACCESS HARDENING  (additive, idempotent, re-runnable)
-- Project: dwqpkdatzdqhplgyhigg  — run in the Supabase SQL editor.
--
-- Fixes:
--  1. storage_path forgery: a seller could insert a dkai_product_files row
--     pointing into ANOTHER seller's storage folder; service-role edge
--     functions would then sign it for them. Now enforced in the database.
--  2. Role self-escalation: only 'seller' may be self-assigned; admin,
--     moderator and super_admin can only be granted by service_role.
--  3. Stale storage policies for the unused 'product-files' bucket removed.
--  4. Private bucket + grants for delivery files re-asserted.
-- =====================================================================

BEGIN;

-- ---------- 1. DELIVERY PATH OWNERSHIP -------------------------------
CREATE OR REPLACE FUNCTION public.dkai_enforce_delivery_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.storage_path IS NULL
     OR NEW.storage_path <> (NEW.seller_id::text || '/' || split_part(NEW.storage_path, '/', 2))
     OR split_part(NEW.storage_path, '/', 2) = ''
     OR array_length(string_to_array(NEW.storage_path, '/'), 1) <> 2
     OR NEW.storage_path LIKE '%..%'
  THEN
    RAISE EXCEPTION 'storage_path must be "<seller_id>/<filename>" for the owning seller'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dkai_products p
    WHERE p.id = NEW.product_id AND p.seller_id = NEW.seller_id
  ) THEN
    RAISE EXCEPTION 'seller_id must own the product'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dkai_product_files_path_guard ON public.dkai_product_files;
CREATE TRIGGER dkai_product_files_path_guard
  BEFORE INSERT OR UPDATE OF storage_path, seller_id, product_id
  ON public.dkai_product_files
  FOR EACH ROW EXECUTE FUNCTION public.dkai_enforce_delivery_path();

-- Report (do not delete) any pre-existing row that violates the rule.
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM public.dkai_product_files f
  WHERE f.storage_path IS DISTINCT FROM (f.seller_id::text || '/' || split_part(f.storage_path, '/', 2))
     OR array_length(string_to_array(f.storage_path, '/'), 1) <> 2;
  IF bad > 0 THEN
    RAISE WARNING 'dkai_product_files: % row(s) have a path outside their seller folder. Review them with the verification query below.', bad;
  END IF;
END $$;

-- ---------- 2. NO ROLE SELF-ESCALATION -------------------------------
CREATE OR REPLACE FUNCTION public.dkai_block_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (edge functions, SQL editor) may grant anything.
  IF current_setting('request.jwt.claim.role', true) IS NULL
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.role::text <> 'seller' THEN
    RAISE EXCEPTION 'Only the seller role can be self-assigned' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Roles can only be assigned to your own account' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dkai_user_roles_no_escalation ON public.dkai_user_roles;
CREATE TRIGGER dkai_user_roles_no_escalation
  BEFORE INSERT OR UPDATE ON public.dkai_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.dkai_block_role_escalation();

ALTER TABLE public.dkai_user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dkai_user_roles FROM anon;
GRANT SELECT, INSERT ON public.dkai_user_roles TO authenticated;
GRANT ALL ON public.dkai_user_roles TO service_role;

-- ---------- 3. DELIVERY TABLE GRANTS ---------------------------------
ALTER TABLE public.dkai_product_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dkai_product_files FROM anon;
GRANT SELECT, INSERT, DELETE ON public.dkai_product_files TO authenticated;
GRANT ALL ON public.dkai_product_files TO service_role;

REVOKE ALL ON public.dkai_file_access_log FROM anon, authenticated;
GRANT ALL ON public.dkai_file_access_log TO service_role;

-- ---------- 4. STORAGE ------------------------------------------------
DO $$
DECLARE is_public boolean;
BEGIN
  SELECT public INTO is_public FROM storage.buckets WHERE id = 'product-deliveries';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create the PRIVATE product-deliveries bucket, then rerun';
  END IF;
  IF is_public THEN
    RAISE EXCEPTION 'product-deliveries is PUBLIC. Set it to private in Storage settings, then rerun';
  END IF;
END $$;

-- Stale policies for a bucket this app does not use.
DROP POLICY IF EXISTS "Sellers manage own product file objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins read all product file objects" ON storage.objects;

DROP POLICY IF EXISTS "Delivery sellers read own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery sellers insert own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery sellers update own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery sellers delete own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery admins read objects" ON storage.objects;

CREATE POLICY "Delivery sellers read own objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-deliveries' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Delivery sellers insert own objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-deliveries'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(storage.foldername(name), 1) = 1
  );
CREATE POLICY "Delivery sellers update own objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-deliveries' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'product-deliveries'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(storage.foldername(name), 1) = 1
  );
CREATE POLICY "Delivery sellers delete own objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-deliveries' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Delivery admins read objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-deliveries' AND public.dkai_has_role(auth.uid(), 'admin'));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- VERIFICATION QUERIES (run after the migration)
-- =====================================================================
-- 1) All private buckets must be private:
-- select id, public from storage.buckets order by id;

-- 2) Delivery-file paths outside their seller folder (expect 0 rows):
-- select id, product_id, seller_id, storage_path from public.dkai_product_files
-- where storage_path is distinct from (seller_id::text || '/' || split_part(storage_path,'/',2))
--    or array_length(string_to_array(storage_path,'/'),1) <> 2;

-- 3) Who can read delivery rows (expect seller-own + admin only):
-- select policyname, cmd, roles, qual from pg_policies
-- where schemaname='public' and tablename='dkai_product_files';

-- 4) anon must have no privilege on private tables (expect 0 rows):
-- select table_name, grantee, privilege_type from information_schema.role_table_grants
-- where table_schema='public' and grantee='anon'
--   and table_name in ('dkai_product_files','dkai_file_access_log','dkai_user_roles');

-- 5) Elevated roles present (should only be accounts you granted yourself):
-- select user_id, role from public.dkai_user_roles where role::text <> 'seller';

-- 6) Storage policies on the delivery bucket:
-- select policyname, cmd, roles from pg_policies
-- where schemaname='storage' and tablename='objects' and policyname like 'Delivery%';
