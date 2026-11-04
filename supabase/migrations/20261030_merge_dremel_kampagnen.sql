-- Merge: Dremel - 2/12 (Batch 1) -> Jahreskooperation Dremel
-- Auftrag:            77feb968-0860-4e7c-9aa6-65cd5d5ccc6b (bleibt)
-- Survivor Kampagne:  a603e36a-a422-47cc-bb70-4b8532385494
-- Geloescht Kampagne: 16f6a253-b163-4350-82d4-fb8c02bb83c1 (nach Leerung)
-- Produktion B (b45ed499-...) wandert zu A; beide Produktionen bleiben.
-- 6 Kooperationen / 5 Vertraege / 5 Rechnungen wandern nach A.
-- Backup: backups/2026-10-30-dremel-merge.json (+ -vertraege.json)

BEGIN;

-- 1) Produktion B an Survivor haengen (Trigger sync_kampagne_id_from_produktion
--    zieht kampagne_id der Kinder dann ohnehin nach)
UPDATE produktion
SET kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494', updated_at = now()
WHERE id = 'b45ed499-5fe9-460d-9022-e40474470682';

-- 2) Herkunfts-Tag (idempotent) an die B-Kooperationen
INSERT INTO kooperation_tag_typen (name)
SELECT 'Dremel 2026 Batch 1'
WHERE NOT EXISTS (SELECT 1 FROM kooperation_tag_typen WHERE name = 'Dremel 2026 Batch 1');

INSERT INTO kooperation_tags (kooperation_id, tag_id)
SELECT k.id, t.id
FROM kooperationen k, kooperation_tag_typen t
WHERE k.kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1'
  AND t.name = 'Dremel 2026 Batch 1'
  AND NOT EXISTS (
    SELECT 1 FROM kooperation_tags kt
    WHERE kt.kooperation_id = k.id AND kt.tag_id = t.id
  );

-- 3) kampagne_id-Referenzen umschreiben
UPDATE kooperationen
SET kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494', updated_at = now()
WHERE kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1';

UPDATE vertraege
SET kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494', updated_at = now()
WHERE kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1';

UPDATE rechnung
SET kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494',
    auftrag_id  = '77feb968-0860-4e7c-9aa6-65cd5d5ccc6b',
    updated_at  = now()
WHERE kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1';

-- 4) Formate und Ziele: nur was A noch nicht hat, Rest von B entfaellt
UPDATE kampagne_formate f
SET kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494'
WHERE f.kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1'
  AND NOT EXISTS (
    SELECT 1 FROM kampagne_formate x
    WHERE x.kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494' AND x.format_id = f.format_id
  );
DELETE FROM kampagne_formate WHERE kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1';

UPDATE kampagne_paid_ziele z
SET kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494'
WHERE z.kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1'
  AND NOT EXISTS (
    SELECT 1 FROM kampagne_paid_ziele x
    WHERE x.kampagne_id = 'a603e36a-a422-47cc-bb70-4b8532385494' AND x.ziel_id = z.ziel_id
  );
DELETE FROM kampagne_paid_ziele WHERE kampagne_id = '16f6a253-b163-4350-82d4-fb8c02bb83c1';

-- 5) Survivor: Marke, Status, Name
UPDATE kampagne
SET marke_id = '636cd1fc-02aa-4131-ae82-d5a06926bf7c',
    status_id = 'ac79895a-b635-4c42-9ab6-80399ab5ced5',
    kampagnenname = 'Jahreskooperation Dremel',
    eigener_name = NULL,
    updated_at = now()
WHERE id = 'a603e36a-a422-47cc-bb70-4b8532385494';

UPDATE auftrag
SET auftragsname = 'Jahreskooperation Dremel',
    marke_id = '636cd1fc-02aa-4131-ae82-d5a06926bf7c',
    kampagnenanzahl = 1,
    updated_at = now()
WHERE id = '77feb968-0860-4e7c-9aa6-65cd5d5ccc6b';

UPDATE produktion
SET name = 'Jahreskooperation Dremel – Produktion 1', updated_at = now()
WHERE id = '84cd7aa9-3be3-4754-ba9e-4444ed8c7dae';

UPDATE produktion
SET name = 'Jahreskooperation Dremel – Batch 1', updated_at = now()
WHERE id = 'b45ed499-5fe9-460d-9022-e40474470682';

-- 6) Sicherheitsnetz: B muss leer sein, sonst Abbruch
DO $$
DECLARE
  r record;
  v_b constant uuid := '16f6a253-b163-4350-82d4-fb8c02bb83c1';
  v_n int;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'kampagne_id'
      AND c.table_name <> 'legacy_linien_backup'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE kampagne_id = $1', r.table_name)
      INTO v_n USING v_b;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'Kampagne B nicht leer: % hat % Zeilen', r.table_name, v_n;
    END IF;
  END LOOP;
END $$;

DELETE FROM kampagne WHERE id = '16f6a253-b163-4350-82d4-fb8c02bb83c1';

COMMIT;
