-- Casting-Vorschlaege aus der eigenen Creator-Datenbank (ADR 0013)
--
-- Zwei Tabellen nach dem produkt_persona-Muster:
--
--   casting_vorschlag_jobs  Job-Zeilen fuer die Background Function
--                           (Client legt an und pollt, die Function schreibt
--                           per Service Role). Anders als dort gibt es kein
--                           Worksheet: das Casting existiert schon, der Job
--                           schreibt pending-Zeilen sofort.
--   casting_vorschlag       Ein Vorschlag ist eine eigene Zeile ueber der
--                           Liste, kein Casting-Eintrag. Erst das Aktivieren
--                           legt creator_auswahl_items mit creator_id an und
--                           setzt den Vorschlag auf accepted.
--
-- status: pending = offen, accepted = aktiviert (Eintrag angelegt),
--         deleted = verworfen (gilt nur fuer dieses Casting, kein
--         Marken-Abgelehnt).

BEGIN;

-- ============================================================
-- 1. Jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS casting_vorschlag_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casting_id uuid NOT NULL REFERENCES creator_auswahl(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'pending',
  progress_step varchar,
  progress_steps jsonb,
  -- Bedarf-Snapshot zum Zeitpunkt des Laufs (Briefing, Produkte, Personas,
  -- Kampagnen-Blocks) plus Lauf-Parameter
  input jsonb,
  result jsonb,
  -- Welche Config-Version und welcher Explore-Bias den Lauf gesteuert haben,
  -- damit alte Listen spaeter noch erklaerbar sind
  config_version int NOT NULL DEFAULT 1,
  explore_bias numeric,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casting_vorschlag_jobs_casting_idx ON casting_vorschlag_jobs(casting_id);
CREATE INDEX IF NOT EXISTS casting_vorschlag_jobs_created_by_idx ON casting_vorschlag_jobs(created_by);

COMMENT ON TABLE casting_vorschlag_jobs IS 'Jobs der Casting-Creator-Vorschlaege (casting-vorschlag-background). Client legt an und pollt, die Function schreibt Status, Fortschritt und Ergebnis.';

CREATE TRIGGER casting_vorschlag_jobs_updated_at
  BEFORE UPDATE ON casting_vorschlag_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Vorschlaege
-- ============================================================

CREATE TABLE IF NOT EXISTS casting_vorschlag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casting_id uuid NOT NULL REFERENCES creator_auswahl(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creator(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'deleted')),
  -- interner Slot (proven | tight | adjacent | explore) und Kategorie-Hinweis
  -- fuer die Landung auf der Liste (Persona/Typ-Match oder null)
  slot varchar NOT NULL DEFAULT 'tight' CHECK (slot IN ('proven', 'tight', 'adjacent', 'explore')),
  kategorie_hint text,
  -- KI-Begruendung (fit_grund) plus offene Risiken, z.B. unloaderierte
  -- Voraussetzungen; coverage zeigt, welche Dimensionen belegt waren
  fit_grund text,
  risiken text,
  persona_ids uuid[] NOT NULL DEFAULT '{}',
  coverage jsonb,
  -- deterministische Scores des Laufs { fit, track, fresh }, kein Ranking-Geheimnis
  scores jsonb,
  job_id uuid REFERENCES casting_vorschlag_jobs(id) ON DELETE SET NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casting_vorschlag_casting_idx ON casting_vorschlag(casting_id);
CREATE INDEX IF NOT EXISTS casting_vorschlag_creator_idx ON casting_vorschlag(creator_id);
CREATE INDEX IF NOT EXISTS casting_vorschlag_job_idx ON casting_vorschlag(job_id);

COMMENT ON TABLE casting_vorschlag IS 'KI-Creator-Vorschlaege eines Castings. pending = offen ueber der Liste, accepted = per Aktivieren zum Casting-Eintrag geworden, deleted = verworfen (nur dieses Casting).';

CREATE TRIGGER casting_vorschlag_updated_at
  BEFORE UPDATE ON casting_vorschlag
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. RLS
--    Vorschlaege: lesen darf, wer das Casting sieht
--    (EXISTS laeuft durch die creator_auswahl-Policy), schreiben nur Staff.
--    Jobs: wie produkt_persona_jobs - eigene Zeilen anlegen und lesen,
--    geschrieben wird nur per Service Role.
-- ============================================================

ALTER TABLE casting_vorschlag ENABLE ROW LEVEL SECURITY;
ALTER TABLE casting_vorschlag_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY casting_vorschlag_select ON casting_vorschlag
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM creator_auswahl ca WHERE ca.id = casting_vorschlag.casting_id));

CREATE POLICY casting_vorschlag_insert ON casting_vorschlag
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY casting_vorschlag_update ON casting_vorschlag
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY casting_vorschlag_delete ON casting_vorschlag
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY casting_vorschlag_jobs_insert ON casting_vorschlag_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid()));

CREATE POLICY casting_vorschlag_jobs_select ON casting_vorschlag_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Kein UPDATE/DELETE fuer Clients: schreibt ausschliesslich die Function (Service Role)

COMMIT;
