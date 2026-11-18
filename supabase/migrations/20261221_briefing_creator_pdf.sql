-- Briefing folgt dem Creator-Briefing-PDF (ADR 0073, 0074, 0075).
--
-- Rein additiv (docs/v2-parallelbetrieb.md): neue nullable Spalten, ein gelockerter CHECK.
-- umsetzungsideen bleibt unveraendert, weil V1 dort weiter eine Text-Liste schreibt.
-- Die Eintraege mit verbindlich/Inspiration liegen in umsetzungsideen_eintraege; der Client
-- liest umsetzungsideen als Fallback, solange die neue Spalte leer ist.
--
-- ROLLBACK (nur solange keine Zeile von ohne bis hat):
--   ALTER TABLE campaign_briefings DROP CONSTRAINT campaign_briefings_videolaenge_intervall;
--   ALTER TABLE campaign_briefings ADD CONSTRAINT campaign_briefings_videolaenge_intervall CHECK (
--     (videolaenge_von IS NULL AND videolaenge_bis IS NULL)
--     OR (videolaenge_von BETWEEN 1 AND 180 AND videolaenge_bis BETWEEN videolaenge_von AND 180));
--   ALTER TABLE campaign_briefings DROP COLUMN plattformen, DROP COLUMN plattformen_weitere,
--     DROP COLUMN seitenverhaeltnisse, DROP COLUMN seitenverhaeltnis_weitere,
--     DROP COLUMN nutzungsrechte, DROP COLUMN content_deadline_bis, DROP COLUMN go_live_bis,
--     DROP COLUMN kernbotschaft, DROP COLUMN vorgabe_pflicht, DROP COLUMN vorgabe_dos,
--     DROP COLUMN vorgabe_donts, DROP COLUMN umsetzungsideen_eintraege;

BEGIN;

ALTER TABLE public.campaign_briefings
  ADD COLUMN IF NOT EXISTS plattformen text[],
  ADD COLUMN IF NOT EXISTS plattformen_weitere text,
  ADD COLUMN IF NOT EXISTS seitenverhaeltnisse text[],
  ADD COLUMN IF NOT EXISTS seitenverhaeltnis_weitere text,
  ADD COLUMN IF NOT EXISTS nutzungsrechte text,
  ADD COLUMN IF NOT EXISTS content_deadline_bis date,
  ADD COLUMN IF NOT EXISTS go_live_bis date,
  ADD COLUMN IF NOT EXISTS kernbotschaft text,
  ADD COLUMN IF NOT EXISTS vorgabe_pflicht text,
  ADD COLUMN IF NOT EXISTS vorgabe_dos text,
  ADD COLUMN IF NOT EXISTS vorgabe_donts text,
  ADD COLUMN IF NOT EXISTS umsetzungsideen_eintraege jsonb;

ALTER TABLE public.campaign_briefings
  DROP CONSTRAINT IF EXISTS campaign_briefings_plattformen_check,
  ADD CONSTRAINT campaign_briefings_plattformen_check
    CHECK (plattformen IS NULL OR plattformen <@ ARRAY['instagram', 'facebook', 'tiktok', 'youtube']),
  DROP CONSTRAINT IF EXISTS campaign_briefings_seitenverhaeltnisse_check,
  ADD CONSTRAINT campaign_briefings_seitenverhaeltnisse_check
    CHECK (seitenverhaeltnisse IS NULL OR seitenverhaeltnisse <@ ARRAY['9:16', '4:5', '1:1', '16:9']),
  DROP CONSTRAINT IF EXISTS campaign_briefings_content_deadline_bis_check,
  ADD CONSTRAINT campaign_briefings_content_deadline_bis_check
    CHECK (content_deadline_bis IS NULL OR (content_deadline IS NOT NULL AND content_deadline_bis >= content_deadline)),
  DROP CONSTRAINT IF EXISTS campaign_briefings_go_live_bis_check,
  ADD CONSTRAINT campaign_briefings_go_live_bis_check
    CHECK (go_live_bis IS NULL OR (go_live IS NOT NULL AND go_live_bis >= go_live)),
  DROP CONSTRAINT IF EXISTS campaign_briefings_umsetzungsideen_eintraege_check,
  ADD CONSTRAINT campaign_briefings_umsetzungsideen_eintraege_check
    CHECK (umsetzungsideen_eintraege IS NULL OR jsonb_typeof(umsetzungsideen_eintraege) = 'array');

-- Mindestlaenge: von ohne bis ist erlaubt, bis ohne von nie (ADR 0075).
ALTER TABLE public.campaign_briefings
  DROP CONSTRAINT IF EXISTS campaign_briefings_videolaenge_intervall,
  ADD CONSTRAINT campaign_briefings_videolaenge_intervall CHECK (
    (videolaenge_von IS NULL AND videolaenge_bis IS NULL)
    OR (videolaenge_von BETWEEN 1 AND 180
        AND (videolaenge_bis IS NULL OR videolaenge_bis BETWEEN videolaenge_von AND 180))
  );

-- Backfill: vorhandene Ideen werden Inspiration. umsetzungsideen ist live Text und enthaelt
-- entweder ein JSON-Array von Strings (repeatableText) oder Fliesstext. Fliesstext wird wie in
-- 20261021_briefing_umsetzungsideen_liste.sql zerlegt: eine Zeile = eine Idee, Aufzaehlungszeichen
-- weg, reine Ueberschriften ("UGC-Ideen:") fallen weg, Inline-Nummerierung "(1) ... (2)" trennt.
CREATE OR REPLACE FUNCTION pg_temp.briefing_ideen_eintraege(raw text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  j jsonb;
  ideen text[];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    j := raw::jsonb;
  EXCEPTION WHEN others THEN
    j := NULL;
  END;

  IF j IS NOT NULL AND jsonb_typeof(j) = 'array' THEN
    SELECT array_agg(btrim(e #>> '{}') ORDER BY ord) INTO ideen
    FROM jsonb_array_elements(j) WITH ORDINALITY AS x(e, ord)
    WHERE jsonb_typeof(e) = 'string' AND btrim(e #>> '{}') <> '';
  ELSE
    SELECT array_agg(item ORDER BY ord, sub) INTO ideen
    FROM (
      SELECT t.ord, u.sub,
             btrim(regexp_replace(u.part, '^\s*([-•*–—]|\d{1,2}[.)]|\(\d{1,2}\))\s+', '')) AS item
      FROM regexp_split_to_table(replace(raw, E'\r', ''), E'\n') WITH ORDINALITY AS t(line, ord)
      CROSS JOIN LATERAL regexp_split_to_table(
        CASE WHEN t.line ~ '\(1\).*\(2\)'
             THEN regexp_replace(t.line, '\s*\(\d{1,2}\)\s*', E'\n', 'g')
             ELSE t.line END,
        E'\n'
      ) WITH ORDINALITY AS u(part, sub)
    ) zerlegt
    WHERE item <> '' AND item !~ ':\s*$';
  END IF;

  IF ideen IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object('text', idee, 'verbindlich', false) ORDER BY ord)
    FROM unnest(ideen) WITH ORDINALITY AS i(idee, ord)
  );
END
$$;

UPDATE public.campaign_briefings
SET umsetzungsideen_eintraege = pg_temp.briefing_ideen_eintraege(umsetzungsideen::text)
WHERE umsetzungsideen_eintraege IS NULL
  AND umsetzungsideen IS NOT NULL;

COMMENT ON COLUMN public.campaign_briefings.plattformen IS
  'Plattformen des Creator-Briefings: instagram, facebook, tiktok, youtube. Weitere im Freitext plattformen_weitere.';
COMMENT ON COLUMN public.campaign_briefings.seitenverhaeltnisse IS
  'Gewuenschte Seitenverhaeltnisse: 9:16, 4:5, 1:1, 16:9. Weitere im Freitext seitenverhaeltnis_weitere.';
COMMENT ON COLUMN public.campaign_briefings.nutzungsrechte IS
  'Details zur Content-Verwendung und Nutzungsrechte (Freitext). Der Vertrag liest es nicht.';
COMMENT ON COLUMN public.campaign_briefings.content_deadline_bis IS
  'Ende des Abgabezeitraums; leer heisst, content_deadline ist ein einzelnes Datum.';
COMMENT ON COLUMN public.campaign_briefings.go_live_bis IS
  'Ende des Veroeffentlichungszeitraums; leer heisst, go_live ist ein einzelnes Datum.';
COMMENT ON COLUMN public.campaign_briefings.kernbotschaft IS
  'Kernbotschaft der Kampagne. Anker fuer die Kernbotschaft jeder Videoidee.';
COMMENT ON COLUMN public.campaign_briefings.vorgabe_pflicht IS
  'Pflichtinhalte: was gesagt oder gezeigt werden muss (Produktintegration, Pflichtaussagen, CTA, Rabatt, rechtliche Hinweise).';
COMMENT ON COLUMN public.campaign_briefings.vorgabe_dos IS
  'Do''s: was bei der Umsetzung gewuenscht ist. Nie ein Ausschluss.';
COMMENT ON COLUMN public.campaign_briefings.vorgabe_donts IS
  'Don''ts: was im Content vermieden werden muss. Nur Inhalt, nie die Person.';
COMMENT ON COLUMN public.campaign_briefings.umsetzungsideen_eintraege IS
  'Umsetzungsideen & Referenzen: [{text, verbindlich}]. Verbindliche werden einmalig 1:1 zum Videoidee-Vorschlag.';

COMMIT;
