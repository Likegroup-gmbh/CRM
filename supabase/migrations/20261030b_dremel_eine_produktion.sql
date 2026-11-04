-- Dremel: beide Produktionen zu einer zusammenlegen
-- Survivor: 84cd7aa9-3be3-4754-ba9e-4444ed8c7dae
-- Geloescht: b45ed499-5fe9-460d-9022-e40474470682 (Batch 1, 6 Koops / 5 Vertraege wandern)
-- Herkunft bleibt ueber das Tag "Dremel 2026 Batch 1" sichtbar.

BEGIN;

UPDATE kooperationen
SET produktion_id = '84cd7aa9-3be3-4754-ba9e-4444ed8c7dae', updated_at = now()
WHERE produktion_id = 'b45ed499-5fe9-460d-9022-e40474470682';

UPDATE vertraege
SET produktion_id = '84cd7aa9-3be3-4754-ba9e-4444ed8c7dae', updated_at = now()
WHERE produktion_id = 'b45ed499-5fe9-460d-9022-e40474470682';

DO $$
DECLARE
  r record;
  v_n int;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.produktion'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.t, r.col)
      INTO v_n USING 'b45ed499-5fe9-460d-9022-e40474470682'::uuid;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'Produktion B nicht leer: % hat % Zeilen', r.t, v_n;
    END IF;
  END LOOP;
END $$;

DELETE FROM produktion WHERE id = 'b45ed499-5fe9-460d-9022-e40474470682';

UPDATE produktion
SET name = 'Jahreskooperation Dremel – Produktion 1', updated_at = now()
WHERE id = '84cd7aa9-3be3-4754-ba9e-4444ed8c7dae';

COMMIT;
