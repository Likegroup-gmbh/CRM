-- Audience Situations als Kinder der Persona (ADR 0016)
--
--   audience_situation       produktagnostische Empfangsmomente an der Persona
--   audience_situation_jobs  KI-Lauf nach Produkt-Accept, schreibt direkt
--
-- personas.kontext bleibt bis Cutover (v1 liest die Spalte noch).
-- Alltagstext wird zusaetzlich als Seed-Zeile "Alltag" (quelle=migration) kopiert.
-- Die KI darf Seeds ersetzen, manuelle/KI-Rows nicht.

BEGIN;

CREATE TABLE IF NOT EXISTS audience_situation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  name text NOT NULL,
  beschreibung text,
  position int NOT NULL DEFAULT 0,
  quelle varchar NOT NULL DEFAULT 'manual' CHECK (quelle IN ('migration', 'manual', 'ki')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audience_situation_persona_idx ON audience_situation(persona_id);
CREATE UNIQUE INDEX IF NOT EXISTS audience_situation_persona_name_uidx
  ON audience_situation (persona_id, lower(name));

COMMENT ON TABLE audience_situation IS 'Audience Situations einer Persona: konkrete Empfangsmomente, Stammdaten der Persona, nicht des Produkts.';

CREATE TRIGGER audience_situation_updated_at
  BEFORE UPDATE ON audience_situation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- personas.kontext bleibt stehen, solange v1 die Spalte noch liest
-- (docs/v2-parallelbetrieb.md). Alltagstext wird zusaetzlich als Seed-Zeile
-- "Alltag" (quelle=migration) kopiert. Drop erst beim Cutover.
INSERT INTO audience_situation (persona_id, name, beschreibung, position, quelle)
SELECT id, 'Alltag', kontext, 0, 'migration'
FROM personas
WHERE kontext IS NOT NULL AND btrim(kontext) <> '';

CREATE TABLE IF NOT EXISTS audience_situation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  produkt_id uuid REFERENCES produkt(id) ON DELETE SET NULL,
  status varchar NOT NULL DEFAULT 'pending',
  progress_step varchar,
  progress_steps jsonb,
  input jsonb,
  result jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audience_situation_jobs_persona_idx ON audience_situation_jobs(persona_id);
CREATE INDEX IF NOT EXISTS audience_situation_jobs_created_by_idx ON audience_situation_jobs(created_by);

COMMENT ON TABLE audience_situation_jobs IS 'Jobs der Audience-Situation-Generierung. Client legt an, die Function schreibt per Service Role.';

CREATE TRIGGER audience_situation_jobs_updated_at
  BEFORE UPDATE ON audience_situation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Atomar: Seeds loeschen und KI-Rows schreiben. Nur Service Role.
CREATE OR REPLACE FUNCTION replace_audience_situation_seeds(p_persona_id uuid, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM audience_situation
  WHERE persona_id = p_persona_id AND quelle = 'migration';

  INSERT INTO audience_situation (persona_id, name, beschreibung, position, quelle)
  SELECT
    p_persona_id,
    r->>'name',
    NULLIF(btrim(COALESCE(r->>'beschreibung', '')), ''),
    (ord - 1)::int,
    'ki'
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord);
END;
$$;

REVOKE ALL ON FUNCTION replace_audience_situation_seeds(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_audience_situation_seeds(uuid, jsonb) TO service_role;

ALTER TABLE audience_situation ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_situation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audience_situation_select ON audience_situation
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM personas p WHERE p.id = audience_situation.persona_id));

CREATE POLICY audience_situation_insert ON audience_situation
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY audience_situation_update ON audience_situation
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY audience_situation_delete ON audience_situation
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY audience_situation_jobs_insert ON audience_situation_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid()));

CREATE POLICY audience_situation_jobs_select ON audience_situation_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

COMMIT;
