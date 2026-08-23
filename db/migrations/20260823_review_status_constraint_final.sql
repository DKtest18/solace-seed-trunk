-- Align public.dkai_products.review_status with the application-wide canonical set.
-- This migration does not update, delete, or otherwise rewrite any product row.

BEGIN;

ALTER TABLE public.dkai_products
  DROP CONSTRAINT IF EXISTS dkai_products_review_status_check;

ALTER TABLE public.dkai_products
  ALTER COLUMN review_status SET DEFAULT 'draft';

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
      'locked_exclusive',
      'delisted'
    )
  ) NOT VALID;

ALTER TABLE public.dkai_products
  VALIDATE CONSTRAINT dkai_products_review_status_check;

COMMIT;

NOTIFY pgrst, 'reload schema';