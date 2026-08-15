-- LinkedIn-style profile fields for dkai_profiles
-- Safe to re-run.

ALTER TABLE public.dkai_profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Shape reference (client-enforced):
-- experience: [{ id, title, company, start_date, end_date, is_current_role, location, description }]
-- education:  [{ id, school, degree, field_of_study, start_date, end_date, description }]
-- skills:     ["Automation", "Web Development"]

-- Basic sanity constraints (arrays only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_experience_is_array'
  ) THEN
    ALTER TABLE public.dkai_profiles
      ADD CONSTRAINT dkai_profiles_experience_is_array
      CHECK (jsonb_typeof(experience) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_education_is_array'
  ) THEN
    ALTER TABLE public.dkai_profiles
      ADD CONSTRAINT dkai_profiles_education_is_array
      CHECK (jsonb_typeof(education) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dkai_profiles_skills_is_array'
  ) THEN
    ALTER TABLE public.dkai_profiles
      ADD CONSTRAINT dkai_profiles_skills_is_array
      CHECK (jsonb_typeof(skills) = 'array');
  END IF;
END $$;
