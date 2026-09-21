-- PDF-Extract am Persona-Liky: modus extract plus Storage-Ordner.

BEGIN;

ALTER TABLE persona_liky_jobs DROP CONSTRAINT IF EXISTS persona_liky_jobs_modus_check;
ALTER TABLE persona_liky_jobs
  ADD CONSTRAINT persona_liky_jobs_modus_check CHECK (modus IN ('chat', 'extract'));

COMMENT ON TABLE persona_liky_jobs IS 'Liky-Jobs am Persona-Worksheet (chat + PDF-extract). Client legt an und pollt, Netlify Function (Service Role) schreibt Status und Ergebnis. URL-Extract laeuft weiter ueber extract_jobs.';

DROP POLICY IF EXISTS "documents_insert_staff" ON storage.objects;
CREATE POLICY "documents_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = ANY (ARRAY['briefings', 'kampagnen', 'campaign-briefings', 'kundenbriefings', 'persona-liky'])
    AND (SELECT is_admin_or_mitarbeiter())
  );

DROP POLICY IF EXISTS "documents_delete_staff_persona_liky" ON storage.objects;
CREATE POLICY "documents_delete_staff_persona_liky" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'persona-liky'
    AND (SELECT is_admin_or_mitarbeiter())
  );

COMMIT;
