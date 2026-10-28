-- Kooperationen ohne Briefing und ohne Produktion landen in keiner Produktion.
--
-- Hintergrund: Die Kampagne lädt Kooperationen über produktion_id. Der Trigger
-- produktion_aus_briefing greift nur mit briefing_id. Wer eine Kooperation ohne beides
-- anlegt (z. B. über die globale Kooperationen-Liste), erzeugt eine Zeile, die in der
-- Produktion nicht auftaucht ("Ninja - Q4 - Eligella Cup 2026").
--
-- Fallback: Hat die Kampagne genau eine Produktion, gehört die Kooperation dazu.
-- Bei mehreren oder keiner Produktion bleibt alles unverändert (Zuordnung ist dann
-- eine Entscheidung des Nutzers).
-- Name sortiert nach *_00_produktion_aus_briefing und vor *_sync_kampagne.

BEGIN;

CREATE OR REPLACE FUNCTION public.kooperation_produktion_aus_kampagne()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_produktion uuid;
BEGIN
  IF NEW.produktion_id IS NOT NULL OR NEW.kampagne_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id INTO v_produktion
    FROM public.produktion p
   WHERE p.kampagne_id = NEW.kampagne_id
   LIMIT 2;

  IF (SELECT count(*) FROM public.produktion WHERE kampagne_id = NEW.kampagne_id) = 1 THEN
    NEW.produktion_id := v_produktion;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kooperationen_01_produktion_aus_kampagne ON public.kooperationen;
CREATE TRIGGER kooperationen_01_produktion_aus_kampagne
  BEFORE INSERT OR UPDATE OF kampagne_id, produktion_id ON public.kooperationen
  FOR EACH ROW EXECUTE FUNCTION public.kooperation_produktion_aus_kampagne();

-- Altbestand: Kampagnen mit genau einer Produktion
UPDATE public.kooperationen k
   SET produktion_id = p.id
  FROM (
    SELECT kampagne_id, (array_agg(id))[1] AS id
      FROM public.produktion
     GROUP BY kampagne_id
    HAVING count(*) = 1
  ) p
 WHERE k.produktion_id IS NULL
   AND k.kampagne_id = p.kampagne_id;

COMMIT;
