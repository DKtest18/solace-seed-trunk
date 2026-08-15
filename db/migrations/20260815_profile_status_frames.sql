-- Profile status frames ("Open to work" / "Hiring") + backfill of LinkedIn data
-- for accounts that were already connected before this release.
-- Safe to re-run.

-- 1) Status frame columns
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS open_to_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_to_roles text,
  ADD COLUMN IF NOT EXISTS is_hiring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hiring_roles text;

-- 2) Let users maintain their own rich profile fields
GRANT UPDATE (
  banner_url, headline, experience, education, skills,
  open_to_work, open_to_roles, is_hiring, hiring_roles
) ON public.dkai_profiles TO authenticated;

-- 3) Backfill LinkedIn data for accounts that already signed in with LinkedIn.
--    Reads the OIDC identity stored by Supabase Auth and mirrors it onto the profile.
WITH li AS (
  SELECT
    i.user_id,
    i.identity_data AS d
  FROM auth.identities i
  WHERE i.provider = 'linkedin_oidc'
)
UPDATE public.dkai_profiles p
SET
  is_linkedin_verified = true,
  full_name = COALESCE(
    NULLIF(p.full_name, ''),
    NULLIF(li.d->>'name', ''),
    NULLIF(TRIM(CONCAT(li.d->>'given_name', ' ', li.d->>'family_name')), '')
  ),
  avatar_url = COALESCE(NULLIF(p.avatar_url, ''), NULLIF(li.d->>'picture', '')),
  linkedin_url = COALESCE(
    NULLIF(p.linkedin_url, ''),
    NULLIF(li.d->>'linkedin_url', ''),
    NULLIF(li.d->>'profile', '')
  ),
  headline = COALESCE(NULLIF(p.headline, ''), NULLIF(li.d->>'headline', '')),
  updated_at = now()
FROM li
WHERE p.id = li.user_id;

-- 4) Same backfill for users whose provider metadata only lives on auth.users
UPDATE public.dkai_profiles p
SET
  is_linkedin_verified = true,
  full_name = COALESCE(NULLIF(p.full_name, ''), NULLIF(u.raw_user_meta_data->>'name', '')),
  avatar_url = COALESCE(NULLIF(p.avatar_url, ''), NULLIF(u.raw_user_meta_data->>'picture', '')),
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.is_linkedin_verified = false
  AND (
    u.raw_app_meta_data->>'provider' = 'linkedin_oidc'
    OR u.raw_app_meta_data->'providers' ? 'linkedin_oidc'
  );
