-- Fix: any UPDATE on dkai_products (e.g. saving delivery file metadata) failed with
-- dkai_products_review_status_check because existing rows hold legacy/extra status
-- values that the old constraint did not allow.
BEGIN;

-- 1) Drop the too-narrow constraint
ALTER TABLE public.dkai_products
  DROP CONSTRAINT IF EXISTS dkai_products_review_status_check;

-- 2) Normalize legacy values so the data is consistent
UPDATE public.dkai_products
   SET review_status = lower(btrim(review_status))
 WHERE review_status IS NOT NULL
   AND review_status <> lower(btrim(review_status));

UPDATE public.dkai_products SET review_status = 'in_review'
 WHERE review_status IN ('pending', 'pending_review', 'reviewing');

UPDATE public.dkai_products SET review_status = 'changes_requested'
 WHERE review_status IN ('changes-requested', 'needs_changes');

-- 3) Recreate it with every status the app actually uses (NULL stays allowed for legacy rows)
ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_review_status_check
  CHECK (
    review_status IS NULL
    OR review_status IN (
      'draft',
      'submitted',
      'in_review',
      'approved',
      'rejected',
      'changes_requested',
      'locked_exclusive'
    )
  ) NOT VALID;

-- 4) Make sure sellers can still write their own rows / file records
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_product_files TO authenticated;
GRANT ALL ON public.dkai_products TO service_role;
GRANT ALL ON public.dkai_product_files TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
