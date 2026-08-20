-- Uploads des Briefing-Generators: Ordner 'campaign-briefings' im
-- documents-Bucket fuer Admins/Mitarbeiter freischalten (Insert/Delete).
-- Select laeuft bereits ueber documents_select_staff_kunde (Staff-only,
-- seit 20260818_campaign_briefings).

-- Insert: bestehende Staff-Policy um den Ordner erweitern
DROP POLICY IF EXISTS "documents_insert_staff" ON storage.objects;
CREATE POLICY "documents_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = ANY (ARRAY['briefings', 'kampagnen', 'campaign-briefings'])
    AND (SELECT is_admin_or_mitarbeiter())
  );

-- Delete: eigenstaendige Staff-Policy fuer den Ordner (bestehende
-- Delete-Policies referenzieren die gedroppten Alt-Tabellen nicht mehr,
-- daher hier sauber getrennt)
DROP POLICY IF EXISTS "documents_delete_staff_campaign_briefings" ON storage.objects;
CREATE POLICY "documents_delete_staff_campaign_briefings" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'campaign-briefings'
    AND (SELECT is_admin_or_mitarbeiter())
  );
