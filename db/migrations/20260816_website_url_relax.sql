-- Allow empty-string website values (UI sends NULL, but older clients may send '')
-- and keep blocking javascript:/data: payloads.
ALTER TABLE public.dkai_profiles
  DROP CONSTRAINT IF EXISTS dkai_profiles_website_url_scheme;

ALTER TABLE public.dkai_profiles
  ADD CONSTRAINT dkai_profiles_website_url_scheme
  CHECK (
    website_url IS NULL
    OR btrim(website_url) = ''
    OR website_url ~* '^https?://[^\s/]+\.[^\s/]+'
  );

-- Make sure the column is writable by the owner of the row.
GRANT UPDATE (website_url) ON public.dkai_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
