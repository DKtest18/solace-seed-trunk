-- Seller tabs / admin queue alignment for public.dkai_products.review_status
-- Idempotent. Column-existence guarded. No RLS change, no bucket change.

BEGIN;

-- 1) Every row must have a canonical review_status (never NULL).
UPDATE public.dkai_products
   SET review_status = 'draft'
 WHERE review_status IS NULL OR btrim(review_status) = '';

-- 2) Normalise legacy values onto the canonical set.
UPDATE public.dkai_products SET review_status = 'in_review'
 WHERE lower(btrim(review_status)) IN ('pending','pending_review','reviewing','under_review');

UPDATE public.dkai_products SET review_status = 'changes_requested'
 WHERE lower(btrim(review_status)) IN ('changes-requested','needs_changes','needs-changes','revision_requested');

UPDATE public.dkai_products SET review_status = 'rejected'
 WHERE lower(btrim(review_status)) IN ('declined','denied');

UPDATE public.dkai_products SET review_status = 'approved'
 WHERE lower(btrim(review_status)) IN ('published','live');

UPDATE public.dkai_products SET review_status = lower(btrim(review_status))
 WHERE review_status <> lower(btrim(review_status));

-- 3) Legacy `status` column must not contradict review_status for submitted rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dkai_products' AND column_name = 'status'
  ) THEN
    EXECUTE $sql$
      UPDATE public.dkai_products
         SET status = 'pending'
       WHERE review_status IN ('submitted','in_review')
         AND status = 'draft'
    $sql$;
  END IF;
END $$;

-- 4) Default + canonical CHECK (kept permissive of NULL for safety).
ALTER TABLE public.dkai_products ALTER COLUMN review_status SET DEFAULT 'draft';

ALTER TABLE public.dkai_products
  DROP CONSTRAINT IF EXISTS dkai_products_review_status_check;

ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_review_status_check
  CHECK (
    review_status IS NULL
    OR review_status IN (
      'draft','submitted','in_review','approved',
      'rejected','changes_requested','locked_exclusive','delisted'
    )
  ) NOT VALID;

ALTER TABLE public.dkai_products VALIDATE CONSTRAINT dkai_products_review_status_check;

-- 5) Indexes for the seller tabs and the admin queue.
CREATE INDEX IF NOT EXISTS dkai_products_seller_review_status_idx
  ON public.dkai_products (seller_id, review_status);

CREATE INDEX IF NOT EXISTS dkai_products_review_status_submitted_at_idx
  ON public.dkai_products (review_status, submitted_at DESC);

COMMIT;

NOTIFY pgrst, 'reload schema';
