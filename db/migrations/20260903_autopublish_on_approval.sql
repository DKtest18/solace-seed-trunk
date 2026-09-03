-- Auto-publish a product the moment it is approved.
-- Works for every path (admin UI, decide-product-review edge function, SQL).
BEGIN;

CREATE OR REPLACE FUNCTION public.dkai_autopublish_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF COALESCE(NEW.review_status, '') IN ('approved', 'locked_exclusive') THEN
    NEW.is_published := true;

    IF to_regclass('public.dkai_products') IS NOT NULL THEN
      -- optional columns: only set when they exist
      BEGIN NEW.approval_status := 'approved'; EXCEPTION WHEN undefined_column THEN NULL; END;
      BEGIN NEW.moderation_status := 'approved'; EXCEPTION WHEN undefined_column THEN NULL; END;
      BEGIN NEW.is_active := COALESCE(NEW.is_active, true); EXCEPTION WHEN undefined_column THEN NULL; END;
      BEGIN NEW.available := true; EXCEPTION WHEN undefined_column THEN NULL; END;
      BEGIN NEW.approved_at := COALESCE(NEW.approved_at, now()); EXCEPTION WHEN undefined_column THEN NULL; END;
      BEGIN NEW.published_at := COALESCE(NEW.published_at, now()); EXCEPTION WHEN undefined_column THEN NULL; END;
      BEGIN NEW.exclusive_locked := COALESCE(NEW.exclusive_locked, false); EXCEPTION WHEN undefined_column THEN NULL; END;
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS dkai_autopublish_on_approval_trg ON public.dkai_products;
CREATE TRIGGER dkai_autopublish_on_approval_trg
BEFORE INSERT OR UPDATE OF review_status ON public.dkai_products
FOR EACH ROW EXECUTE FUNCTION public.dkai_autopublish_on_approval();

-- Backfill: everything already approved becomes live now.
UPDATE public.dkai_products
   SET review_status = review_status
 WHERE COALESCE(review_status, '') IN ('approved', 'locked_exclusive')
   AND COALESCE(is_published, false) = false;

COMMIT;

NOTIFY pgrst, 'reload schema';
