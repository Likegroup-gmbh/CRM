-- Neuigkeiten-Feed ("Was ist neu") im Dashboard
--
-- Bei jedem erfolgreichen Production-Deploy von main schreibt eine GitHub
-- Action (scripts/neuigkeiten/run.cjs) einen Post in einfacher Sprache mit
-- Step-by-Step und Screenshots der betroffenen Screens.
--
--   neuigkeit    die Posts. status 'skipped' markiert Deploys ohne
--                User-sichtbare Aenderung, damit die SHA nicht nochmal
--                durchlaeuft. commit_sha ist die Deduplizierung gegen
--                Re-Runs der Action.
--
-- v1 ist intern-only: SELECT nur fuer Admin/Mitarbeiter, geschrieben wird
-- ausschliesslich per Service Role aus der Action. audience 'alle' ist
-- vorbereitet fuer den spaeteren Kunden-Feed.

BEGIN;

CREATE TABLE IF NOT EXISTS neuigkeit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titel text NOT NULL,
  teaser text,
  inhalt text,
  -- [{ titel, text, route, screenshot_path }] - screenshot_path zeigt in
  -- den Bucket neuigkeiten, NULL wenn der Shot fehlgeschlagen ist
  schritte jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience text NOT NULL DEFAULT 'intern' CHECK (audience IN ('intern', 'alle')),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'skipped')),
  commit_sha text UNIQUE,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dashboard- und Listen-Query: neueste published zuerst
CREATE INDEX IF NOT EXISTS neuigkeit_published_idx
  ON neuigkeit (published_at DESC)
  WHERE status = 'published';

COMMENT ON TABLE neuigkeit IS 'Automatisch generierte Update-Posts nach Production-Deploy von main. published = sichtbar, skipped = Deploy ohne User-sichtbare Aenderung (Deduplizierung ueber commit_sha).';

CREATE TRIGGER neuigkeit_updated_at
  BEFORE UPDATE ON neuigkeit
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS: lesen nur intern, schreiben nur Service Role (Action)
-- ============================================================

ALTER TABLE neuigkeit ENABLE ROW LEVEL SECURITY;

CREATE POLICY neuigkeit_select ON neuigkeit
  FOR SELECT TO authenticated
  USING (status = 'published' AND (SELECT is_admin_or_mitarbeiter()));

-- Kein INSERT/UPDATE/DELETE fuer authenticated: die GitHub Action schreibt
-- per Service Role, Korrekturen laufen direkt in Supabase.

-- ============================================================
-- Storage-Bucket fuer die Screenshots (public read wie instagram-media,
-- Schreiben nur via Service Role)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'neuigkeiten',
  'neuigkeiten',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for neuigkeiten"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'neuigkeiten');

COMMIT;
