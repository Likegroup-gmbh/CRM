-- Auftragsstatus aus dem Budget ableiten, in der Datenbank statt im Client.
--
-- Regel: Summe kooperation_videos.verkaufspreis_netto über alle Kampagnen des Auftrags
--   >= auftrag.creator_budget  -> Status 'Abgeschlossen'
--   <  auftrag.creator_budget und Status 'Abgeschlossen' -> zurück auf 'Beauftragt'
-- Storniert bleibt unangetastet. Ohne creator_budget (null/<= 0) passiert nichts.
-- Andere Status (z.B. 'In Produktion', null) wechseln nur nach 'Abgeschlossen'.
--
-- Der bisherige Client-Check (checkAuftragBudgetStatus) las auftrag.gesamt_budget, das
-- nirgends mehr gesetzt wird, und brach deshalb immer ab. Er läuft außerdem nur bei
-- Preisänderungen in der Kampagnen-Videotabelle.

CREATE OR REPLACE FUNCTION public.refresh_auftrag_budget_status(p_auftrag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_budget numeric;
  v_used numeric;
BEGIN
  IF p_auftrag_id IS NULL THEN
    RETURN;
  END IF;

  -- Zeile sperren: parallele Video-Updates desselben Auftrags rechnen nacheinander.
  SELECT a.status, a.creator_budget
    INTO v_status, v_budget
  FROM auftrag a
  WHERE a.id = p_auftrag_id
  FOR UPDATE;

  IF NOT FOUND OR v_status = 'Storniert' OR v_budget IS NULL OR v_budget <= 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(kv.verkaufspreis_netto), 0)
    INTO v_used
  FROM kampagne k
  JOIN kooperationen ko ON ko.kampagne_id = k.id
  JOIN kooperation_videos kv ON kv.kooperation_id = ko.id
  WHERE k.auftrag_id = p_auftrag_id;

  IF v_used >= v_budget AND v_status IS DISTINCT FROM 'Abgeschlossen' THEN
    UPDATE auftrag SET status = 'Abgeschlossen' WHERE id = p_auftrag_id;
  ELSIF v_used < v_budget AND v_status = 'Abgeschlossen' THEN
    UPDATE auftrag SET status = 'Beauftragt' WHERE id = p_auftrag_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_auftrag_budget_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_auftrag_budget_status(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_auftrag_budget_status(uuid) TO service_role;

-- kooperation_videos: nur VK-Änderungen und Umhängen, nicht die Freigabe-Checkbox.
-- Sonst würde jede Freigabe einen manuell geänderten Status wieder überschreiben.
CREATE OR REPLACE FUNCTION public.trg_kooperation_videos_refresh_auftrag_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new uuid;
  v_old uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT k.auftrag_id INTO v_new
    FROM kooperationen ko JOIN kampagne k ON k.id = ko.kampagne_id
    WHERE ko.id = NEW.kooperation_id;
    PERFORM refresh_auftrag_budget_status(v_new);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Beim Kaskaden-Löschen ist die Kooperation schon weg; dann greifen die
    -- Trigger auf kooperationen bzw. kampagne.
    SELECT k.auftrag_id INTO v_old
    FROM kooperationen ko JOIN kampagne k ON k.id = ko.kampagne_id
    WHERE ko.id = OLD.kooperation_id;
    PERFORM refresh_auftrag_budget_status(v_old);
    RETURN OLD;
  ELSE
    IF OLD.verkaufspreis_netto IS NOT DISTINCT FROM NEW.verkaufspreis_netto
       AND OLD.kooperation_id IS NOT DISTINCT FROM NEW.kooperation_id THEN
      RETURN NEW;
    END IF;
    SELECT k.auftrag_id INTO v_new
    FROM kooperationen ko JOIN kampagne k ON k.id = ko.kampagne_id
    WHERE ko.id = NEW.kooperation_id;
    PERFORM refresh_auftrag_budget_status(v_new);
    IF OLD.kooperation_id IS DISTINCT FROM NEW.kooperation_id THEN
      SELECT k.auftrag_id INTO v_old
      FROM kooperationen ko JOIN kampagne k ON k.id = ko.kampagne_id
      WHERE ko.id = OLD.kooperation_id;
      IF v_old IS DISTINCT FROM v_new THEN
        PERFORM refresh_auftrag_budget_status(v_old);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_kooperationen_refresh_auftrag_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new uuid;
  v_old uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT k.auftrag_id INTO v_old FROM kampagne k WHERE k.id = OLD.kampagne_id;
    PERFORM refresh_auftrag_budget_status(v_old);
    RETURN OLD;
  END IF;

  SELECT k.auftrag_id INTO v_new FROM kampagne k WHERE k.id = NEW.kampagne_id;
  SELECT k.auftrag_id INTO v_old FROM kampagne k WHERE k.id = OLD.kampagne_id;
  PERFORM refresh_auftrag_budget_status(v_new);
  IF v_old IS DISTINCT FROM v_new THEN
    PERFORM refresh_auftrag_budget_status(v_old);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_kampagne_refresh_auftrag_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_auftrag_budget_status(OLD.auftrag_id);
    RETURN OLD;
  END IF;

  IF OLD.auftrag_id IS DISTINCT FROM NEW.auftrag_id THEN
    PERFORM refresh_auftrag_budget_status(NEW.auftrag_id);
    PERFORM refresh_auftrag_budget_status(OLD.auftrag_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_auftrag_refresh_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.creator_budget IS DISTINCT FROM NEW.creator_budget THEN
    PERFORM refresh_auftrag_budget_status(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_kooperation_videos_refresh_auftrag_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_kooperationen_refresh_auftrag_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_kampagne_refresh_auftrag_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_auftrag_refresh_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kooperation_videos_refresh_auftrag_status ON public.kooperation_videos;
CREATE TRIGGER trg_kooperation_videos_refresh_auftrag_status
  AFTER INSERT OR DELETE OR UPDATE OF verkaufspreis_netto, kooperation_id
  ON public.kooperation_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kooperation_videos_refresh_auftrag_status();

DROP TRIGGER IF EXISTS trg_kooperationen_refresh_auftrag_status ON public.kooperationen;
CREATE TRIGGER trg_kooperationen_refresh_auftrag_status
  AFTER DELETE OR UPDATE OF kampagne_id
  ON public.kooperationen
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kooperationen_refresh_auftrag_status();

DROP TRIGGER IF EXISTS trg_kampagne_refresh_auftrag_status ON public.kampagne;
CREATE TRIGGER trg_kampagne_refresh_auftrag_status
  AFTER DELETE OR UPDATE OF auftrag_id
  ON public.kampagne
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kampagne_refresh_auftrag_status();

-- Nur creator_budget: die Funktion schreibt status und löst sich damit nicht selbst aus.
DROP TRIGGER IF EXISTS trg_auftrag_refresh_status ON public.auftrag;
CREATE TRIGGER trg_auftrag_refresh_status
  AFTER UPDATE OF creator_budget
  ON public.auftrag
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auftrag_refresh_status();

-- Bestand einmal durchrechnen, damit bereits volle Aufträge nicht bis zur nächsten
-- Preisänderung auf 'Beauftragt' stehen bleiben.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.auftrag LOOP
    PERFORM public.refresh_auftrag_budget_status(r.id);
  END LOOP;
END;
$$;
