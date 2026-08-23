-- Per-product confirmation that the listing complies with the Seller Rules & Obligations.
-- The binding acceptance stays at account level (dkai_profiles.seller_agreement_*);
-- this only records the product-level confirmation checkbox from the create wizard.
ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS seller_rules_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_rules_confirmed_at timestamptz;

GRANT SELECT ON public.dkai_products TO authenticated;
GRANT ALL ON public.dkai_products TO service_role;

NOTIFY pgrst, 'reload schema';
