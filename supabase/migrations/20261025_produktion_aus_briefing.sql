-- Casting, Konzept, Skripte und Kooperationen übernehmen die Produktion ihres Briefings.
--
-- Hintergrund: Die Kampagne lädt Linien nur über produktion_id. Wer Casting oder Konzept
-- ohne Produktion anlegte (Seitenleiste, Drawer, Import), erzeugte Zeilen, die in der
-- Kampagne nicht auftauchten. Die Linie ist das Briefing, also gilt seine Produktion.
--
-- Greift nur bei produktion_id IS NULL und gesetztem briefing_id. Gehört das Briefing
-- zu einer anderen Kampagne als die Zeile, bleibt alles unverändert.
-- Der Name sortiert vor *_sync_kampagne. kampagne_id wird hier selbst gesetzt, weil
-- sync_kampagne bei einem reinen briefing_id-Update nicht feuert.

BEGIN;

CREATE OR REPLACE FUNCTION public.produktion_aus_briefing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_produktion uuid;
  v_kampagne uuid;
BEGIN
  IF NEW.produktion_id IS NOT NULL OR NEW.briefing_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.produktion_id, p.kampagne_id
    INTO v_produktion, v_kampagne
    FROM public.campaign_briefings b
    LEFT JOIN public.produktion p ON p.id = b.produktion_id
   WHERE b.id = NEW.briefing_id;

  IF v_produktion IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.kampagne_id IS NOT NULL AND v_kampagne IS DISTINCT FROM NEW.kampagne_id THEN
    RETURN NEW;
  END IF;

  NEW.produktion_id := v_produktion;
  NEW.kampagne_id := v_kampagne;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_auswahl_00_produktion_aus_briefing ON public.creator_auswahl;
CREATE TRIGGER creator_auswahl_00_produktion_aus_briefing
  BEFORE INSERT OR UPDATE OF briefing_id, produktion_id ON public.creator_auswahl
  FOR EACH ROW EXECUTE FUNCTION public.produktion_aus_briefing();

DROP TRIGGER IF EXISTS strategie_00_produktion_aus_briefing ON public.strategie;
CREATE TRIGGER strategie_00_produktion_aus_briefing
  BEFORE INSERT OR UPDATE OF briefing_id, produktion_id ON public.strategie
  FOR EACH ROW EXECUTE FUNCTION public.produktion_aus_briefing();

DROP TRIGGER IF EXISTS skripte_00_produktion_aus_briefing ON public.skripte;
CREATE TRIGGER skripte_00_produktion_aus_briefing
  BEFORE INSERT OR UPDATE OF briefing_id, produktion_id ON public.skripte
  FOR EACH ROW EXECUTE FUNCTION public.produktion_aus_briefing();

DROP TRIGGER IF EXISTS kooperationen_00_produktion_aus_briefing ON public.kooperationen;
CREATE TRIGGER kooperationen_00_produktion_aus_briefing
  BEFORE INSERT OR UPDATE OF briefing_id, produktion_id ON public.kooperationen
  FOR EACH ROW EXECUTE FUNCTION public.produktion_aus_briefing();

COMMIT;
