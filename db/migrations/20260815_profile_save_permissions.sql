-- Ensure authenticated users can save every field exposed by Edit Profile.
-- Existing RLS still limits updates to the user's own dkai_profiles row.
GRANT UPDATE (
  username, full_name, headline, bio, expanded_bio, website_url, linkedin_url,
  country, avatar_url, banner_url, experience, education, skills,
  open_to_work, open_to_roles, is_hiring, hiring_roles,
  avatar_zoom, avatar_position_x, avatar_position_y
) ON public.dkai_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';