-- Add markdown body column to dkai_platform_rules (keeps legacy `rules` text[] as fallback)
ALTER TABLE public.dkai_platform_rules
  ADD COLUMN IF NOT EXISTS body text;

COMMENT ON COLUMN public.dkai_platform_rules.body IS
  'Markdown source of truth for the rules text. When present, the UI renders this via react-markdown and ignores the legacy `rules` text[] array. Keep `rules` populated for backward compatibility until all rule_types have been migrated.';

-- Optional one-shot migration: backfill body from the legacy array for any rows
-- that don't have a body yet, so nothing renders blank during the transition.
UPDATE public.dkai_platform_rules
   SET body = (
     SELECT string_agg(format('%s. %s', idx, val), E'\n\n')
       FROM unnest(rules) WITH ORDINALITY AS t(val, idx)
   )
 WHERE body IS NULL
   AND rules IS NOT NULL
   AND array_length(rules, 1) > 0;
