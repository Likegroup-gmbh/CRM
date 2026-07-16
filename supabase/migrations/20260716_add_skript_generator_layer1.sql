-- Skript-Generator Layer 1
-- Neue Tabellen: personas, skripte, skript_feedback, skript_dna, skript_generation_jobs
-- branchen + marke_branchen existieren bereits und werden wiederverwendet.

-- =====================================================================
-- Personas (Zielgruppen-Wissen, verknuepft mit Marke und/oder Branche)
-- =====================================================================
CREATE TABLE IF NOT EXISTS personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  marke_id uuid REFERENCES marke(id) ON DELETE CASCADE,
  branche_id uuid REFERENCES branchen(id) ON DELETE SET NULL,
  beschreibung text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================================
-- Skripte (generiert + historisch importiert)
-- =====================================================================
CREATE TABLE IF NOT EXISTS skripte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel varchar,
  marke_id uuid REFERENCES marke(id) ON DELETE SET NULL,
  kampagne_id uuid REFERENCES kampagne(id) ON DELETE SET NULL,
  produkt_id uuid REFERENCES produkt(id) ON DELETE SET NULL,
  persona_id uuid REFERENCES personas(id) ON DELETE SET NULL,
  hook text,
  hauptteil text,
  cta text,
  video_idee text,
  funnel_stufe varchar CHECK (funnel_stufe IN ('top','mid','bottom')),
  tonalitaet varchar,
  herkunft varchar NOT NULL DEFAULT 'generiert' CHECK (herkunft IN ('generiert','historisch')),
  performance_label varchar NOT NULL DEFAULT 'unbewertet'
    CHECK (performance_label IN ('unbewertet','erfolgreich','nicht_erfolgreich','viral')),
  performance_notiz text,
  status varchar NOT NULL DEFAULT 'entwurf'
    CHECK (status IN ('entwurf','feedback_gegeben','final','archiviert')),
  -- Blindvergleich: wurde mit oder ohne DNA generiert?
  mit_dna boolean NOT NULL DEFAULT true,
  model varchar,
  -- Snapshot des Prompt-Kontexts (welche DNA-Versionen/Beispiele einflossen)
  prompt_kontext jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skripte_marke ON skripte(marke_id);
CREATE INDEX IF NOT EXISTS idx_skripte_kampagne ON skripte(kampagne_id);
CREATE INDEX IF NOT EXISTS idx_skripte_performance ON skripte(performance_label);

-- =====================================================================
-- Strukturiertes Feedback pro Sektion
-- =====================================================================
CREATE TABLE IF NOT EXISTS skript_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skript_id uuid NOT NULL REFERENCES skripte(id) ON DELETE CASCADE,
  sektion varchar NOT NULL CHECK (sektion IN ('hook','hauptteil','cta','gesamt')),
  score int CHECK (score BETWEEN 1 AND 5),
  begruendung text,
  korrigierte_version text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skript_feedback_skript ON skript_feedback(skript_id);

-- =====================================================================
-- Geschichtete Skript-DNA (global > branche > zielgruppe > marke)
-- =====================================================================
CREATE TABLE IF NOT EXISTS skript_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_typ varchar NOT NULL CHECK (layer_typ IN ('global','branche','zielgruppe','marke')),
  branche_id uuid REFERENCES branchen(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES personas(id) ON DELETE CASCADE,
  marke_id uuid REFERENCES marke(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  inhalt text NOT NULL,
  status varchar NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf','aktiv','archiviert')),
  freigegeben_von uuid,
  freigegeben_am timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skript_dna_layer ON skript_dna(layer_typ, status);

-- =====================================================================
-- Generierungs-Jobs (Background Function + Realtime, wie transcription_jobs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS skript_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skript_id uuid REFERENCES skripte(id) ON DELETE SET NULL,
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  progress_step varchar,
  logs jsonb DEFAULT '[]'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================================
-- updated_at Trigger (nutzt bestehende Funktion update_updated_at_column)
-- =====================================================================
CREATE TRIGGER personas_updated_at BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER skripte_updated_at BEFORE UPDATE ON skripte
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER skript_dna_updated_at BEFORE UPDATE ON skript_dna
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER skript_generation_jobs_updated_at BEFORE UPDATE ON skript_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- RLS: alle Skript-Tabellen sind intern (Admin + Mitarbeiter)
-- =====================================================================
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE skripte ENABLE ROW LEVEL SECURITY;
ALTER TABLE skript_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE skript_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE skript_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY personas_select ON personas FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY personas_insert ON personas FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY personas_update ON personas FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY personas_delete ON personas FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY skripte_select ON skripte FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skripte_insert ON skripte FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skripte_update ON skripte FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skripte_delete ON skripte FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY skript_feedback_select ON skript_feedback FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_feedback_insert ON skript_feedback FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_feedback_update ON skript_feedback FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_feedback_delete ON skript_feedback FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY skript_dna_select ON skript_dna FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_dna_insert ON skript_dna FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_dna_update ON skript_dna FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_dna_delete ON skript_dna FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY skript_generation_jobs_select ON skript_generation_jobs FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_generation_jobs_insert ON skript_generation_jobs FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_generation_jobs_update ON skript_generation_jobs FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));

-- Realtime fuer Job-Updates in der UI
ALTER PUBLICATION supabase_realtime ADD TABLE skript_generation_jobs;
