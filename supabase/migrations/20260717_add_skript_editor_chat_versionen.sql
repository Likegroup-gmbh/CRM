-- Skript-Editor (Chat-basiertes Feedback-Interface)
-- Neue Tabellen:
--   skript_versionen     - Snapshot pro angenommener Aenderung (v1 = Erstgenerierung)
--   skript_chat_messages - Chat-Verlauf pro Skript; die Assistant-Message ist
--                          gleichzeitig der "Job" (status pending -> running -> vorschlag)

-- =====================================================================
-- Versions-Snapshots
-- =====================================================================
CREATE TABLE IF NOT EXISTS skript_versionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skript_id uuid NOT NULL REFERENCES skripte(id) ON DELETE CASCADE,
  version_nr int NOT NULL,
  titel varchar,
  hook text,
  hauptteil text,
  cta text,
  aenderung_beschreibung text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (skript_id, version_nr)
);

CREATE INDEX IF NOT EXISTS idx_skript_versionen_skript ON skript_versionen(skript_id);

-- =====================================================================
-- Chat-Messages (User + Assistant); Assistant-Message traegt den Job-Status
-- =====================================================================
CREATE TABLE IF NOT EXISTS skript_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skript_id uuid NOT NULL REFERENCES skripte(id) ON DELETE CASCADE,
  rolle varchar NOT NULL CHECK (rolle IN ('user','assistant')),
  inhalt text,
  aktion varchar CHECK (aktion IN ('neu_schreiben','kuerzen','laenger','anderer_ton','chat')),
  sektion varchar CHECK (sektion IN ('hook','hauptteil','cta','gesamt')),
  selektion_text text,
  vorschlag_text text,
  -- User-Messages stehen immer auf 'fertig'. Assistant-Lifecycle:
  -- pending -> running -> vorschlag (mit vorschlag_text) -> angenommen|abgelehnt
  --                    -> fertig (reine Antwort ohne Aenderungsvorschlag)
  --                    -> error
  status varchar NOT NULL DEFAULT 'fertig'
    CHECK (status IN ('pending','running','vorschlag','angenommen','abgelehnt','fertig','error')),
  error_message text,
  model varchar,
  usage jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skript_chat_messages_skript ON skript_chat_messages(skript_id, created_at);

CREATE TRIGGER skript_chat_messages_updated_at BEFORE UPDATE ON skript_chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- RLS: intern (Admin + Mitarbeiter), wie alle Skript-Tabellen
-- =====================================================================
ALTER TABLE skript_versionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE skript_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY skript_versionen_select ON skript_versionen FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_versionen_insert ON skript_versionen FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_versionen_delete ON skript_versionen FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY skript_chat_messages_select ON skript_chat_messages FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_chat_messages_insert ON skript_chat_messages FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_chat_messages_update ON skript_chat_messages FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_chat_messages_delete ON skript_chat_messages FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

-- Realtime fuer Chat-Updates in der UI (wie skript_generation_jobs)
ALTER PUBLICATION supabase_realtime ADD TABLE skript_chat_messages;
