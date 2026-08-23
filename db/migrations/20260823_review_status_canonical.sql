-- ============================================================================
-- Canonical review_status for public.dkai_products
-- Idempotent. Safe to run multiple times.
--
-- Canonical set (matches src/lib/reviewStatus.ts REVIEW_STATUS):
--   draft, submitted, in_review, approved, rejected,
--   changes_requested, locked_exclusive, delisted
--
-- Nothing else may ever be written again. Legacy values are normalised below.
-- No RLS is weakened here, no bucket is made public.
-- ============================================================================

BEGIN;

-- 1) Drop the CHECK first so the normalising UPDATEs cannot be blocked by it.
ALTER TABLE public.dkai_products
  DROP CONSTRAINT IF EXISTS dkai_products_review_status_check;

-- 2) Trim/lowercase everything.
UPDATE public.dkai_products
   SET review_status = lower(btrim(review_status))
 WHERE review_status IS NOT NULL
   AND review_status <> lower(btrim(review_status));

-- 3) Map legacy values onto the canonical set.
UPDATE public.dkai_products SET review_status = 'in_review'
 WHERE review_status IN ('pending', 'pending_review', 'reviewing', 'under_review');

UPDATE public.dkai_products SET review_status = 'changes_requested'
 WHERE review_status IN ('changes-requested', 'needs_changes', 'needs-changes', 'revision_requested');

UPDATE public.dkai_products SET review_status = 'rejected'
 WHERE review_status IN ('declined', 'denied');

UPDATE public.dkai_products SET review_status = 'delisted'
 WHERE review_status IN ('removed', 'unlisted');

UPDATE public.dkai_products SET review_status = 'approved'
 WHERE review_status IN ('published', 'live');

-- 4) Anything still unknown, plus NULLs, becomes 'draft' (never publicly visible).
UPDATE public.dkai_products
   SET review_status = 'draft'
 WHERE review_status IS NULL
    OR review_status NOT IN (
      'draft','submitted','in_review','approved',
      'rejected','changes_requested','locked_exclusive','delisted'
    );

-- 5) Single source of truth in the database, mirroring the TS constant.
ALTER TABLE public.dkai_products
  ALTER COLUMN review_status SET DEFAULT 'draft';

ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_review_status_check
  CHECK (
    review_status IN (
      'draft','submitted','in_review','approved',
      'rejected','changes_requested','locked_exclusive','delisted'
    )
  ) NOT VALID;

-- Validate separately so the statement reports the offending rows clearly
-- instead of aborting the whole migration.
ALTER TABLE public.dkai_products
  VALIDATE CONSTRAINT dkai_products_review_status_check;

-- 6) Uploading a delivery file must never be a status transition. Make sure
--    sellers can persist file metadata without touching review_status.
GRANT UPDATE (file_storage_key, file_size_bytes, file_scan_status)
  ON public.dkai_products TO authenticated;

COMMIT;

-- 7) Sanity check — should list only canonical values.
-- SELECT review_status, count(*) FROM public.dkai_products GROUP BY 1 ORDER BY 2 DESC;
