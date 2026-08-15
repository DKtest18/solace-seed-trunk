-- Admin review note for the product review queue.
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS admin_review_note text;

ALTER TABLE public.dkai_products
  DROP CONSTRAINT IF EXISTS dkai_products_admin_review_note_len;
ALTER TABLE public.dkai_products
  ADD CONSTRAINT dkai_products_admin_review_note_len
  CHECK (admin_review_note IS NULL OR char_length(admin_review_note) <= 2000);

-- Admins may set the review note / review status; sellers read their own.
GRANT SELECT ON public.dkai_products TO authenticated;
GRANT UPDATE (review_status, admin_review_note) ON public.dkai_products TO authenticated;
GRANT ALL ON public.dkai_products TO service_role;

DROP POLICY IF EXISTS "Admins can moderate products" ON public.dkai_products;
CREATE POLICY "Admins can moderate products"
ON public.dkai_products
FOR UPDATE
TO authenticated
USING (public.dkai_has_role(auth.uid(), 'admin'))
WITH CHECK (public.dkai_has_role(auth.uid(), 'admin'));
