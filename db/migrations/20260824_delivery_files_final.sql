-- ============================================================================
-- Delivery files: final private, idempotent schema and RLS repair.
-- Run in the Supabase SQL editor after creating the PRIVATE
-- `product-deliveries` bucket in Storage settings.
-- ============================================================================

BEGIN;

-- Fail clearly instead of guessing this project's product key/owner columns.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_products' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'Required column public.dkai_products.id does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_products' AND column_name = 'seller_id'
  ) THEN
    RAISE EXCEPTION 'Required column public.dkai_products.seller_id does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_products' AND column_name = 'review_status'
  ) THEN
    RAISE EXCEPTION 'Required column public.dkai_products.review_status does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_products' AND column_name = 'submitted_at'
  ) THEN
    RAISE EXCEPTION 'Required column public.dkai_products.submitted_at does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_products' AND column_name = 'created_at'
  ) THEN
    RAISE EXCEPTION 'Required column public.dkai_products.created_at does not exist';
  END IF;
END $$;

-- Compatibility summary fields used by existing admin/product views.
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS file_storage_key text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS file_scan_status text;

-- Canonical review states. Normalize first so unrelated future product updates
-- can never fail because an old row retained a legacy or blank value.
ALTER TABLE public.dkai_products
  DROP CONSTRAINT IF EXISTS dkai_products_review_status_check;

UPDATE public.dkai_products
SET review_status = lower(btrim(review_status))
WHERE review_status IS NOT NULL;

UPDATE public.dkai_products SET review_status = 'in_review'
WHERE review_status IN ('pending', 'pending_review', 'reviewing', 'under_review');
UPDATE public.dkai_products SET review_status = 'changes_requested'
WHERE review_status IN ('changes-requested', 'needs_changes', 'needs-changes', 'revision_requested');
UPDATE public.dkai_products SET review_status = 'rejected'
WHERE review_status IN ('declined', 'denied');
UPDATE public.dkai_products SET review_status = 'approved'
WHERE review_status IN ('published', 'live');
UPDATE public.dkai_products SET review_status = 'delisted'
WHERE review_status IN ('removed', 'unlisted');
UPDATE public.dkai_products SET review_status = 'draft'
WHERE review_status IS NULL OR review_status = '' OR review_status NOT IN (
  'draft', 'submitted', 'in_review', 'approved', 'rejected',
  'changes_requested', 'locked_exclusive', 'delisted'
);

ALTER TABLE public.dkai_products
  ALTER COLUMN review_status SET DEFAULT 'draft',
  ALTER COLUMN review_status SET NOT NULL;
ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_review_status_check
  CHECK (review_status IN (
    'draft', 'submitted', 'in_review', 'approved', 'rejected',
    'changes_requested', 'locked_exclusive', 'delisted'
  ));

GRANT UPDATE (file_storage_key, file_size_bytes, file_scan_status)
  ON public.dkai_products TO authenticated;

-- Dedicated multi-file records. No review_status exists here by design.
CREATE TABLE IF NOT EXISTS public.dkai_product_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.dkai_products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'product-deliveries',
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  file_size bigint NOT NULL CHECK (file_size >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending', 'clean', 'infected', 'failed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_product_files TO authenticated;
GRANT ALL ON public.dkai_product_files TO service_role;

-- Upgrade the previous table shape without guessing which version is installed.
ALTER TABLE public.dkai_product_files
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS scan_status text DEFAULT 'pending';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_product_files' AND column_name = 'file_path'
  ) THEN
    EXECUTE 'UPDATE public.dkai_product_files SET storage_path = file_path, storage_bucket = COALESCE(storage_bucket, ''product-files'') WHERE storage_path IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_product_files' AND column_name = 'file_name'
  ) THEN
    EXECUTE 'UPDATE public.dkai_product_files SET original_filename = file_name WHERE original_filename IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_product_files' AND column_name = 'uploaded_by'
  ) THEN
    EXECUTE 'UPDATE public.dkai_product_files SET seller_id = uploaded_by WHERE seller_id IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_product_files' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'UPDATE public.dkai_product_files SET uploaded_at = created_at WHERE uploaded_at IS NULL';
  END IF;
END $$;

UPDATE public.dkai_product_files
SET storage_bucket = 'product-deliveries'
WHERE storage_bucket IS NULL;

UPDATE public.dkai_product_files
SET file_size = 0
WHERE file_size IS NULL;

UPDATE public.dkai_product_files
SET uploaded_at = now()
WHERE uploaded_at IS NULL;

UPDATE public.dkai_product_files
SET scan_status = 'pending'
WHERE scan_status IS NULL OR scan_status NOT IN ('pending', 'clean', 'infected', 'failed');

UPDATE public.dkai_product_files f
SET seller_id = p.seller_id
FROM public.dkai_products p
WHERE p.id = f.product_id AND f.seller_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dkai_product_files
    WHERE seller_id IS NULL OR storage_path IS NULL OR original_filename IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing dkai_product_files rows could not be migrated: seller_id, storage_path, or original_filename is NULL';
  END IF;
END $$;

ALTER TABLE public.dkai_product_files
  ALTER COLUMN seller_id SET NOT NULL,
  ALTER COLUMN storage_bucket SET DEFAULT 'product-deliveries',
  ALTER COLUMN storage_bucket SET NOT NULL,
  ALTER COLUMN storage_path SET NOT NULL,
  ALTER COLUMN original_filename SET NOT NULL,
  ALTER COLUMN file_size SET NOT NULL,
  ALTER COLUMN uploaded_at SET NOT NULL,
  ALTER COLUMN scan_status SET NOT NULL;

-- Legacy columns may remain for compatibility, but new writes use the canonical
-- names above and therefore must not be blocked by obsolete NOT NULL flags.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_product_files' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE public.dkai_product_files ALTER COLUMN file_path DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_product_files' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.dkai_product_files ALTER COLUMN file_name DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dkai_product_files' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE public.dkai_product_files ALTER COLUMN uploaded_by DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_product_files_seller_id_fkey') THEN
    ALTER TABLE public.dkai_product_files
      ADD CONSTRAINT dkai_product_files_seller_id_fkey
      FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_product_files_product_id_fkey') THEN
    ALTER TABLE public.dkai_product_files
      ADD CONSTRAINT dkai_product_files_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.dkai_products(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.dkai_product_files
  DROP CONSTRAINT IF EXISTS dkai_product_files_scan_status_check;
ALTER TABLE public.dkai_product_files
  ADD CONSTRAINT dkai_product_files_scan_status_check
  CHECK (scan_status IN ('pending', 'clean', 'infected', 'failed'));

CREATE INDEX IF NOT EXISTS dkai_product_files_product_uploaded_idx
  ON public.dkai_product_files (product_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS dkai_product_files_seller_idx
  ON public.dkai_product_files (seller_id);
DROP INDEX IF EXISTS public.dkai_product_files_storage_path_uidx;
CREATE UNIQUE INDEX dkai_product_files_storage_path_uidx
  ON public.dkai_product_files (storage_bucket, storage_path);

-- Enforce ten records per product even under direct API writes.
CREATE OR REPLACE FUNCTION public.dkai_enforce_product_file_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.product_id::text, 0));
  IF (SELECT count(*) FROM public.dkai_product_files WHERE product_id = NEW.product_id) >= 10 THEN
    RAISE EXCEPTION 'A product can have at most 10 delivery files' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dkai_product_files_limit_10 ON public.dkai_product_files;
CREATE TRIGGER dkai_product_files_limit_10
  BEFORE INSERT ON public.dkai_product_files
  FOR EACH ROW EXECUTE FUNCTION public.dkai_enforce_product_file_limit();

ALTER TABLE public.dkai_product_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dkai_product_files FROM anon;

DROP POLICY IF EXISTS "Buyers can view purchased product files" ON public.dkai_product_files;
DROP POLICY IF EXISTS "Sellers manage own product files" ON public.dkai_product_files;
DROP POLICY IF EXISTS "Admins can view all product files" ON public.dkai_product_files;
DROP POLICY IF EXISTS "Delivery sellers select own" ON public.dkai_product_files;
DROP POLICY IF EXISTS "Delivery sellers insert own" ON public.dkai_product_files;
DROP POLICY IF EXISTS "Delivery sellers update own" ON public.dkai_product_files;
DROP POLICY IF EXISTS "Delivery sellers delete own" ON public.dkai_product_files;
DROP POLICY IF EXISTS "Delivery admins read" ON public.dkai_product_files;

CREATE POLICY "Delivery sellers select own"
  ON public.dkai_product_files FOR SELECT TO authenticated
  USING (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dkai_products p
      WHERE p.id = dkai_product_files.product_id AND p.seller_id = auth.uid()
    )
  );
CREATE POLICY "Delivery sellers insert own"
  ON public.dkai_product_files FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dkai_products p
      WHERE p.id = dkai_product_files.product_id AND p.seller_id = auth.uid()
    )
  );
CREATE POLICY "Delivery sellers update own"
  ON public.dkai_product_files FOR UPDATE TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dkai_products p
      WHERE p.id = dkai_product_files.product_id AND p.seller_id = auth.uid()
    )
  );
CREATE POLICY "Delivery sellers delete own"
  ON public.dkai_product_files FOR DELETE TO authenticated
  USING (seller_id = auth.uid());
CREATE POLICY "Delivery admins read"
  ON public.dkai_product_files FOR SELECT TO authenticated
  USING (public.dkai_has_role(auth.uid(), 'admin'));

-- Access audit records are service-role-only. The edge functions write these.
CREATE TABLE IF NOT EXISTS public.dkai_file_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_file_id uuid REFERENCES public.dkai_product_files(id) ON DELETE CASCADE,
  access_type text NOT NULL,
  justification text,
  ip_address text,
  user_agent text,
  signed_url_generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dkai_file_access_log
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS product_file_id uuid,
  ADD COLUMN IF NOT EXISTS access_type text,
  ADD COLUMN IF NOT EXISTS justification text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS signed_url_generated_at timestamptz DEFAULT now();

GRANT ALL ON public.dkai_file_access_log TO service_role;
REVOKE ALL ON public.dkai_file_access_log FROM anon, authenticated;
ALTER TABLE public.dkai_file_access_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS dkai_file_access_log_user_time_idx
  ON public.dkai_file_access_log (user_id, signed_url_generated_at DESC);
CREATE INDEX IF NOT EXISTS dkai_file_access_log_file_idx
  ON public.dkai_file_access_log (product_file_id);

-- Keep the current admin review queue fast and deterministic.
CREATE INDEX IF NOT EXISTS dkai_products_review_queue_idx
  ON public.dkai_products (review_status, submitted_at DESC, created_at DESC);

-- Storage bucket creation/configuration is intentionally performed with the
-- Storage API/dashboard, not by writing storage.buckets directly. Validate it.
DO $$
DECLARE
  bucket_public boolean;
BEGIN
  SELECT public INTO bucket_public FROM storage.buckets WHERE id = 'product-deliveries';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create the private product-deliveries bucket in Supabase Storage, then rerun this migration';
  END IF;
  IF bucket_public THEN
    RAISE EXCEPTION 'product-deliveries must be private';
  END IF;
END $$;

DROP POLICY IF EXISTS "Delivery sellers read own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery sellers insert own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery sellers update own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery sellers delete own objects" ON storage.objects;
DROP POLICY IF EXISTS "Delivery admins read objects" ON storage.objects;

CREATE POLICY "Delivery sellers read own objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-deliveries'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Delivery sellers insert own objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-deliveries'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(storage.foldername(name), 1) = 1
  );
CREATE POLICY "Delivery sellers update own objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-deliveries'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'product-deliveries'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(storage.foldername(name), 1) = 1
  );
CREATE POLICY "Delivery sellers delete own objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-deliveries'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Delivery admins read objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-deliveries'
    AND public.dkai_has_role(auth.uid(), 'admin')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';