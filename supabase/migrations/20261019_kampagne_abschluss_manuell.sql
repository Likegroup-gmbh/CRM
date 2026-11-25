-- Kampagne manuell abschließen (Aktionsmenü „Als abgeschlossen markieren“).
--
-- kampagne.is_completed ist abgeleitet (alle Videos freigegeben) und wird von den Triggern aus
-- 20260831_kampagne_is_completed_materialized bei jeder Kooperation-/Freigabe-Änderung neu
-- berechnet. Ein manuell gesetzter Wert würde damit beim nächsten Video überschrieben.
-- Darum schreibt der Client nur das Flag abschluss_manuell; is_completed wird zu
-- „manuell abgeschlossen ODER alle Videos freigegeben“.

ALTER TABLE public.kampagne
  ADD COLUMN IF NOT EXISTS abschluss_manuell boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.kampagne.abschluss_manuell IS
  'Manuell als abgeschlossen markiert (Aktionsmenü). Wirkt über is_completed; die Freigabe-Regel bleibt unverändert.';

CREATE OR REPLACE FUNCTION public.refresh_kampagne_is_completed(p_kampagne_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_kampagne_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE kampagne k
  SET is_completed = (
    k.abschluss_manuell
    OR (
      EXISTS (SELECT 1 FROM kooperationen ko WHERE ko.kampagne_id = p_kampagne_id)
      AND NOT EXISTS (
        SELECT 1
        FROM kooperationen ko
        WHERE ko.kampagne_id = p_kampagne_id
          AND (
            NOT EXISTS (
              SELECT 1 FROM kooperation_videos kv WHERE kv.kooperation_id = ko.id
            )
            OR EXISTS (
              SELECT 1
              FROM kooperation_videos kv
              WHERE kv.kooperation_id = ko.id
                AND kv.freigabe IS NOT TRUE
            )
          )
      )
    )
  )
  WHERE k.id = p_kampagne_id;
END;
$$;

-- Flag umschalten -> is_completed neu berechnen. Die Funktion schreibt nur is_completed,
-- der Trigger hört nur auf abschluss_manuell und löst sich nicht selbst aus.
CREATE OR REPLACE FUNCTION public.trg_kampagne_refresh_is_completed_manuell()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.abschluss_manuell IS DISTINCT FROM NEW.abschluss_manuell THEN
    PERFORM refresh_kampagne_is_completed(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_kampagne_refresh_is_completed_manuell() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kampagne_refresh_is_completed_manuell ON public.kampagne;
CREATE TRIGGER trg_kampagne_refresh_is_completed_manuell
  AFTER UPDATE OF abschluss_manuell
  ON public.kampagne
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kampagne_refresh_is_completed_manuell();
