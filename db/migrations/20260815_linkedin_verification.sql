-- LinkedIn identity verification on profiles
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS is_linkedin_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linkedin_url text;

CREATE INDEX IF NOT EXISTS idx_dkai_profiles_linkedin_verified
  ON public.dkai_profiles (is_linkedin_verified)
  WHERE is_linkedin_verified;

GRANT SELECT ON public.dkai_profiles TO anon, authenticated;
GRANT UPDATE (is_linkedin_verified, linkedin_url, full_name, avatar_url) ON public.dkai_profiles TO authenticated;
GRANT ALL ON public.dkai_profiles TO service_role;

NOTIFY pgrst, 'reload schema';
