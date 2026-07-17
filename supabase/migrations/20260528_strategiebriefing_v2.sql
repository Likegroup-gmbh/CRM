-- Strategiebriefing v2: Erweitert marke_kickoff um Kampagnen-Briefing-Felder
-- Bestehende Legacy-Daten (brand_essenz, mission, etc.) bleiben erhalten

ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS kampagnenart text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS kampagnen_zusammenfassung text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS beworben_typ text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS beworben_beschreibung text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS plattformen text[];
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS creator_branche text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS drehort text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS rechtliches text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS erfolgskriterien text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS learnings text;

-- Typ-spezifische Felder
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS ziel_influencer text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS format_influencer text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS funnel text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS ziel_paid text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS ziel_organic text;
ALTER TABLE public.marke_kickoff ADD COLUMN IF NOT EXISTS format_organic text;

-- Constraints
ALTER TABLE public.marke_kickoff DROP CONSTRAINT IF EXISTS marke_kickoff_kickoff_type_check;
ALTER TABLE public.marke_kickoff ADD CONSTRAINT marke_kickoff_kickoff_type_check
  CHECK (kickoff_type IN ('paid', 'organic', 'influencer'));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marke_kickoff_kampagnenart_check'
      AND conrelid = 'public.marke_kickoff'::regclass
  ) THEN
    ALTER TABLE public.marke_kickoff
      ADD CONSTRAINT marke_kickoff_kampagnenart_check
      CHECK (kampagnenart IS NULL OR kampagnenart IN ('influencer', 'organic', 'paid'));
  END IF;
END $$;

-- Unique Indexes für v2
CREATE UNIQUE INDEX IF NOT EXISTS idx_marke_kickoff_unique_marke_kampagnenart
  ON public.marke_kickoff (marke_id, kampagnenart)
  WHERE marke_id IS NOT NULL AND kampagnenart IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marke_kickoff_unique_unternehmen_kampagnenart
  ON public.marke_kickoff (unternehmen_id, kampagnenart)
  WHERE unternehmen_id IS NOT NULL AND marke_id IS NULL AND kampagnenart IS NOT NULL;

COMMENT ON COLUMN public.marke_kickoff.schema_version IS 'legacy = alte Brand-Kick-Off-Felder, v2 = neues Strategiebriefing';
COMMENT ON COLUMN public.marke_kickoff.kampagnenart IS 'v2: influencer, organic oder paid';

NOTIFY pgrst, 'reload schema';
