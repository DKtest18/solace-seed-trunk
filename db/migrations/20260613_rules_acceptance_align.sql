-- Align rules acceptance on a single table: public.dkai_rules_acceptance
-- Both the client hook and the accept-platform-rules edge function will use this table.

CREATE TABLE IF NOT EXISTS public.dkai_rules_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  rules_version integer NOT NULL DEFAULT 1,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_type)
);

-- Make sure required columns exist on pre-existing tables
ALTER TABLE public.dkai_rules_acceptance
  ADD COLUMN IF NOT EXISTS rule_type text,
  ADD COLUMN IF NOT EXISTS rules_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dkai_rules_acceptance_user_rule_unique'
  ) THEN
    ALTER TABLE public.dkai_rules_acceptance
      ADD CONSTRAINT dkai_rules_acceptance_user_rule_unique UNIQUE (user_id, rule_type);
  END IF;
END $$;

-- Migrate any data from the old table if it exists, then drop it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='dkai_user_rules_acceptance') THEN
    INSERT INTO public.dkai_rules_acceptance (user_id, rule_type, rules_version, accepted_at)
    SELECT user_id, rule_type, COALESCE(rules_version, 1), COALESCE(accepted_at, now())
    FROM public.dkai_user_rules_acceptance
    ON CONFLICT (user_id, rule_type) DO NOTHING;

    DROP TABLE public.dkai_user_rules_acceptance;
  END IF;
END $$;

-- Grants (PostgREST/Data API)
GRANT SELECT, INSERT, UPDATE ON public.dkai_rules_acceptance TO authenticated;
GRANT ALL ON public.dkai_rules_acceptance TO service_role;

-- RLS
ALTER TABLE public.dkai_rules_acceptance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own acceptance" ON public.dkai_rules_acceptance;
CREATE POLICY "Users select own acceptance"
  ON public.dkai_rules_acceptance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own acceptance" ON public.dkai_rules_acceptance;
CREATE POLICY "Users insert own acceptance"
  ON public.dkai_rules_acceptance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own acceptance" ON public.dkai_rules_acceptance;
CREATE POLICY "Users update own acceptance"
  ON public.dkai_rules_acceptance FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
