-- Medienablage: Produktion als Ebene zwischen Kampagne und Kooperation (ADR 0069).
-- Daten/<Firma>/Medien/[<Marke>/]<Kampagne>/<Produktion>/<Kooperation>/... und
-- Daten/<Firma>/Verträge/[<Marke>/]<Kampagne>/<Produktion>/. Ohne Produktion bleibt die
-- Kooperation bzw. der Vertrag direkt in der Kampagne.
-- Medien: Fachordner art = 'produktion', ein Ordner je (Drive, Produktion).
-- Verträge: Dokument-Ordner art = 'dokument', ebene = 'produktion' (dok_schluessel wie gehabt).
-- ablage_struktur_offen findet Kooperations-Ordner und Vertrags-PDFs, die nach einem Wechsel der
-- Produktion (Linie verschieben, Bestand vor dieser Migration) im falschen Ordner liegen.
--
-- ROLLBACK (nur solange keine Zeile art = 'produktion' bzw. ebene = 'produktion' existiert):
--   DROP FUNCTION IF EXISTS public.ablage_struktur_offen(text, uuid, integer);
--   DROP INDEX IF EXISTS public.ux_ablage_ordner_produktion;
--   DROP INDEX IF EXISTS public.idx_ablage_ordner_produktion;
--   ALTER TABLE public.ablage_ordner DROP COLUMN produktion_id;
--   art-/ebene-CHECK wie in 20261210_ablage_dokumente.sql neu setzen.

BEGIN;

ALTER TABLE public.ablage_ordner
  ADD COLUMN IF NOT EXISTS produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.ablage_ordner.produktion_id IS
  'art = produktion (Medien) bzw. art = dokument, ebene = produktion (Verträge). Freie Ordner darunter erben die Spalte.';

ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_art_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_art_check CHECK (art IN (
  'unternehmen', 'bereich', 'marke', 'kampagne', 'produktion', 'kooperation', 'typ', 'video', 'story',
  'schleife', 'finale', 'format', 'variante', 'dokument', 'frei', 'test', 'unzugeordnet'
));

ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_ebene_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_ebene_check CHECK (
  ebene IN ('marke', 'kampagne', 'produktion', 'contracting', 'auftrag', 'rechnung', 'belege', 'rechnungen'));
COMMENT ON COLUMN public.ablage_ordner.ebene IS
  'Nur art = dokument: marke, kampagne, produktion, contracting, auftrag, rechnung, belege, rechnungen (Unterordner eines Auftrags).';

CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_produktion
  ON public.ablage_ordner (drive_id, produktion_id) WHERE art = 'produktion' AND geloescht_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_ordner_produktion
  ON public.ablage_ordner (produktion_id) WHERE produktion_id IS NOT NULL;

-- Was liegt unter der falschen Produktion bzw. der Kampagne, obwohl es eine Produktion hat?
--   kooperation: Kooperations-Ordner, Eltern muss der Produktions-Ordner sein (ohne Produktion: die Kampagne)
--   vertrag:     erzeugtes/unterschriebenes PDF direkt im Kampagnen- oder Produktions-Ordner unter
--                Verträge/. In freien Unterordnern führt SharePoint den Ort (ADR 0068), die bleiben.
-- ordner_da: der Ziel-Ordner der Produktion ist schon registriert (Trockenlauf: was wird neu angelegt).
-- Zufällige Reihenfolge: ein dauerhaft scheiternder Eintrag blockiert die Pflege nicht.
CREATE OR REPLACE FUNCTION public.ablage_struktur_offen(
  p_drive_id text,
  p_unternehmen_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (art text, id uuid, unternehmen_id uuid, produktion_id uuid, ordner_da boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH koop AS (
    SELECT 'kooperation'::text AS art, ko.id, o.unternehmen_id, ko.produktion_id,
      ko.produktion_id IS NULL OR EXISTS (
        SELECT 1 FROM ablage_ordner x
        WHERE x.drive_id = p_drive_id AND x.art = 'produktion' AND x.produktion_id = ko.produktion_id
          AND x.item_id IS NOT NULL AND x.geloescht_at IS NULL
      ) AS ordner_da
    FROM ablage_ordner o
    JOIN kooperationen ko ON ko.id = o.kooperation_id
    JOIN ablage_ordner p ON p.drive_id = o.drive_id AND p.item_id = o.parent_item_id AND p.geloescht_at IS NULL
    WHERE o.drive_id = p_drive_id AND o.art = 'kooperation' AND o.item_id IS NOT NULL AND o.geloescht_at IS NULL
      AND (p_unternehmen_id IS NULL OR o.unternehmen_id = p_unternehmen_id)
      AND CASE
        WHEN ko.produktion_id IS NULL THEN p.art = 'produktion'
        ELSE NOT (p.art = 'produktion' AND p.produktion_id IS NOT DISTINCT FROM ko.produktion_id)
      END
  ),
  datei AS (
    SELECT v.id, v.kampagne_id, v.produktion_id, f.item_id
    FROM vertraege v
    CROSS JOIN LATERAL (VALUES (v.datei_drive_id, v.datei_item_id), (v.signiert_drive_id, v.signiert_item_id)) AS f(drive_id, item_id)
    WHERE f.drive_id = p_drive_id AND f.item_id IS NOT NULL
  ),
  vertrag AS (
    SELECT DISTINCT ON (d.id) 'vertrag'::text AS art, d.id, p.unternehmen_id, pr.id AS produktion_id,
      pr.id IS NULL OR EXISTS (
        SELECT 1 FROM ablage_ordner x
        WHERE x.drive_id = p_drive_id AND x.art = 'dokument' AND x.ebene = 'produktion' AND x.bereich = 'vertraege'
          AND x.produktion_id = pr.id AND x.unternehmen_id = p.unternehmen_id
          AND x.item_id IS NOT NULL AND x.geloescht_at IS NULL
      ) AS ordner_da
    FROM datei d
    JOIN ablage_eingang e ON e.drive_id = p_drive_id AND e.item_id = d.item_id AND NOT e.geloescht
    JOIN ablage_ordner p ON p.drive_id = p_drive_id AND p.item_id = e.parent_item_id AND p.geloescht_at IS NULL
    -- dokumentEbenen nimmt die Produktion nur, wenn sie zur Kampagne des Vertrags gehört
    LEFT JOIN produktion pr ON pr.id = d.produktion_id AND pr.kampagne_id = d.kampagne_id
    WHERE p.art = 'dokument' AND p.bereich = 'vertraege' AND p.ebene IN ('kampagne', 'produktion')
      AND (p_unternehmen_id IS NULL OR p.unternehmen_id = p_unternehmen_id)
      AND CASE
        WHEN pr.id IS NULL THEN p.ebene = 'produktion'
        ELSE NOT (p.ebene = 'produktion' AND p.produktion_id IS NOT DISTINCT FROM pr.id)
      END
    ORDER BY d.id
  )
  SELECT * FROM (SELECT * FROM koop UNION ALL SELECT * FROM vertrag) t
  ORDER BY random()
  LIMIT p_limit
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_struktur_offen(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_struktur_offen(text, uuid, integer) TO service_role;

COMMIT;
