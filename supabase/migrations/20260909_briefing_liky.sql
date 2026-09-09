-- Briefing-Liky: Kundenbriefing-PDF, Chat-Verlauf und Extract-Jobs.
-- ADR 0008: Liky-Spalte am Multistep. ADR 0009: File an Marke/Unternehmen.

-- =====================================================================
-- kundenbriefings: 1:1 zum Briefing, File liegt an Marke/Unternehmen
-- =====================================================================
CREATE TABLE IF NOT EXISTS kundenbriefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL UNIQUE REFERENCES campaign_briefings(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('marke', 'unternehmen')),
  entity_id uuid NOT NULL,
  storage_path text NOT NULL,
  dateiname text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kundenbriefings_entity ON kundenbriefings(entity_type, entity_id);

CREATE TRIGGER kundenbriefings_updated_at
  BEFORE UPDATE ON kundenbriefings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE kundenbriefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY kundenbriefings_select ON kundenbriefings
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY kundenbriefings_insert ON kundenbriefings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY kundenbriefings_update ON kundenbriefings
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY kundenbriefings_delete ON kundenbriefings
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

-- =====================================================================
-- briefing_chat_messages: Verlauf pro Briefing (extract + rueckfrage + chat)
-- =====================================================================
CREATE TABLE IF NOT EXISTS briefing_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES campaign_briefings(id) ON DELETE CASCADE,
  rolle varchar NOT NULL CHECK (rolle IN ('user', 'assistant')),
  inhalt text,
  aktion varchar CHECK (aktion IN ('extract', 'rueckfrage', 'chat')),
  status varchar NOT NULL DEFAULT 'fertig'
    CHECK (status IN ('pending', 'running', 'fertig', 'error')),
  error_message text,
  progress_steps jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_chat_messages_briefing
  ON briefing_chat_messages(briefing_id, created_at);

CREATE TRIGGER briefing_chat_messages_updated_at
  BEFORE UPDATE ON briefing_chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE briefing_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY briefing_chat_messages_select ON briefing_chat_messages
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY briefing_chat_messages_insert ON briefing_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY briefing_chat_messages_update ON briefing_chat_messages
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY briefing_chat_messages_delete ON briefing_chat_messages
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

ALTER PUBLICATION supabase_realtime ADD TABLE briefing_chat_messages;

-- =====================================================================
-- briefing_pdf_jobs: Extract- und Chat-Jobs (Client legt an, Function schreibt)
-- =====================================================================
CREATE TABLE IF NOT EXISTS briefing_pdf_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES campaign_briefings(id) ON DELETE CASCADE,
  modus varchar NOT NULL CHECK (modus IN ('extract', 'chat')),
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

CREATE INDEX IF NOT EXISTS idx_briefing_pdf_jobs_briefing
  ON briefing_pdf_jobs(briefing_id, created_at);

CREATE TRIGGER briefing_pdf_jobs_updated_at
  BEFORE UPDATE ON briefing_pdf_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE briefing_pdf_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY briefing_pdf_jobs_insert ON briefing_pdf_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid()));

CREATE POLICY briefing_pdf_jobs_select ON briefing_pdf_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Kein Client-UPDATE/DELETE: schreibt ausschliesslich die Function (Service Role)

-- =====================================================================
-- Storage: Ordner kundenbriefings im documents-Bucket
-- =====================================================================
DROP POLICY IF EXISTS "documents_insert_staff" ON storage.objects;
CREATE POLICY "documents_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = ANY (ARRAY['briefings', 'kampagnen', 'campaign-briefings', 'kundenbriefings'])
    AND (SELECT is_admin_or_mitarbeiter())
  );

DROP POLICY IF EXISTS "documents_delete_staff_kundenbriefings" ON storage.objects;
CREATE POLICY "documents_delete_staff_kundenbriefings" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'kundenbriefings'
    AND (SELECT is_admin_or_mitarbeiter())
  );
