-- Produktion mit mehreren Linien (ADR 0045).
-- Briefing zeigt auf seine Produktion (campaign_briefings.produktion_id), nicht mehr
-- umgekehrt. Casting und Konzept bleiben pro Briefing genau ein Paar.

BEGIN;

ALTER TABLE public.campaign_briefings
  ADD COLUMN IF NOT EXISTS produktion_id uuid
  REFERENCES public.produktion(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.campaign_briefings.produktion_id IS
  'Produktion, in der dieses Briefing eine Linie bildet. Eine Produktion kann mehrere Briefings haben.';

CREATE INDEX IF NOT EXISTS campaign_briefings_produktion_id_idx
  ON public.campaign_briefings (produktion_id);

-- Backfill 1: bisherige Bindung produktion.briefing_id
UPDATE public.campaign_briefings b
   SET produktion_id = p.id
  FROM public.produktion p
 WHERE p.briefing_id = b.id
   AND b.produktion_id IS NULL;

-- Backfill 2: gewählte Ziel-Produktion am Entwurf
UPDATE public.campaign_briefings b
   SET produktion_id = b.ziel_produktion_id
 WHERE b.produktion_id IS NULL
   AND b.ziel_produktion_id IS NOT NULL;

-- Backfill 3: Produktion der Kinder (Casting, Konzept, Skripte, Kooperationen),
-- nur wenn eindeutig
WITH child AS (
  SELECT briefing_id, produktion_id FROM public.creator_auswahl
   WHERE briefing_id IS NOT NULL AND produktion_id IS NOT NULL
  UNION ALL
  SELECT briefing_id, produktion_id FROM public.strategie
   WHERE briefing_id IS NOT NULL AND produktion_id IS NOT NULL
  UNION ALL
  SELECT briefing_id, produktion_id FROM public.skripte
   WHERE briefing_id IS NOT NULL AND produktion_id IS NOT NULL
  UNION ALL
  SELECT briefing_id, produktion_id FROM public.kooperationen
   WHERE briefing_id IS NOT NULL AND produktion_id IS NOT NULL
),
eindeutig AS (
  SELECT briefing_id, (array_agg(DISTINCT produktion_id))[1] AS produktion_id
    FROM child
   GROUP BY briefing_id
  HAVING count(DISTINCT produktion_id) = 1
)
UPDATE public.campaign_briefings b
   SET produktion_id = e.produktion_id
  FROM eindeutig e
 WHERE b.id = e.briefing_id
   AND b.produktion_id IS NULL;

-- Backfill 4: Kampagne mit genau einer Produktion
WITH einzige AS (
  SELECT kampagne_id, (array_agg(id))[1] AS produktion_id
    FROM public.produktion
   GROUP BY kampagne_id
  HAVING count(*) = 1
)
UPDATE public.campaign_briefings b
   SET produktion_id = e.produktion_id
  FROM einzige e
 WHERE b.kampagne_id = e.kampagne_id
   AND b.produktion_id IS NULL;

-- Namenstrigger: Casting und Konzept folgen dem Briefing, die Produktion nicht mehr.
CREATE OR REPLACE FUNCTION public.sync_produktion_line_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.aktivierung_name IS NOT DISTINCT FROM OLD.aktivierung_name THEN
    RETURN NEW;
  END IF;

  UPDATE public.creator_auswahl
     SET name = NEW.aktivierung_name || ' Casting'
   WHERE briefing_id = NEW.id
     AND produktion_id IS NOT NULL;

  UPDATE public.strategie
     SET name = NEW.aktivierung_name || ' Konzept'
   WHERE briefing_id = NEW.id
     AND produktion_id IS NOT NULL;

  RETURN NEW;
END;
$$;

-- Eine Produktion ist nur ohne Briefing (Linie, auch Entwurf) löschbar.
CREATE OR REPLACE FUNCTION public.guard_produktion_mit_briefing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.campaign_briefings b WHERE b.produktion_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Produktion mit Briefing kann nicht gelöscht werden'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

-- Alte Bindung entfällt.
DROP INDEX IF EXISTS public.produktion_briefing_id_key;
ALTER TABLE public.produktion DROP COLUMN IF EXISTS briefing_id;
DROP INDEX IF EXISTS public.campaign_briefings_ziel_produktion_id_idx;
ALTER TABLE public.campaign_briefings DROP COLUMN IF EXISTS ziel_produktion_id;

COMMENT ON TABLE public.produktion IS
  'Container unter einer Kampagne. Linien hängen über campaign_briefings.produktion_id. budget ist das Produktionsbudget, leer heißt gemeinsamer Topf.';

-- Pro Linie genau ein Casting und ein Konzept. Nur anlegen, wenn der Bestand sauber ist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.creator_auswahl
     WHERE briefing_id IS NOT NULL
     GROUP BY briefing_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'creator_auswahl: mehrere Castings pro Briefing, Unique-Index nicht angelegt';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS creator_auswahl_briefing_id_key
      ON public.creator_auswahl (briefing_id) WHERE briefing_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.strategie
     WHERE briefing_id IS NOT NULL
     GROUP BY briefing_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'strategie: mehrere Konzepte pro Briefing, Unique-Index nicht angelegt';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS strategie_briefing_id_key
      ON public.strategie (briefing_id) WHERE briefing_id IS NOT NULL;
  END IF;
END $$;

COMMIT;
