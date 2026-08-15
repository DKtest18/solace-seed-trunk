-- Hardening for the LinkedIn ZIP import (client-side parse -> dkai_profiles update).
-- Safe to re-run.

-- 1) Make sure every column the importer writes exists.
ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Server-side size/shape limits so a crafted ZIP cannot bloat or poison a row.
CREATE OR REPLACE FUNCTION public.dkai_json_array_ok(
  val jsonb, max_items int, max_bytes int
) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT val IS NULL
     OR (jsonb_typeof(val) = 'array'
         AND jsonb_array_length(val) <= max_items
         AND octet_length(val::text) <= max_bytes)
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_experience_limits') THEN
    ALTER TABLE public.dkai_profiles ADD CONSTRAINT dkai_profiles_experience_limits
      CHECK (public.dkai_json_array_ok(experience, 60, 120000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_education_limits') THEN
    ALTER TABLE public.dkai_profiles ADD CONSTRAINT dkai_profiles_education_limits
      CHECK (public.dkai_json_array_ok(education, 40, 60000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_skills_limits') THEN
    ALTER TABLE public.dkai_profiles ADD CONSTRAINT dkai_profiles_skills_limits
      CHECK (public.dkai_json_array_ok(skills, 100, 20000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_headline_len') THEN
    ALTER TABLE public.dkai_profiles ADD CONSTRAINT dkai_profiles_headline_len
      CHECK (headline IS NULL OR char_length(headline) <= 220);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_bio_len') THEN
    ALTER TABLE public.dkai_profiles ADD CONSTRAINT dkai_profiles_bio_len
      CHECK (bio IS NULL OR char_length(bio) <= 5000);
  END IF;
  -- Only real http(s) links; blocks javascript:/data: payloads.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_linkedin_url_scheme') THEN
    ALTER TABLE public.dkai_profiles ADD CONSTRAINT dkai_profiles_linkedin_url_scheme
      CHECK (linkedin_url IS NULL OR linkedin_url ~* '^https?://([a-z0-9-]+\.)*linkedin\.com/.+');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_website_url_scheme') THEN
    ALTER TABLE public.dkai_profiles ADD CONSTRAINT dkai_profiles_website_url_scheme
      CHECK (website_url IS NULL OR website_url ~* '^https?://.+');
  END IF;
END $$;

-- 3) Column-level grants: authenticated may only touch its own profile fields.
--    No anon write access anywhere.
GRANT UPDATE (
  username, full_name, headline, bio, expanded_bio, website_url, linkedin_url,
  country, avatar_url, banner_url, experience, education, skills,
  open_to_work, open_to_roles, is_hiring, hiring_roles,
  avatar_zoom, avatar_position_x, avatar_position_y
) ON public.dkai_profiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.dkai_profiles FROM anon;

-- 4) RLS: own-row-only writes (idempotent).
ALTER TABLE public.dkai_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users update own profile" ON public.dkai_profiles;
CREATE POLICY "Users update own profile"
  ON public.dkai_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
