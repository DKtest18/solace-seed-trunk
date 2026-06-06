-- =============================================================================
-- DK AI Marketplace — Dynamic per-seller platform fee + seller type
-- Adds platform_fee_percent and seller_type to dkai_profiles so checkout can
-- read the fee from the DB instead of hardcoding it in the edge function.
--
-- Default for all existing sellers: 5%.
-- =============================================================================

ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric NOT NULL DEFAULT 5
    CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  ADD COLUMN IF NOT EXISTS seller_type text NOT NULL DEFAULT 'standard'
    CHECK (seller_type IN ('founding','private','standard'));

-- Backfill: every existing seller defaults to 5% (the new column default already
-- handles new rows; this UPDATE normalises any pre-existing NULL/legacy rows).
UPDATE public.dkai_profiles
SET platform_fee_percent = 5
WHERE platform_fee_percent IS NULL OR platform_fee_percent = 10;

UPDATE public.dkai_profiles
SET seller_type = 'standard'
WHERE seller_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_dkai_profiles_seller_type
  ON public.dkai_profiles (seller_type);
