-- Tags an Varianten im Videos-Tab (Spaltenbrowser).
--
-- Ein Tag gehört zur Variante (Video A, Story 2, Bild 3), nicht zur einzelnen Version: wer
-- Video A einmal mit "Persona A" taggt, hat das Tag in jeder Feedbackschleife und in der
-- Finalen Version. Die Variante steht als variant_key am Kooperationsvideo, z. B. 'videoA'.
-- Finale Dateien erben den Schlüssel ihrer Quelle (source_asset_id), das löst der Client auf.
--
-- video_tag_typen   Katalog mit Gruppen. kampagne_id null = global, sonst nur diese Kampagne.
-- video_variante_tags  Zuordnung Variante -> Tag (IDs, damit Umbenennen nichts bricht).
--
-- Rechte: Staff schreibt. Lesen darf, wer das Video sehen darf (Kunde, Gast), über die RLS
-- von kooperation_videos. Tags im Katalog sehen Kunden nur, wenn sie an einem sichtbaren Video hängen.

BEGIN;

CREATE TABLE IF NOT EXISTS public.video_tag_typen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  gruppe text NOT NULL DEFAULT 'Eigene'
    CHECK (gruppe IN ('Persona', 'Ansatz', 'Plattform', 'Sonstiges', 'Eigene')),
  kampagne_id uuid REFERENCES public.kampagne(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ein Label gibt es je Geltungsbereich nur einmal, ohne Beachtung von Groß- und Kleinschreibung
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_tag_typen_label
  ON public.video_tag_typen (lower(btrim(label)), COALESCE(kampagne_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_video_tag_typen_kampagne
  ON public.video_tag_typen (kampagne_id);

CREATE TABLE IF NOT EXISTS public.video_variante_tags (
  video_id uuid NOT NULL REFERENCES public.kooperation_videos(id) ON DELETE CASCADE,
  variant_key text NOT NULL CHECK (char_length(variant_key) BETWEEN 1 AND 120),
  tag_typ_id uuid NOT NULL REFERENCES public.video_tag_typen(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, variant_key, tag_typ_id)
);

CREATE INDEX IF NOT EXISTS idx_video_variante_tags_tag
  ON public.video_variante_tags (tag_typ_id);

-- Ein paar globale Tags, damit die Auswahl nicht leer startet
INSERT INTO public.video_tag_typen (label, gruppe) VALUES
  ('TikTok', 'Plattform'),
  ('Instagram Reels', 'Plattform'),
  ('YouTube Shorts', 'Plattform'),
  ('Testimonial', 'Ansatz'),
  ('Problem → Produkt', 'Ansatz'),
  ('Unboxing', 'Ansatz')
ON CONFLICT DO NOTHING;

ALTER TABLE public.video_tag_typen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_variante_tags ENABLE ROW LEVEL SECURITY;

-- Katalog: Staff sieht alles, andere nur Tags, die an einem für sie sichtbaren Video hängen.
-- Die Unterabfrage auf video_variante_tags läuft selbst unter RLS.
DROP POLICY IF EXISTS video_tag_typen_select ON public.video_tag_typen;
CREATE POLICY video_tag_typen_select ON public.video_tag_typen
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_mitarbeiter())
    OR EXISTS (SELECT 1 FROM public.video_variante_tags t WHERE t.tag_typ_id = video_tag_typen.id)
  );

DROP POLICY IF EXISTS video_tag_typen_gast_select ON public.video_tag_typen;
CREATE POLICY video_tag_typen_gast_select ON public.video_tag_typen
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.video_variante_tags t WHERE t.tag_typ_id = video_tag_typen.id));

DROP POLICY IF EXISTS video_tag_typen_insert ON public.video_tag_typen;
CREATE POLICY video_tag_typen_insert ON public.video_tag_typen
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS video_tag_typen_update ON public.video_tag_typen;
CREATE POLICY video_tag_typen_update ON public.video_tag_typen
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS video_tag_typen_delete ON public.video_tag_typen;
CREATE POLICY video_tag_typen_delete ON public.video_tag_typen
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()));

-- Zuordnung: lesen, wer das Video sehen darf (RLS von kooperation_videos, auch für Gäste)
DROP POLICY IF EXISTS video_variante_tags_select ON public.video_variante_tags;
CREATE POLICY video_variante_tags_select ON public.video_variante_tags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kooperation_videos v WHERE v.id = video_variante_tags.video_id));

DROP POLICY IF EXISTS video_variante_tags_gast_select ON public.video_variante_tags;
CREATE POLICY video_variante_tags_gast_select ON public.video_variante_tags
  FOR SELECT
  USING (public.gast_can_access_video(video_id, false));

-- Schreiben: Staff, und nur an Videos, die er sehen darf
DROP POLICY IF EXISTS video_variante_tags_insert ON public.video_variante_tags;
CREATE POLICY video_variante_tags_insert ON public.video_variante_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_or_mitarbeiter())
    AND EXISTS (SELECT 1 FROM public.kooperation_videos v WHERE v.id = video_variante_tags.video_id)
  );

DROP POLICY IF EXISTS video_variante_tags_delete ON public.video_variante_tags;
CREATE POLICY video_variante_tags_delete ON public.video_variante_tags
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin_or_mitarbeiter())
    AND EXISTS (SELECT 1 FROM public.kooperation_videos v WHERE v.id = video_variante_tags.video_id)
  );

-- Restriktiv wie auf allen Video-Tabellen (20261015_rolle_agent, 20261107_testunternehmen_hide_*)
DROP POLICY IF EXISTS agent_nur_lesen_insert ON public.video_variante_tags;
CREATE POLICY agent_nur_lesen_insert ON public.video_variante_tags
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT (SELECT public.is_agent()));

DROP POLICY IF EXISTS agent_nur_lesen_delete ON public.video_variante_tags;
CREATE POLICY agent_nur_lesen_delete ON public.video_variante_tags
  AS RESTRICTIVE FOR DELETE TO public USING (NOT (SELECT public.is_agent()));

DROP POLICY IF EXISTS testunternehmen_hide ON public.video_variante_tags;
CREATE POLICY testunternehmen_hide ON public.video_variante_tags
  AS RESTRICTIVE FOR ALL TO public
  USING ((SELECT public.is_admin()) OR NOT (video_id = ANY ((SELECT private.rls_test_video_ids())::uuid[])))
  WITH CHECK ((SELECT public.testunternehmen_ok_video(video_id)));

DROP POLICY IF EXISTS agent_nur_lesen_insert ON public.video_tag_typen;
CREATE POLICY agent_nur_lesen_insert ON public.video_tag_typen
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT (SELECT public.is_agent()));

REVOKE ALL ON TABLE public.video_tag_typen FROM public, anon;
GRANT SELECT ON TABLE public.video_tag_typen TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.video_tag_typen TO authenticated, service_role;

REVOKE ALL ON TABLE public.video_variante_tags FROM public, anon;
GRANT SELECT ON TABLE public.video_variante_tags TO anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.video_variante_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.video_variante_tags TO service_role;

COMMIT;
