-- Wichtige Vorgaben: ein Feld statt Pflichtinhalte, Do's, Don'ts, Vorgaben und
-- Ausschluesse. Alte Texte werden einmalig mit Ueberschriften uebernommen, die
-- Alt-Spalten bleiben liegen und werden nicht mehr gelesen.
--
-- Idempotent: nur Zeilen ohne wichtige_vorgaben. Reihenfolge beim Ausrollen:
-- erst diese Migration, dann der Deploy.

ALTER TABLE campaign_briefings
  ADD COLUMN IF NOT EXISTS wichtige_vorgaben text;

UPDATE campaign_briefings
SET wichtige_vorgaben = NULLIF(concat_ws(
  E'\n\n',
  CASE WHEN btrim(coalesce(pflichtinhalte, '')) <> ''
       THEN E'Pflichtinhalte:\n' || btrim(pflichtinhalte) END,
  CASE WHEN btrim(coalesce(dos, '')) <> ''
       THEN E'Do’s:\n' || btrim(dos) END,
  CASE WHEN btrim(coalesce(donts, '')) <> ''
       THEN E'Don’ts:\n' || btrim(donts) END,
  CASE WHEN btrim(coalesce(dos, '')) = '' AND btrim(coalesce(donts, '')) = ''
         AND btrim(coalesce(dos_donts, '')) <> ''
       THEN E'Do’s und Don’ts:\n' || btrim(dos_donts) END,
  CASE WHEN btrim(coalesce(vorgaben_ausschluesse, '')) <> ''
       THEN E'Vorgaben und Ausschlüsse:\n' || btrim(vorgaben_ausschluesse) END
), '')
WHERE wichtige_vorgaben IS NULL;

COMMENT ON COLUMN campaign_briefings.wichtige_vorgaben IS
  'Pflichten, Do’s, Don’ts und Ausschlüsse als ein Text. Verbote werden vor dem Matching gelesen.';
