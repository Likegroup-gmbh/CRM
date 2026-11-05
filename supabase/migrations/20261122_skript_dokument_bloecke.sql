-- Skript-Dokument (ADR 0062): Freie Bloecke um die Skript-Tabelle.
--
--   * skripte.dokument_bloecke: Block-Liste in Dokument-Reihenfolge, inkl.
--     Platz der Skript-Tabelle ({typ: 'skript_tabelle'}). NULL = nur die
--     Skript-Tabelle wie bisher. Nicht Teil von skript_versionen.
--   * skripte.dokument_bloecke_rev: Zaehler fuer Last-Write-Wins mit Hinweis.
--     updated_at taugt dafuer nicht, jede Grid-Speicherung zieht es hoch.
--   * skript_textbausteine: vom Team gespeicherte Block-Folgen, 1:1 einfuegbar.
--   * Bucket skript-bilder: Bilder der Freien Bloecke. Public wie "produkte",
--     damit Kunde, Gast-Link, Creator und das PDF ohne signierte URLs lesen.
--     Schreiben nur Staff.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.skript_textbausteine;
--   ALTER TABLE public.skripte DROP CONSTRAINT IF EXISTS skripte_dokument_bloecke_array;
--   ALTER TABLE public.skripte DROP COLUMN IF EXISTS dokument_bloecke_rev, DROP COLUMN IF EXISTS dokument_bloecke;
--   (Bucket skript-bilder nur leer loeschen.)

BEGIN;

ALTER TABLE public.skripte
  ADD COLUMN IF NOT EXISTS dokument_bloecke jsonb,
  ADD COLUMN IF NOT EXISTS dokument_bloecke_rev integer NOT NULL DEFAULT 0;

ALTER TABLE public.skripte DROP CONSTRAINT IF EXISTS skripte_dokument_bloecke_array;
ALTER TABLE public.skripte ADD CONSTRAINT skripte_dokument_bloecke_array
  CHECK (dokument_bloecke IS NULL OR jsonb_typeof(dokument_bloecke) = 'array');

-- ============================================================
-- Textbausteine
-- ============================================================

CREATE TABLE IF NOT EXISTS public.skript_textbausteine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  bloecke jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(bloecke) = 'array'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS skript_textbausteine_updated_at ON public.skript_textbausteine;
CREATE TRIGGER skript_textbausteine_updated_at BEFORE UPDATE ON public.skript_textbausteine
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.skript_textbausteine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skript_textbausteine_staff_select ON public.skript_textbausteine;
CREATE POLICY skript_textbausteine_staff_select ON public.skript_textbausteine
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS skript_textbausteine_staff_insert ON public.skript_textbausteine;
CREATE POLICY skript_textbausteine_staff_insert ON public.skript_textbausteine
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS skript_textbausteine_staff_update ON public.skript_textbausteine;
CREATE POLICY skript_textbausteine_staff_update ON public.skript_textbausteine
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS skript_textbausteine_staff_delete ON public.skript_textbausteine;
CREATE POLICY skript_textbausteine_staff_delete ON public.skript_textbausteine
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()));

-- ============================================================
-- Storage-Bucket "skript-bilder"
--    Client verkleinert vor dem Upload auf ca. 1600 px; 5 MB ist die Obergrenze.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'skript-bilder',
  'skript-bilder',
  true,
  5242880, -- 5 MB
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "skript_bilder_read" ON storage.objects;
CREATE POLICY "skript_bilder_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'skript-bilder');

DROP POLICY IF EXISTS "skript_bilder_insert" ON storage.objects;
CREATE POLICY "skript_bilder_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skript-bilder' AND (SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS "skript_bilder_update" ON storage.objects;
CREATE POLICY "skript_bilder_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'skript-bilder' AND (SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS "skript_bilder_delete" ON storage.objects;
CREATE POLICY "skript_bilder_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'skript-bilder' AND (SELECT public.is_admin_or_mitarbeiter()));

COMMIT;
