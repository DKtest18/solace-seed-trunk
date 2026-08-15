-- Let guests (not signed in) view public profiles of sellers / reviewers.
-- Only non-sensitive columns are exposed to anon. Safe to re-run.

ALTER TABLE public.dkai_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.dkai_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.dkai_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- anon may read ONLY these columns (email/phone/verification internals stay hidden).
REVOKE SELECT ON public.dkai_profiles FROM anon;
GRANT SELECT (
  id, username, full_name, headline, bio, expanded_bio, website_url, linkedin_url,
  is_linkedin_verified, country, avatar_url, banner_url,
  avatar_zoom, avatar_position_x, avatar_position_y,
  experience, education, skills,
  open_to_work, open_to_roles, is_hiring, hiring_roles,
  created_at
) ON public.dkai_profiles TO anon;

GRANT SELECT ON public.dkai_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
