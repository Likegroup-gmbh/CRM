-- Visuelle Regie-Modi (Klassisch / Dynamisch) fuer "Was zu sehen ist"
--   skript_modi: flaches Preset analog zur DNA, ohne Layer
--   skript_chat_messages.modus: gewaehlter Slug (kein FK, Verlauf bleibt stabil)

CREATE TABLE IF NOT EXISTS skript_modi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  beschreibung varchar,
  inhalt text NOT NULL,
  status varchar NOT NULL DEFAULT 'aktiv' CHECK (status IN ('entwurf','aktiv','archiviert')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skript_modi_status_sort ON skript_modi(status, sort_order);

CREATE TRIGGER skript_modi_updated_at BEFORE UPDATE ON skript_modi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE skript_modi ENABLE ROW LEVEL SECURITY;

CREATE POLICY skript_modi_select ON skript_modi FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_modi_insert ON skript_modi FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_modi_update ON skript_modi FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_modi_delete ON skript_modi FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

ALTER TABLE skript_chat_messages
  ADD COLUMN IF NOT EXISTS modus varchar;

INSERT INTO skript_modi (slug, name, beschreibung, inhalt, status, sort_order) VALUES
(
  'klassisch',
  'Klassisch',
  'Ruhige, bewährte visuelle Regie',
  'Ruhige, klare visuelle Regie – wie bisher. Nachvollziehbare Shots, die den gesprochenen Text stützen. Wenige, gut gesetzte Schnitte. Keine unnötigen Perspektivwechsel, kein künstlich hohes Tempo. Shot-Länge und Schnittfrequenz ergeben sich natürlich aus dem gesprochenen Text und der Video-Länge. B-Roll und Overlays nur dort, wo sie die Aussage tragen. Stil, Orte und Props über die Sektion hinweg konsistent halten.',
  'aktiv',
  1
),
(
  'dynamisch',
  'Dynamisch',
  'Schnelle Wechsel, mehr Szenen, Perspektivwechsel',
  'Dynamische, spannende visuelle Regie: schnelle Wechsel, mehr Szenen, häufige Perspektivwechsel. Shot-Längen typischerweise 0,5–2 Sekunden. Wechselnde Kamerawinkel (Close-up, Wide, Over-shoulder, Detail, B-Roll) im Wechsel. Hohes Tempo, visuell interessanter und abwechslungsreicher als eine ruhige Master-Shot-Regie. Trotzdem Stil, Orte und Props konsistent halten und Zeitstempel nahtlos anschließen. Kein Sprechertext.',
  'aktiv',
  2
);
