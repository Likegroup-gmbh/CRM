-- Personas und Produkte gehoeren dem Unternehmen, nicht mehr der Marke.
--
-- Nicht jedes Unternehmen hat eine Marke. Deshalb wird "unternehmen_id" zum
-- Besitzer (immer gesetzt) und die Marken-Zuordnung wandert in Junctions -
-- ein Datensatz kann so mehreren Marken desselben Unternehmens gehoeren.
--
-- Der Unternehmens-Tab filtert auf unternehmen_id und sieht damit auch alles,
-- was aus einer Marke heraus angelegt wurde. Der Marken-Tab filtert ueber die
-- Junction.

BEGIN;

-- ============================================================
-- 1. personas: unternehmen_id als Besitzer
--    Nullable, weil die globalen Skript-Personas (Zielgruppen-DNA) weder
--    Marke noch Unternehmen haben.
-- ============================================================

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS unternehmen_id uuid REFERENCES unternehmen(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS personas_unternehmen_id_idx ON personas(unternehmen_id);

COMMENT ON COLUMN personas.unternehmen_id IS 'Besitzer der Persona. NULL = globale Persona fuer die Skript-DNA.';

-- ============================================================
-- 2. Junction-Tabellen
-- ============================================================

CREATE TABLE IF NOT EXISTS persona_marke (
  persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  marke_id uuid NOT NULL REFERENCES marke(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (persona_id, marke_id)
);

CREATE INDEX IF NOT EXISTS persona_marke_marke_id_idx ON persona_marke(marke_id);

CREATE TABLE IF NOT EXISTS produkt_marke (
  produkt_id uuid NOT NULL REFERENCES produkt(id) ON DELETE CASCADE,
  marke_id uuid NOT NULL REFERENCES marke(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (produkt_id, marke_id)
);

CREATE INDEX IF NOT EXISTS produkt_marke_marke_id_idx ON produkt_marke(marke_id);

COMMENT ON TABLE persona_marke IS 'Marken-Zuordnung einer Persona. Leer = die Persona haengt nur am Unternehmen.';
COMMENT ON TABLE produkt_marke IS 'Marken-Zuordnung eines Produkts. Leer = das Produkt haengt nur am Unternehmen.';

-- ============================================================
-- 3. Backfill aus den alten marke_id-Spalten
--    Laeuft nur, solange die Spalten noch existieren (idempotent).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'marke_id') THEN
    EXECUTE $sql$
      INSERT INTO persona_marke (persona_id, marke_id)
      SELECT id, marke_id FROM personas WHERE marke_id IS NOT NULL
      ON CONFLICT DO NOTHING
    $sql$;

    EXECUTE $sql$
      UPDATE personas p
         SET unternehmen_id = m.unternehmen_id
        FROM marke m
       WHERE m.id = p.marke_id
         AND p.unternehmen_id IS NULL
         AND m.unternehmen_id IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'marke_id') THEN
    EXECUTE $sql$
      INSERT INTO produkt_marke (produkt_id, marke_id)
      SELECT id, marke_id FROM produkt WHERE marke_id IS NOT NULL
      ON CONFLICT DO NOTHING
    $sql$;

    EXECUTE $sql$
      UPDATE produkt p
         SET unternehmen_id = m.unternehmen_id
        FROM marke m
       WHERE m.id = p.marke_id
         AND p.unternehmen_id IS NULL
         AND m.unternehmen_id IS NOT NULL
    $sql$;
  END IF;
END $$;

-- ============================================================
-- 4. RLS fuer die Junctions
--    Lesen darf, wer den Datensatz selbst sehen darf - das erledigen die
--    Policies auf personas/produkt ueber das EXISTS.
-- ============================================================

ALTER TABLE persona_marke ENABLE ROW LEVEL SECURITY;
ALTER TABLE produkt_marke ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persona_marke_select ON persona_marke;
CREATE POLICY persona_marke_select ON persona_marke
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM personas p WHERE p.id = persona_marke.persona_id));

DROP POLICY IF EXISTS persona_marke_insert ON persona_marke;
CREATE POLICY persona_marke_insert ON persona_marke
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS persona_marke_update ON persona_marke;
CREATE POLICY persona_marke_update ON persona_marke
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS persona_marke_delete ON persona_marke;
CREATE POLICY persona_marke_delete ON persona_marke
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_marke_select ON produkt_marke;
CREATE POLICY produkt_marke_select ON produkt_marke
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM produkt p WHERE p.id = produkt_marke.produkt_id));

DROP POLICY IF EXISTS produkt_marke_insert ON produkt_marke;
CREATE POLICY produkt_marke_insert ON produkt_marke
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_marke_update ON produkt_marke;
CREATE POLICY produkt_marke_update ON produkt_marke
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_marke_delete ON produkt_marke;
CREATE POLICY produkt_marke_delete ON produkt_marke
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

-- ============================================================
-- 5. produkt_select_policy: Kunden-Zweig auf die Junction umstellen
--    Bisher hing der Marken-Zugriff an produkt.marke_id, die gleich faellt.
-- ============================================================

DROP POLICY IF EXISTS produkt_select_policy ON produkt;
CREATE POLICY produkt_select_policy ON produkt
  FOR SELECT
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR (
      (SELECT get_current_user_rolle()) = ANY (ARRAY['kunde'::text, 'kunde_editor'::text])
      AND (
        EXISTS (
          SELECT 1 FROM kunde_unternehmen ku
           WHERE ku.unternehmen_id = produkt.unternehmen_id
             AND ku.kunde_id = (SELECT get_current_benutzer_id())
        )
        OR EXISTS (
          SELECT 1 FROM produkt_marke pm
            JOIN kunde_marke km ON km.marke_id = pm.marke_id
           WHERE pm.produkt_id = produkt.id
             AND km.kunde_id = (SELECT get_current_benutzer_id())
        )
        OR EXISTS (
          SELECT 1 FROM produkt_marke pm
            JOIN marke m ON m.id = pm.marke_id
            JOIN kunde_unternehmen ku ON ku.unternehmen_id = m.unternehmen_id
           WHERE pm.produkt_id = produkt.id
             AND ku.kunde_id = (SELECT get_current_benutzer_id())
        )
      )
    )
  );

-- ============================================================
-- 6. Alte marke_id-Spalten entfernen
--    Die Zuordnung steht ab jetzt vollstaendig in den Junctions - eine
--    zweite Quelle waere sonst dauerhaft synchron zu halten.
-- ============================================================

ALTER TABLE personas DROP COLUMN IF EXISTS marke_id;
ALTER TABLE produkt DROP COLUMN IF EXISTS marke_id;

COMMIT;
