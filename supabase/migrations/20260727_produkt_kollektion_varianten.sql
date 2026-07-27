-- Produkte auf Markenebene: Kollektion + Varianten + Bilder.
--
-- Ein Produkt ist ab jetzt eine Kollektion, die die Skript-Substanz traegt.
-- Varianten (Farbe, Modell, abweichender Preis) erben den Rest von der Kollektion.
-- Die Tabelle "produkt" war leer, deshalb werden Spalten hier umbenannt und
-- gedroppt statt parallel gefuehrt.
--
-- Spalten-Mapping der Altbestaende:
--   kernbotschaft                -> kurzbeschreibung  (NOT NULL entfaellt)
--   hauptproblem                 -> pain_points       (NOT NULL entfaellt)
--   kernnutzen                   -> loesung
--   zielnutzer_anwendungskontext -> einsatzsituation
--   usp_1/2/3                    -> ein Textfeld usp
--   kauf_conversion_trigger      -> entfaellt

BEGIN;

-- ============================================================
-- 1. produkt: Spalten umbenennen (idempotent)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'kernbotschaft')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'kurzbeschreibung') THEN
    ALTER TABLE produkt RENAME COLUMN kernbotschaft TO kurzbeschreibung;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'hauptproblem')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'pain_points') THEN
    ALTER TABLE produkt RENAME COLUMN hauptproblem TO pain_points;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'kernnutzen')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'loesung') THEN
    ALTER TABLE produkt RENAME COLUMN kernnutzen TO loesung;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'zielnutzer_anwendungskontext')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'produkt' AND column_name = 'einsatzsituation') THEN
    ALTER TABLE produkt RENAME COLUMN zielnutzer_anwendungskontext TO einsatzsituation;
  END IF;
END $$;

-- ============================================================
-- 2. produkt: NOT NULL loesen, neue Spalten, Altlasten droppen
-- ============================================================

-- Nur "name" und "marke_id" bleiben Pflicht. Ein Produkt soll sich mit wenigen
-- Angaben anlegen lassen und spaeter per KI oder Hand angereichert werden.
ALTER TABLE produkt ALTER COLUMN kurzbeschreibung DROP NOT NULL;
ALTER TABLE produkt ALTER COLUMN pain_points DROP NOT NULL;

ALTER TABLE produkt
  ADD COLUMN IF NOT EXISTS usp text,
  ADD COLUMN IF NOT EXISTS preis_von numeric(10, 2),
  ADD COLUMN IF NOT EXISTS preis_bis numeric(10, 2),
  ADD COLUMN IF NOT EXISTS erlaubte_claims text,
  ADD COLUMN IF NOT EXISTS verbotene_claims text,
  ADD COLUMN IF NOT EXISTS rechtliche_hinweise text,
  ADD COLUMN IF NOT EXISTS inhaltsstoffe text;

-- usp_1/2/3 werden zu einem Feld zusammengefuehrt (eine Zeile pro USP).
-- Die Tabelle ist leer, es gehen keine Daten verloren.
ALTER TABLE produkt
  DROP COLUMN IF EXISTS usp_1,
  DROP COLUMN IF EXISTS usp_2,
  DROP COLUMN IF EXISTS usp_3,
  DROP COLUMN IF EXISTS kauf_conversion_trigger;

COMMENT ON COLUMN produkt.usp IS 'Warum kauft man es. Ein USP pro Zeile.';
COMMENT ON COLUMN produkt.pain_points IS 'Welche Probleme loest es. Ein Pain Point pro Zeile.';
COMMENT ON COLUMN produkt.einsatzsituation IS 'Zielsituation und Anwendungsfall in einem Feld.';
COMMENT ON COLUMN produkt.url IS 'Shop-URL, Einstiegspunkt fuer die KI-Extraktion (site-extract).';

-- ============================================================
-- 3. Junctions fuer Pflicht-Elemente und No-Gos entfernen
--    Claims sind ab jetzt Freitextfelder (erlaubte_claims/verbotene_claims).
--    Die Lookup-Tabellen pflicht_elemente_typen und no_go_typen bleiben stehen.
-- ============================================================

DROP TABLE IF EXISTS produkt_pflicht_elemente;
DROP TABLE IF EXISTS produkt_no_gos;

-- ============================================================
-- 4. produkt_variante
-- ============================================================

CREATE TABLE IF NOT EXISTS produkt_variante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES produkt(id) ON DELETE CASCADE,
  name text NOT NULL,
  modell_kompatibilitaet text,
  farbe text,
  preis numeric(10, 2),
  merkmal text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produkt_variante_produkt_id_idx ON produkt_variante(produkt_id, position);

COMMENT ON TABLE produkt_variante IS 'Varianten einer Produkt-Kollektion. Nur das Unterscheidende, der Rest wird von der Kollektion geerbt. Optional - ein Produkt ohne Varianten ist gueltig.';
COMMENT ON COLUMN produkt_variante.modell_kompatibilitaet IS 'Bei Zubehoer: fuer welches Geraet, z.B. "iPhone 15 Pro".';
COMMENT ON COLUMN produkt_variante.preis IS 'Nur setzen, wenn er von der Preis-Range der Kollektion abweicht.';

-- ============================================================
-- 5. produkt_bilder
--    Kollektionsbilder haben variante_id IS NULL, Variantenbilder tragen die
--    Variante. Gleiche Mechanik, ein Storage-Pfad pro Zeile.
-- ============================================================

CREATE TABLE IF NOT EXISTS produkt_bilder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES produkt(id) ON DELETE CASCADE,
  variante_id uuid REFERENCES produkt_variante(id) ON DELETE CASCADE,
  storage_pfad text NOT NULL,
  quelle_url text,
  position integer NOT NULL DEFAULT 0,
  ist_hauptbild boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produkt_bilder_produkt_id_idx ON produkt_bilder(produkt_id, position);
CREATE INDEX IF NOT EXISTS produkt_bilder_variante_id_idx ON produkt_bilder(variante_id) WHERE variante_id IS NOT NULL;

-- Pro Kollektion nur ein Hauptbild
CREATE UNIQUE INDEX IF NOT EXISTS produkt_bilder_hauptbild_idx
  ON produkt_bilder(produkt_id)
  WHERE ist_hauptbild AND variante_id IS NULL;

COMMENT ON TABLE produkt_bilder IS 'Produkt-Assets im Storage-Bucket "produkte". Von der KI aus der Shop-Seite gezogen oder manuell hochgeladen.';
COMMENT ON COLUMN produkt_bilder.storage_pfad IS 'Pfad innerhalb des Buckets "produkte", z.B. {produkt_id}/{bild_id}.webp. Zwischenstand der KI-Extraktion: _temp/{extract_id}/{n}.webp';
COMMENT ON COLUMN produkt_bilder.quelle_url IS 'Original-URL, falls das Bild von der Shop-Seite stammt.';

-- ============================================================
-- 6. updated_at-Trigger fuer Varianten
-- ============================================================

CREATE OR REPLACE FUNCTION update_produkt_variante_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_produkt_variante_updated_at ON produkt_variante;
CREATE TRIGGER trigger_produkt_variante_updated_at
  BEFORE UPDATE ON produkt_variante
  FOR EACH ROW EXECUTE FUNCTION update_produkt_variante_updated_at();

-- ============================================================
-- 7. RLS
--    Schreiben nur Admin/Mitarbeiter. Lesen zusaetzlich fuer Kunden der Marke -
--    analog produkt_select_policy, die das fuer die Kollektion schon abbildet.
-- ============================================================

ALTER TABLE produkt_variante ENABLE ROW LEVEL SECURITY;
ALTER TABLE produkt_bilder ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produkt_variante_select ON produkt_variante;
CREATE POLICY produkt_variante_select ON produkt_variante
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM produkt p WHERE p.id = produkt_variante.produkt_id));

DROP POLICY IF EXISTS produkt_variante_insert ON produkt_variante;
CREATE POLICY produkt_variante_insert ON produkt_variante
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_variante_update ON produkt_variante;
CREATE POLICY produkt_variante_update ON produkt_variante
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_variante_delete ON produkt_variante;
CREATE POLICY produkt_variante_delete ON produkt_variante
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_bilder_select ON produkt_bilder;
CREATE POLICY produkt_bilder_select ON produkt_bilder
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM produkt p WHERE p.id = produkt_bilder.produkt_id));

DROP POLICY IF EXISTS produkt_bilder_insert ON produkt_bilder;
CREATE POLICY produkt_bilder_insert ON produkt_bilder
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_bilder_update ON produkt_bilder;
CREATE POLICY produkt_bilder_update ON produkt_bilder
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produkt_bilder_delete ON produkt_bilder;
CREATE POLICY produkt_bilder_delete ON produkt_bilder
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

-- ============================================================
-- 8. Storage-Bucket "produkte"
--    Public wie "logos", damit Thumbnails ohne signierte URLs anzeigbar sind.
--    Limit hoeher als beim Logo: Produktfotos sind Fotos, nicht Vektorgrafiken.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produkte',
  'produkte',
  true,
  2097152, -- 2 MB
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "produkte_read" ON storage.objects;
CREATE POLICY "produkte_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'produkte');

DROP POLICY IF EXISTS "produkte_insert" ON storage.objects;
CREATE POLICY "produkte_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produkte' AND (SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS "produkte_update" ON storage.objects;
CREATE POLICY "produkte_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'produkte' AND (SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS "produkte_delete" ON storage.objects;
CREATE POLICY "produkte_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'produkte' AND (SELECT is_admin_or_mitarbeiter()));

COMMIT;
