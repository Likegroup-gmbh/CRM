-- Persona-Vorschlaege und Use Cases aus dem Produkt
--
-- Beim Anlegen eines Produkts schlaegt die KI Einsatzsituationen (Use Cases)
-- und passende Personas vor. Drei neue Tabellen:
--
--   produkt_use_case           benannte Use Cases als Kinder am Produkt
--                              (Source of Truth - produkt.einsatzsituation
--                              bleibt als Fallback lesbar, wird nicht mehr
--                              geschrieben)
--   produkt_persona_vorschlag  Review-Lebenszyklus und Produkt-Link zugleich:
--                              status 'accepted' = die Verknuepfung, auf der
--                              spaeter die Kampagnen-Auswahl aufsetzt
--   produkt_persona_jobs       Job-Zeilen fuer die Background Function
--                              (Muster wie extract_jobs: Client legt an und
--                              pollt, die Function schreibt per Service Role)
--
-- Die Basis-Persona bleibt ein Mensch auf Unternehmens-/Markenebene. Der
-- produkt-spezifische Fit (fit_grund, use_case_ids) lebt nur auf dem
-- Vorschlag, nie in der Persona selbst.

BEGIN;

-- ============================================================
-- 1. Use Cases am Produkt
-- ============================================================

CREATE TABLE IF NOT EXISTS produkt_use_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES produkt(id) ON DELETE CASCADE,
  name text NOT NULL,
  beschreibung text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produkt_use_case_produkt_idx ON produkt_use_case(produkt_id);

COMMENT ON TABLE produkt_use_case IS 'Benannte Einsatzsituationen eines Produkts. Werden von der KI aus den Produktfakten vorgeschlagen und im Produktdoc gepflegt. Kampagnen und Persona-Vorschlaege referenzieren diese Zeilen.';

CREATE TRIGGER produkt_use_case_updated_at
  BEFORE UPDATE ON produkt_use_case
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Persona-Vorschlaege (Review + Produkt-Link in einem)
-- ============================================================

CREATE TABLE IF NOT EXISTS produkt_persona_vorschlag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES produkt(id) ON DELETE CASCADE,
  typ varchar NOT NULL CHECK (typ IN ('match', 'neu')),
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'deleted')),
  -- match: sofort gesetzt. neu: erst beim Annehmen (Insert der Persona).
  -- CASCADE: geht die Persona weg, geht der Link mit.
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE,
  -- Volles PersonaForm-Feldset bei typ 'neu', bis das Annehmen die
  -- Persona-Zeile daraus anlegt.
  payload jsonb,
  fit_grund text,
  use_case_ids uuid[] NOT NULL DEFAULT '{}',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produkt_persona_vorschlag_produkt_idx ON produkt_persona_vorschlag(produkt_id);
CREATE INDEX IF NOT EXISTS produkt_persona_vorschlag_persona_idx ON produkt_persona_vorschlag(persona_id);

COMMENT ON TABLE produkt_persona_vorschlag IS 'KI-Persona-Vorschlaege eines Produkts mit Review-Status. pending = Karte offen, accepted = verknuepft (Basis fuer die Kampagnen-Auswahl), deleted = verworfen.';

CREATE TRIGGER produkt_persona_vorschlag_updated_at
  BEFORE UPDATE ON produkt_persona_vorschlag
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. Job-Tabelle fuer die Generierung
--    produkt_id ist nullable: im Create-Modus laeuft der Job am
--    ungespeicherten Formular, der Input-Snapshot traegt die Felder.
-- ============================================================

CREATE TABLE IF NOT EXISTS produkt_persona_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid REFERENCES produkt(id) ON DELETE CASCADE,
  unternehmen_id uuid REFERENCES unternehmen(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'pending',
  progress_step varchar,
  progress_steps jsonb,
  -- Snapshot der Produktfelder + Marken zum Zeitpunkt des Laufs
  input jsonb,
  result jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produkt_persona_jobs_produkt_idx ON produkt_persona_jobs(produkt_id);
CREATE INDEX IF NOT EXISTS produkt_persona_jobs_created_by_idx ON produkt_persona_jobs(created_by);

COMMENT ON TABLE produkt_persona_jobs IS 'Jobs der Persona-Generierung (produkt-persona-background). Client legt an und pollt, die Function schreibt Status, Fortschritt und Ergebnis.';

CREATE TRIGGER produkt_persona_jobs_updated_at
  BEFORE UPDATE ON produkt_persona_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. RLS
--    Use Cases und Vorschlaege: lesen darf, wer das Produkt sieht
--    (EXISTS laeuft durch die produkt-Policy), schreiben nur Staff.
--    Jobs: wie extract_jobs - eigene Zeilen anlegen und lesen,
--    geschrieben wird nur per Service Role.
-- ============================================================

ALTER TABLE produkt_use_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE produkt_persona_vorschlag ENABLE ROW LEVEL SECURITY;
ALTER TABLE produkt_persona_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY produkt_use_case_select ON produkt_use_case
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM produkt p WHERE p.id = produkt_use_case.produkt_id));

CREATE POLICY produkt_use_case_insert ON produkt_use_case
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY produkt_use_case_update ON produkt_use_case
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY produkt_use_case_delete ON produkt_use_case
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY produkt_persona_vorschlag_select ON produkt_persona_vorschlag
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM produkt p WHERE p.id = produkt_persona_vorschlag.produkt_id));

CREATE POLICY produkt_persona_vorschlag_insert ON produkt_persona_vorschlag
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY produkt_persona_vorschlag_update ON produkt_persona_vorschlag
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY produkt_persona_vorschlag_delete ON produkt_persona_vorschlag
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY produkt_persona_jobs_insert ON produkt_persona_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid()));

CREATE POLICY produkt_persona_jobs_select ON produkt_persona_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Kein UPDATE/DELETE fuer Clients: schreibt ausschliesslich die Function (Service Role)

COMMIT;
