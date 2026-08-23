-- Fix product draft creation failing with:
-- null value in column "demo_video_paths" violates not-null constraint

BEGIN;

ALTER TABLE public.dkai_products
  ADD COLUMN IF NOT EXISTS demo_video_paths jsonb;

UPDATE public.dkai_products
SET demo_video_paths = '[]'::jsonb
WHERE demo_video_paths IS NULL;

ALTER TABLE public.dkai_products
  ALTER COLUMN demo_video_paths SET DEFAULT '[]'::jsonb,
  ALTER COLUMN demo_video_paths SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dkai_products_demo_video_paths_is_array'
      AND conrelid = 'public.dkai_products'::regclass
  ) THEN
    ALTER TABLE public.dkai_products
      ADD CONSTRAINT dkai_products_demo_video_paths_is_array
      CHECK (jsonb_typeof(demo_video_paths) = 'array');
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dkai_products TO authenticated;
GRANT ALL ON public.dkai_products TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;