-- Liky-Chat an der Persona: Jobs ohne Pflicht-persona_id, weil der Composer
-- auch auf /persona/new laeuft, bevor die Zeile existiert. URL-Extract bleibt
-- auf extract_jobs; hier nur modus=chat.

BEGIN;

CREATE TABLE IF NOT EXISTS persona_liky_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid REFERENCES personas(id) ON DELETE SET NULL,
  modus varchar NOT NULL DEFAULT 'chat' CHECK (modus IN ('chat')),
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'error')),
  progress_step varchar,
  progress_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS persona_liky_jobs_created_by_idx ON persona_liky_jobs(created_by);
CREATE INDEX IF NOT EXISTS persona_liky_jobs_persona_idx ON persona_liky_jobs(persona_id);

COMMENT ON TABLE persona_liky_jobs IS 'Liky-Chat-Jobs am Persona-Worksheet. Client legt an und pollt, Netlify Function (Service Role) schreibt Status und Ergebnis. URL-Extract laeuft weiter ueber extract_jobs.';

CREATE TRIGGER persona_liky_jobs_updated_at
  BEFORE UPDATE ON persona_liky_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE persona_liky_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY persona_liky_jobs_insert ON persona_liky_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid())
  );

CREATE POLICY persona_liky_jobs_select ON persona_liky_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Kein Client-UPDATE/DELETE: schreibt ausschliesslich die Function (Service Role)

COMMIT;
