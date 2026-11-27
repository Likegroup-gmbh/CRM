-- Reihenfolge der Skripte im Produktions-Tab, analog zu sortierung
-- bei Casting und Konzept. Pro Linie (Kampagne, Produktion, Briefing)
-- eine eigene Folge. Bestehende Zeilen behalten die bisherige Ansicht
-- (neueste zuerst). Neue Zeilen setzt der Trigger nach oben.

ALTER TABLE public.skripte
  ADD COLUMN IF NOT EXISTS sortierung integer;

COMMENT ON COLUMN public.skripte.sortierung IS
  'Anzeigereihenfolge im Skripte-Tab der Linie. 0 steht oben.';

WITH rang AS (
  SELECT id,
         (ROW_NUMBER() OVER (
            PARTITION BY kampagne_id, produktion_id, briefing_id
            ORDER BY created_at DESC NULLS LAST, id
          ) - 1)::integer AS neu
  FROM public.skripte
)
UPDATE public.skripte AS s
SET sortierung = rang.neu
FROM rang
WHERE s.id = rang.id
  AND s.sortierung IS NULL;

ALTER TABLE public.skripte
  ALTER COLUMN sortierung SET NOT NULL;

CREATE INDEX IF NOT EXISTS skripte_scope_sortierung_idx
  ON public.skripte (kampagne_id, produktion_id, briefing_id, sortierung);

CREATE OR REPLACE FUNCTION public.skripte_sortierung_setzen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sortierung IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MIN(sortierung), 0) - 1
    INTO NEW.sortierung
  FROM public.skripte
  WHERE kampagne_id IS NOT DISTINCT FROM NEW.kampagne_id
    AND produktion_id IS NOT DISTINCT FROM NEW.produktion_id
    AND briefing_id IS NOT DISTINCT FROM NEW.briefing_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skripte_sortierung_setzen ON public.skripte;
CREATE TRIGGER skripte_sortierung_setzen
  BEFORE INSERT ON public.skripte
  FOR EACH ROW
  EXECUTE FUNCTION public.skripte_sortierung_setzen();
