-- Report-PDF (ADR 0080): Jobs fuer die Probe-PDF aus den PDF-Vorlagen. Der Client legt
-- den Job mit dem fertigen View-Model an, report-pdf-background druckt es mit Chromium
-- und legt die Datei im privaten Bucket report-pdfs ab. In Schritt 2 (Export aus der
-- Auswertung) kommt hier ein Bezug auf die Produktion dazu.

BEGIN;

CREATE TABLE IF NOT EXISTS report_pdf_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'error')),
  progress_step varchar,
  progress_steps jsonb,
  eingabe jsonb NOT NULL,
  result jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_pdf_jobs_created_by
  ON report_pdf_jobs(created_by, created_at);

CREATE TRIGGER report_pdf_jobs_updated_at
  BEFORE UPDATE ON report_pdf_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE report_pdf_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_pdf_jobs_insert ON report_pdf_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()) AND created_by = (SELECT auth.uid()));

CREATE POLICY report_pdf_jobs_select ON report_pdf_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Kein Client-UPDATE/DELETE: schreibt ausschliesslich die Function (Service Role)

ALTER PUBLICATION supabase_realtime ADD TABLE report_pdf_jobs;

-- Privater Bucket; die Function schreibt nach vorlagen/<uid>/<jobId>.pdf und raeumt
-- aeltere Probe-PDFs desselben Nutzers weg. Der Client liest nur fuer die Signed URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-pdfs', 'report-pdfs', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "report_pdfs_select_eigene_vorlagen" ON storage.objects;
CREATE POLICY "report_pdfs_select_eigene_vorlagen" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-pdfs'
    AND (storage.foldername(name))[1] = 'vorlagen'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    AND (SELECT is_admin())
  );

COMMIT;
