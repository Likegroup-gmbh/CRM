-- Produkt-PDFs liegen im documents-Bucket unter produkt-pdfs/{userId}/.
-- Dieselbe Staff-Policy wie kundenbriefings, nur der Ordner kommt dazu.

DROP POLICY IF EXISTS "documents_insert_staff" ON storage.objects;
CREATE POLICY "documents_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = ANY (ARRAY[
      'briefings', 'kampagnen', 'campaign-briefings', 'kundenbriefings', 'persona-liky', 'produkt-pdfs'
    ])
    AND (SELECT is_admin_or_mitarbeiter())
  );

DROP POLICY IF EXISTS "documents_delete_staff_produkt_pdfs" ON storage.objects;
CREATE POLICY "documents_delete_staff_produkt_pdfs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'produkt-pdfs'
    AND (SELECT is_admin_or_mitarbeiter())
  );
