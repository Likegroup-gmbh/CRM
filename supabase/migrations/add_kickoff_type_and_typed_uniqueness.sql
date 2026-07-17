-- Kick-Off: Paid/Organic variants
-- Allows one kickoff per parent and type instead of one kickoff total.

ALTER TABLE public.marke_kickoff
ADD COLUMN IF NOT EXISTS kickoff_type text;

UPDATE public.marke_kickoff
SET kickoff_type = 'organic'
WHERE kickoff_type IS NULL;

ALTER TABLE public.marke_kickoff
ALTER COLUMN kickoff_type SET DEFAULT 'organic';

ALTER TABLE public.marke_kickoff
ALTER COLUMN kickoff_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marke_kickoff_kickoff_type_check'
      AND conrelid = 'public.marke_kickoff'::regclass
  ) THEN
    ALTER TABLE public.marke_kickoff
      ADD CONSTRAINT marke_kickoff_kickoff_type_check
      CHECK (kickoff_type IN ('paid', 'organic'));
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_marke_kickoff_unique_marke;
DROP INDEX IF EXISTS public.idx_marke_kickoff_unique_unternehmen;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marke_kickoff_unique_marke_type
  ON public.marke_kickoff (marke_id, kickoff_type)
  WHERE marke_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marke_kickoff_unique_unternehmen_type
  ON public.marke_kickoff (unternehmen_id, kickoff_type)
  WHERE unternehmen_id IS NOT NULL AND marke_id IS NULL;

NOTIFY pgrst, 'reload schema';
