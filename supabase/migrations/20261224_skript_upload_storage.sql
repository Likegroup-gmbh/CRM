-- ADR 0073: das PDF eines Skript-Uploads liegt kurz im documents-Bucket
-- unter skript-upload/{userId}/, bis die Function es gelesen und gelöscht hat.
-- Dieselbe Staff-Policy wie die anderen Ordner, nur der Ordner kommt dazu.

DROP POLICY IF EXISTS "documents_insert_staff" ON storage.objects;
CREATE POLICY "documents_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = ANY (ARRAY[
      'briefings', 'kampagnen', 'campaign-briefings', 'kundenbriefings',
      'persona-liky', 'produkt-pdfs', 'skript-upload'
    ])
    AND (SELECT is_admin_or_mitarbeiter())
  );
