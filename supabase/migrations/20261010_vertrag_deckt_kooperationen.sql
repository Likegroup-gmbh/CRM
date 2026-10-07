-- Ein Vertrag deckt mehrere Kooperationen desselben Creators in derselben Kampagne (ADR 0047).
--
-- vertrag_kooperation ist die Junction. vertraege.kooperation_id bleibt als
-- Erzeuger-Kooperation und ist immer Mitglied (Sync-Trigger auf vertraege).
--
-- Regeln, als Trigger durchgesetzt:
--   * Beitritt: gleiche Kampagne, gleicher Creator, Vertrag nicht abgelehnt, kein Contracting.
--   * Harter Deckel: Summe kooperationen.videoanzahl <= vertraege.anzahl_videos,
--     nur wenn der Vertrag eine Videoanzahl nennt (> 0). Die Erzeuger-Kooperation
--     zaehlt mit, wird aber nie abgelehnt (Bestand darf darueber liegen).
--   * Aenderung von videoanzahl: Deckel nur fuer geteilte Vertraege (mehr als eine Kooperation).
--   * Loesen nur ohne Rechnung und ohne hochgeladenes Kooperationsvideo; ausgenommen
--     sind Loeschen/Ablehnen des Vertrags und Loeschen der Kooperation.
--
-- Bestand: genau ein nicht abgelehnter Vertrag je Kooperation wird als Zeile uebernommen.
-- Kooperationen mit mehreren Vertraegen bleiben ohne Zeile (keine automatische Auswahl).

BEGIN;

CREATE TABLE IF NOT EXISTS public.vertrag_kooperation (
  vertrag_id uuid NOT NULL REFERENCES public.vertraege(id) ON DELETE CASCADE,
  kooperation_id uuid NOT NULL REFERENCES public.kooperationen(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vertrag_id, kooperation_id)
);

-- Eine Kooperation hat hoechstens einen nicht abgelehnten Vertrag
CREATE UNIQUE INDEX IF NOT EXISTS vertrag_kooperation_kooperation_uniq
  ON public.vertrag_kooperation (kooperation_id);

COMMENT ON TABLE public.vertrag_kooperation IS
  'Welche Kooperationen ein Vertrag deckt (ADR 0047). Gleicher Creator, gleiche Kampagne, Deckel auf anzahl_videos.';

ALTER TABLE public.vertrag_kooperation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vertrag_kooperation_select ON public.vertrag_kooperation;
CREATE POLICY vertrag_kooperation_select ON public.vertrag_kooperation
  FOR SELECT TO authenticated USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS vertrag_kooperation_insert ON public.vertrag_kooperation;
CREATE POLICY vertrag_kooperation_insert ON public.vertrag_kooperation
  FOR INSERT TO authenticated WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS vertrag_kooperation_delete ON public.vertrag_kooperation;
CREATE POLICY vertrag_kooperation_delete ON public.vertrag_kooperation
  FOR DELETE TO authenticated USING ((SELECT is_admin_or_mitarbeiter()));

-- ---------------------------------------------------------------------
-- Bestand uebernehmen (vor den Triggern, damit nichts doppelt geprueft wird)
-- ---------------------------------------------------------------------
INSERT INTO public.vertrag_kooperation (vertrag_id, kooperation_id)
SELECT v.id, v.kooperation_id
FROM public.vertraege v
WHERE v.kooperation_id IS NOT NULL
  AND v.status <> 'abgelehnt'
  AND v.typ IS DISTINCT FROM 'Contracting'
  AND EXISTS (SELECT 1 FROM public.kooperationen k WHERE k.id = v.kooperation_id)
  AND (
    SELECT count(*) FROM public.vertraege v2
    WHERE v2.kooperation_id = v.kooperation_id AND v2.status <> 'abgelehnt'
  ) = 1
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Beitritt pruefen
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vertrag_kooperation_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vertrag vertraege%ROWTYPE;
  v_koop kooperationen%ROWTYPE;
  v_summe integer;
BEGIN
  SELECT * INTO v_vertrag FROM vertraege WHERE id = NEW.vertrag_id;
  SELECT * INTO v_koop FROM kooperationen WHERE id = NEW.kooperation_id;

  IF v_vertrag.id IS NULL OR v_koop.id IS NULL THEN
    RAISE EXCEPTION 'vertrag_kooperation:nicht_gefunden';
  END IF;

  -- Die Erzeuger-Kooperation ist immer Mitglied; Bestand wird nicht nachtraeglich abgelehnt.
  IF v_vertrag.kooperation_id IS NOT DISTINCT FROM NEW.kooperation_id THEN
    RETURN NEW;
  END IF;

  IF v_vertrag.typ IS NOT DISTINCT FROM 'Contracting' THEN
    RAISE EXCEPTION 'vertrag_kooperation:contracting';
  END IF;

  IF v_vertrag.status = 'abgelehnt' THEN
    RAISE EXCEPTION 'vertrag_kooperation:abgelehnt';
  END IF;

  IF v_vertrag.creator_id IS NULL OR v_vertrag.creator_id IS DISTINCT FROM v_koop.creator_id THEN
    RAISE EXCEPTION 'vertrag_kooperation:anderer_creator';
  END IF;

  IF v_vertrag.kampagne_id IS NULL OR v_vertrag.kampagne_id IS DISTINCT FROM v_koop.kampagne_id THEN
    RAISE EXCEPTION 'vertrag_kooperation:andere_kampagne';
  END IF;

  -- Hoechstens ein nicht abgelehnter Vertrag je Kooperation (auch Altbestand ohne Zeile)
  IF EXISTS (
    SELECT 1 FROM vertraege v
    WHERE v.kooperation_id = NEW.kooperation_id
      AND v.id <> NEW.vertrag_id
      AND v.status <> 'abgelehnt'
  ) THEN
    RAISE EXCEPTION 'vertrag_kooperation:bereits_gedeckt';
  END IF;

  IF COALESCE(v_vertrag.anzahl_videos, 0) > 0 THEN
    SELECT COALESCE(sum(COALESCE(k.videoanzahl, 0)), 0) INTO v_summe
      FROM vertrag_kooperation vk
      JOIN kooperationen k ON k.id = vk.kooperation_id
      WHERE vk.vertrag_id = NEW.vertrag_id;
    v_summe := v_summe + COALESCE(v_koop.videoanzahl, 0);
    IF v_summe > v_vertrag.anzahl_videos THEN
      RAISE EXCEPTION 'vertrag_kooperation:deckel:%:%', v_summe, v_vertrag.anzahl_videos;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vertrag_kooperation_pruefen_trg ON public.vertrag_kooperation;
CREATE TRIGGER vertrag_kooperation_pruefen_trg
  BEFORE INSERT ON public.vertrag_kooperation
  FOR EACH ROW EXECUTE FUNCTION public.vertrag_kooperation_pruefen();

-- ---------------------------------------------------------------------
-- Loesen nur ohne Rechnung und ohne Upload
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vertrag_kooperation_loesen_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.vertrag_kooperation_sync', true) = '1' THEN
    RETURN OLD;
  END IF;

  -- Vertrag geloescht oder abgelehnt: die Zeilen fallen mit ihm weg
  IF NOT EXISTS (
    SELECT 1 FROM vertraege WHERE id = OLD.vertrag_id AND status <> 'abgelehnt'
  ) THEN
    RETURN OLD;
  END IF;

  -- Kooperation geloescht
  IF NOT EXISTS (SELECT 1 FROM kooperationen WHERE id = OLD.kooperation_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM rechnung WHERE kooperation_id = OLD.kooperation_id) THEN
    RAISE EXCEPTION 'vertrag_kooperation:loesen_rechnung';
  END IF;

  IF EXISTS (
    SELECT 1 FROM kooperation_videos
    WHERE kooperation_id = OLD.kooperation_id AND COALESCE(asset_url, '') <> ''
  ) THEN
    RAISE EXCEPTION 'vertrag_kooperation:loesen_upload';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS vertrag_kooperation_loesen_pruefen_trg ON public.vertrag_kooperation;
CREATE TRIGGER vertrag_kooperation_loesen_pruefen_trg
  BEFORE DELETE ON public.vertrag_kooperation
  FOR EACH ROW EXECUTE FUNCTION public.vertrag_kooperation_loesen_pruefen();

-- ---------------------------------------------------------------------
-- vertrag_unterschrieben an der Kooperation folgt der Bindung
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vertrag_kooperation_flag_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM vertraege WHERE id = NEW.vertrag_id AND status = 'unterschrieben') THEN
      UPDATE kooperationen SET vertrag_unterschrieben = true
        WHERE id = NEW.kooperation_id AND vertrag_unterschrieben IS NOT TRUE;
    END IF;
    RETURN NEW;
  END IF;

  UPDATE kooperationen SET vertrag_unterschrieben = false
    WHERE id = OLD.kooperation_id AND vertrag_unterschrieben IS NOT FALSE;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS vertrag_kooperation_flag_sync_trg ON public.vertrag_kooperation;
CREATE TRIGGER vertrag_kooperation_flag_sync_trg
  AFTER INSERT OR DELETE ON public.vertrag_kooperation
  FOR EACH ROW EXECUTE FUNCTION public.vertrag_kooperation_flag_sync();

-- ---------------------------------------------------------------------
-- Erzeuger-Kooperation ist immer Mitglied
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vertraege_kooperation_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.vertrag_kooperation_sync', '1', true);

  IF NEW.status = 'abgelehnt' OR NEW.typ IS NOT DISTINCT FROM 'Contracting' THEN
    DELETE FROM vertrag_kooperation WHERE vertrag_id = NEW.id;
  ELSE
    IF TG_OP = 'UPDATE' AND OLD.kooperation_id IS NOT NULL
       AND OLD.kooperation_id IS DISTINCT FROM NEW.kooperation_id THEN
      DELETE FROM vertrag_kooperation
        WHERE vertrag_id = NEW.id AND kooperation_id = OLD.kooperation_id;
    END IF;

    IF NEW.kooperation_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM kooperationen WHERE id = NEW.kooperation_id) THEN
      INSERT INTO vertrag_kooperation (vertrag_id, kooperation_id)
        VALUES (NEW.id, NEW.kooperation_id)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  PERFORM set_config('app.vertrag_kooperation_sync', '0', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vertraege_kooperation_sync_trg ON public.vertraege;
CREATE TRIGGER vertraege_kooperation_sync_trg
  AFTER INSERT OR UPDATE OF kooperation_id, status, typ ON public.vertraege
  FOR EACH ROW EXECUTE FUNCTION public.vertraege_kooperation_sync();

-- ---------------------------------------------------------------------
-- Deckel beim Aendern der Videoanzahl (nur geteilte Vertraege)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kooperation_videoanzahl_deckel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF NEW.videoanzahl IS NOT DISTINCT FROM OLD.videoanzahl THEN
    RETURN NEW;
  END IF;

  FOR v_row IN
    SELECT v.id, v.anzahl_videos,
           (SELECT count(*) FROM vertrag_kooperation x WHERE x.vertrag_id = v.id) AS n,
           (SELECT COALESCE(sum(COALESCE(k.videoanzahl, 0)), 0)
              FROM vertrag_kooperation x JOIN kooperationen k ON k.id = x.kooperation_id
              WHERE x.vertrag_id = v.id) AS summe
    FROM vertrag_kooperation vk
    JOIN vertraege v ON v.id = vk.vertrag_id
    WHERE vk.kooperation_id = NEW.id
  LOOP
    IF v_row.n > 1 AND COALESCE(v_row.anzahl_videos, 0) > 0 AND v_row.summe > v_row.anzahl_videos THEN
      RAISE EXCEPTION 'vertrag_kooperation:deckel:%:%', v_row.summe, v_row.anzahl_videos;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kooperation_videoanzahl_deckel_trg ON public.kooperationen;
CREATE TRIGGER kooperation_videoanzahl_deckel_trg
  AFTER UPDATE OF videoanzahl ON public.kooperationen
  FOR EACH ROW EXECUTE FUNCTION public.kooperation_videoanzahl_deckel();

COMMIT;
