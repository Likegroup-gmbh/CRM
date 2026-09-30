-- Rechnungs-PDF-Auslesung (ADR 0016): Extract-Jobs fuer die Liky-Auslesung
-- von Creator-Rechnungen. Kein FK auf rechnung — die Rechnung existiert zum
-- Zeitpunkt der Auslesung noch nicht (Upload-first-Flow).

CREATE TABLE IF NOT EXISTS rechnung_pdf_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'error')),
  progress_step varchar,
  progress_steps jsonb,
  result jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rechnung_pdf_jobs_created_by
  ON rechnung_pdf_jobs(created_by, created_at);

CREATE TRIGGER rechnung_pdf_jobs_updated_at
  BEFORE UPDATE ON rechnung_pdf_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE rechnung_pdf_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY rechnung_pdf_jobs_insert ON rechnung_pdf_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid()));

CREATE POLICY rechnung_pdf_jobs_select ON rechnung_pdf_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Kein Client-UPDATE/DELETE: schreibt ausschliesslich die Function (Service Role)

-- Storage: Ordner rechnung-extracts im documents-Bucket. Der Client laedt die
-- PDF dort fuer die Auslesung ab; die Function liest und raeumt per Service
-- Role auf. Der dauerhafte Beleg entsteht erst beim Speichern der Rechnung
-- ueber den normalen pdf_file-Upload (Dropbox).
DROP POLICY IF EXISTS "documents_insert_staff_rechnung_extracts" ON storage.objects;
CREATE POLICY "documents_insert_staff_rechnung_extracts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'rechnung-extracts'
    AND (SELECT is_admin_or_mitarbeiter())
  );
