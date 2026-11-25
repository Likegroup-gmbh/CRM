-- Post der Auswertung (CONTEXT.md „Post“, ADR 0076, ADR 0078).
--
-- Ein Post gehört zu genau einem Kooperationsvideo, einer Story oder einem Still und nennt
-- die gepostete Finale Version (video_asset_id / story_asset_id; beim Still ist es der Still
-- selbst). Wird die Datei gelöscht, bleibt der Post mit seinen Zahlen.
--
-- Erfasst wird auf zwei Wegen:
--   Link        post-link-abruf (Meta Business Discovery): views, likes, comments, sofort confirmed
--   Screenshot  post-screenshot-background (Claude Vision): Insights, landet als draft
-- Während die KI liest, steht ki_status = 'laeuft'; ein Fehler bleibt mit Grund am Post.
--
-- kooperation_id, kampagne_id und produktion_id setzt der Trigger aus dem Anker, damit RLS
-- ohne Join auskommt und der Client sie nicht falsch schicken kann.
--
-- Rechte: nur das Team (Admin, Mitarbeiter im eigenen Bereich). Kunde und Gast lesen später
-- die Report-Freigabe, nie die Posts selbst.
--
-- Bestand: link_live und stats_* der Kooperationsvideos werden übernommen. Danach sind diese
-- Spalten Altfelder; gelöscht werden sie in einem eigenen Schritt.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.kooperation_post;
--   DROP FUNCTION IF EXISTS public.kooperation_post_scope();
--   DELETE FROM storage.objects WHERE bucket_id = 'post-screenshots';
--   DELETE FROM storage.buckets WHERE id = 'post-screenshots';

BEGIN;

CREATE TABLE IF NOT EXISTS public.kooperation_post (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kampagne_id uuid NOT NULL REFERENCES public.kampagne(id) ON DELETE CASCADE,
  produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL,
  kooperation_id uuid NOT NULL REFERENCES public.kooperationen(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.kooperation_videos(id) ON DELETE CASCADE,
  story_id uuid REFERENCES public.kooperation_story(id) ON DELETE CASCADE,
  still_id uuid REFERENCES public.kooperation_bilder_asset(id) ON DELETE CASCADE,
  video_asset_id uuid REFERENCES public.kooperation_video_asset(id) ON DELETE SET NULL,
  story_asset_id uuid REFERENCES public.kooperation_story_asset(id) ON DELETE SET NULL,
  plattform text NOT NULL CHECK (plattform IN ('ig_reel', 'ig_story', 'ig_post', 'tiktok')),
  account_handle text,
  link text,
  posted_at date,
  measured_at date,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics) = 'object'),
  confidence jsonb,
  source text NOT NULL CHECK (source IN ('ki', 'manuell', 'api')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  ki_status text CHECK (ki_status IN ('laeuft', 'fehler')),
  ki_fehler text,
  screenshot_pfade text[] NOT NULL DEFAULT '{}',
  api_raw jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  CONSTRAINT kooperation_post_ein_anker CHECK (num_nonnulls(video_id, story_id, still_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_kooperation_post_kampagne ON public.kooperation_post (kampagne_id);
CREATE INDEX IF NOT EXISTS idx_kooperation_post_produktion ON public.kooperation_post (produktion_id);
CREATE INDEX IF NOT EXISTS idx_kooperation_post_kooperation ON public.kooperation_post (kooperation_id);
CREATE INDEX IF NOT EXISTS idx_kooperation_post_video ON public.kooperation_post (video_id) WHERE video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kooperation_post_story ON public.kooperation_post (story_id) WHERE story_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kooperation_post_still ON public.kooperation_post (still_id) WHERE still_id IS NOT NULL;

-- ─── Scope aus dem Anker ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.kooperation_post_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_video_id uuid;
BEGIN
  IF NEW.video_id IS NOT NULL THEN
    v_video_id := NEW.video_id;
    SELECT v.kooperation_id INTO NEW.kooperation_id FROM public.kooperation_videos v WHERE v.id = NEW.video_id;
  ELSIF NEW.story_id IS NOT NULL THEN
    SELECT s.video_id INTO v_video_id FROM public.kooperation_story s WHERE s.id = NEW.story_id;
    SELECT v.kooperation_id INTO NEW.kooperation_id FROM public.kooperation_videos v WHERE v.id = v_video_id;
  ELSE
    SELECT b.kooperation_id INTO NEW.kooperation_id FROM public.kooperation_bilder_asset b WHERE b.id = NEW.still_id;
  END IF;

  IF NEW.kooperation_id IS NULL THEN
    RAISE EXCEPTION 'Post ohne Kooperation: Anker nicht gefunden';
  END IF;

  SELECT k.kampagne_id, k.produktion_id INTO NEW.kampagne_id, NEW.produktion_id
  FROM public.kooperationen k WHERE k.id = NEW.kooperation_id;

  -- Die genannte Datei muss zum Anker gehören
  IF NEW.video_asset_id IS NOT NULL AND (NEW.video_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.kooperation_video_asset a WHERE a.id = NEW.video_asset_id AND a.video_id = NEW.video_id
  )) THEN
    RAISE EXCEPTION 'Datei gehört nicht zum Video des Posts';
  END IF;
  IF NEW.story_asset_id IS NOT NULL AND (NEW.story_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.kooperation_story_asset a WHERE a.id = NEW.story_asset_id AND a.story_id = NEW.story_id
  )) THEN
    RAISE EXCEPTION 'Datei gehört nicht zur Story des Posts';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kooperation_post_scope ON public.kooperation_post;
CREATE TRIGGER kooperation_post_scope
  BEFORE INSERT OR UPDATE ON public.kooperation_post
  FOR EACH ROW EXECUTE FUNCTION public.kooperation_post_scope();

REVOKE EXECUTE ON FUNCTION public.kooperation_post_scope() FROM PUBLIC, anon, authenticated;

-- ─── RLS ────────────────────────────────────────────────────

ALTER TABLE public.kooperation_post ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kooperation_post_select ON public.kooperation_post;
CREATE POLICY kooperation_post_select ON public.kooperation_post
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_mitarbeiter())
    AND ((SELECT public.is_admin()) OR kooperation_id IN (SELECT private.rls_my_kooperation_ids()))
  );

DROP POLICY IF EXISTS kooperation_post_insert ON public.kooperation_post;
CREATE POLICY kooperation_post_insert ON public.kooperation_post
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_or_mitarbeiter())
    AND ((SELECT public.is_admin()) OR kooperation_id IN (SELECT private.rls_my_kooperation_ids()))
  );

DROP POLICY IF EXISTS kooperation_post_update ON public.kooperation_post;
CREATE POLICY kooperation_post_update ON public.kooperation_post
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin_or_mitarbeiter())
    AND ((SELECT public.is_admin()) OR kooperation_id IN (SELECT private.rls_my_kooperation_ids()))
  )
  WITH CHECK (
    (SELECT public.is_admin_or_mitarbeiter())
    AND ((SELECT public.is_admin()) OR kooperation_id IN (SELECT private.rls_my_kooperation_ids()))
  );

DROP POLICY IF EXISTS kooperation_post_delete ON public.kooperation_post;
CREATE POLICY kooperation_post_delete ON public.kooperation_post
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin_or_mitarbeiter())
    AND ((SELECT public.is_admin()) OR kooperation_id IN (SELECT private.rls_my_kooperation_ids()))
  );

-- Restriktiv wie auf allen Video-Tabellen (20261015_rolle_agent, 20261107_testunternehmen_hide_*)
DROP POLICY IF EXISTS agent_nur_lesen_insert ON public.kooperation_post;
CREATE POLICY agent_nur_lesen_insert ON public.kooperation_post
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT (SELECT public.is_agent()));

DROP POLICY IF EXISTS agent_nur_lesen_update ON public.kooperation_post;
CREATE POLICY agent_nur_lesen_update ON public.kooperation_post
  AS RESTRICTIVE FOR UPDATE TO public USING (NOT (SELECT public.is_agent()));

DROP POLICY IF EXISTS agent_nur_lesen_delete ON public.kooperation_post;
CREATE POLICY agent_nur_lesen_delete ON public.kooperation_post
  AS RESTRICTIVE FOR DELETE TO public USING (NOT (SELECT public.is_agent()));

DROP POLICY IF EXISTS testunternehmen_hide ON public.kooperation_post;
CREATE POLICY testunternehmen_hide ON public.kooperation_post
  AS RESTRICTIVE FOR ALL TO public
  USING ((SELECT public.is_admin()) OR NOT (kooperation_id = ANY ((SELECT private.rls_test_kooperation_ids())::uuid[])))
  WITH CHECK ((SELECT public.testunternehmen_ok_kooperation(kooperation_id)));

REVOKE ALL ON TABLE public.kooperation_post FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kooperation_post TO authenticated, service_role;

-- ─── Storage: Screenshots der Insights ──────────────────────

-- Pfad {kampagne_id}/{post_id}/{uuid}.{ext}. Zugriff hat, wer den Post sehen darf: die
-- Unterabfrage läuft unter der RLS von kooperation_post.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-screenshots', 'post-screenshots', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS post_screenshots_select ON storage.objects;
CREATE POLICY post_screenshots_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-screenshots'
    AND EXISTS (SELECT 1 FROM public.kooperation_post p WHERE p.id::text = (storage.foldername(name))[2])
  );

DROP POLICY IF EXISTS post_screenshots_insert ON storage.objects;
CREATE POLICY post_screenshots_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-screenshots'
    AND NOT (SELECT public.is_agent())
    AND EXISTS (
      SELECT 1 FROM public.kooperation_post p
      WHERE p.id::text = (storage.foldername(name))[2] AND p.kampagne_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS post_screenshots_delete ON storage.objects;
CREATE POLICY post_screenshots_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-screenshots'
    AND NOT (SELECT public.is_agent())
    AND EXISTS (SELECT 1 FROM public.kooperation_post p WHERE p.id::text = (storage.foldername(name))[2])
  );

-- ─── Bestand übernehmen ─────────────────────────────────────

-- Kooperationsvideos sind Videos: ein /p/-Link ist ein Reel, solange Meta kein Bild meldet.
-- Mit Zahlen: bestätigter Post (Quelle api bei Abruf, sonst manuell). Nur Link: offener Post,
-- Quelle api, weil als Nächstes der Abruf kommt (Stories liefert die API nicht: manuell).
INSERT INTO public.kooperation_post (
  video_id, plattform, account_handle, link, posted_at, measured_at, metrics,
  source, status, api_raw, confirmed_at, created_at
)
SELECT
  v.id,
  CASE
    WHEN v.link_live ILIKE '%tiktok.com%' THEN 'tiktok'
    WHEN v.link_live ILIKE '%/stories/%' THEN 'ig_story'
    WHEN v.stats_raw->>'media_type' IN ('IMAGE', 'CAROUSEL_ALBUM') THEN 'ig_post'
    ELSE 'ig_reel'
  END,
  nullif(v.stats_raw->>'username', ''),
  nullif(btrim(v.link_live), ''),
  coalesce((v.stats_raw->>'timestamp')::timestamptz::date, v.posting_datum),
  v.stats_fetched_at::date,
  jsonb_strip_nulls(jsonb_build_object('views', v.stats_views, 'likes', v.stats_likes, 'comments', v.stats_comments)),
  CASE
    WHEN v.stats_fetched_at IS NOT NULL THEN 'api'
    WHEN v.stats_views IS NULL AND v.link_live NOT ILIKE '%/stories/%' THEN 'api'
    ELSE 'manuell'
  END,
  CASE WHEN v.stats_views IS NOT NULL THEN 'confirmed' ELSE 'draft' END,
  v.stats_raw,
  CASE WHEN v.stats_views IS NOT NULL THEN coalesce(v.stats_fetched_at, now()) END,
  coalesce(v.stats_fetched_at, now())
FROM public.kooperation_videos v
WHERE (coalesce(btrim(v.link_live), '') <> '' OR v.stats_views IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.kooperation_post p WHERE p.video_id = v.id);

COMMENT ON COLUMN public.kooperation_videos.link_live IS
  'Altfeld: in kooperation_post übernommen (20261223). Neue Links stehen am Post.';
COMMENT ON COLUMN public.kooperation_videos.stats_views IS
  'Altfeld: in kooperation_post übernommen (20261223). Zahlen stehen am Post.';

COMMIT;
