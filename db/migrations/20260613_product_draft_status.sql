-- Add draft support to dkai_products
-- 'draft'   = work-in-progress, not visible to staff or buyers
-- 'pending' = submitted for admin review
-- 'active'  = approved + published
-- 'archived'/'rejected' = optional future states
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Backfill: any existing row is already past the draft phase
UPDATE public.dkai_products SET status = 'pending'
  WHERE status = 'draft' AND (is_published = true OR approval_status IS NOT NULL OR moderation_status IS NOT NULL);

CREATE INDEX IF NOT EXISTS dkai_products_seller_status_idx
  ON public.dkai_products (seller_id, status);
