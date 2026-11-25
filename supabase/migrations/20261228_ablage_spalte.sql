-- Medienablage: Upload-Spalten der Kampagne (custom_columns, field_type = 'upload') in SharePoint.
-- Nur additiv, vor dem Deploy, der Dropbox entfernt (ADR 0082).
--   <Kooperation>/<Spaltenname>/                    Spalte auf Kooperationsebene (art = 'spalte')
--   <Kooperation>/<Spaltenname>/Video_<N>_<Thema>/  Spalte auf Videoebene (art = 'spalte_videos',
--                                                   je Video art = 'spalte_video')
-- custom_column_assets bekommt die Ablage-Spalten wie die vier Medien-Tabellen (20261201) und die
-- Kooperation, zu der die Datei gehört (setzt der Server, auch bei Spalten auf Videoebene).
-- Bestandszeilen bleiben ablage = 'dropbox' (Altbestand, nur noch als Link).
--
-- ROLLBACK (nur solange keine Zeile ablage = 'sharepoint' in custom_column_assets steht):
--   ablage_pfad_umschreiben, ablage_url_umschreiben: Definition aus 20261210 erneut ausführen.
--   ablage_upload.typ-CHECK und ablage_ordner.art-CHECK wie in 20261210 bzw. 20261211.
--   DROP INDEX ux_ablage_ordner_spalte, ux_ablage_ordner_spalte_video, idx_ablage_ordner_custom_column;
--   ALTER TABLE ablage_ordner DROP COLUMN custom_column_id;
--   DROP INDEX ux_custom_column_assets_ablage_item, idx_custom_column_assets_kooperation;
--   ALTER TABLE custom_column_assets DROP CONSTRAINT custom_column_assets_ablage_check,
--     DROP COLUMN ablage, DROP COLUMN drive_id, DROP COLUMN item_id, DROP COLUMN etag, DROP COLUMN ctag,
--     DROP COLUMN breite, DROP COLUMN hoehe, DROP COLUMN kooperation_id;
--   ALTER TABLE creator_upload_job ALTER COLUMN ablage SET DEFAULT 'dropbox' (staging_key bleibt nullable,
--     solange Jobs ohne Schlüssel existieren).

BEGIN;

-- ─── Asset-Spalten ──────────────────────────────────────────

ALTER TABLE public.custom_column_assets
  ADD COLUMN IF NOT EXISTS ablage text NOT NULL DEFAULT 'dropbox',
  ADD COLUMN IF NOT EXISTS drive_id text,
  ADD COLUMN IF NOT EXISTS item_id text,
  ADD COLUMN IF NOT EXISTS etag text,
  ADD COLUMN IF NOT EXISTS ctag text,
  ADD COLUMN IF NOT EXISTS breite integer,
  ADD COLUMN IF NOT EXISTS hoehe integer,
  ADD COLUMN IF NOT EXISTS kooperation_id uuid REFERENCES public.kooperationen(id) ON DELETE CASCADE;
COMMENT ON COLUMN public.custom_column_assets.ablage IS
  'sharepoint: Datei in der Medienablage, Identität (drive_id, item_id). dropbox: Altbestand, file_url ist nur noch ein Link.';
COMMENT ON COLUMN public.custom_column_assets.kooperation_id IS
  'Kooperation der Datei (bei Spalten auf Videoebene die Kooperation des Videos). Setzt der Server.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_column_assets_ablage_check') THEN
    ALTER TABLE public.custom_column_assets ADD CONSTRAINT custom_column_assets_ablage_check
      CHECK (ablage IN ('dropbox', 'sharepoint')
             AND (ablage = 'dropbox' OR (drive_id IS NOT NULL AND item_id IS NOT NULL)));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_custom_column_assets_ablage_item
  ON public.custom_column_assets (drive_id, item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_column_assets_kooperation
  ON public.custom_column_assets (kooperation_id) WHERE kooperation_id IS NOT NULL;

-- ─── Register: Spalten-Ordner ───────────────────────────────

ALTER TABLE public.ablage_ordner
  ADD COLUMN IF NOT EXISTS custom_column_id uuid REFERENCES public.custom_columns(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.ablage_ordner.custom_column_id IS
  'art = spalte | spalte_videos | spalte_video: Upload-Spalte der Kampagne. Freie Ordner darunter erben die Spalte.';

ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_art_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_art_check CHECK (art IN (
  'unternehmen', 'bereich', 'marke', 'kampagne', 'produktion', 'kooperation', 'typ', 'video', 'story',
  'schleife', 'finale', 'format', 'variante', 'dokument', 'spalte', 'spalte_videos', 'spalte_video',
  'frei', 'test', 'unzugeordnet'
));

-- Je Kooperation und Spalte ein Ordner, darin je Video einer (nur Spalten auf Videoebene)
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_spalte
  ON public.ablage_ordner (drive_id, kooperation_id, custom_column_id)
  WHERE art IN ('spalte', 'spalte_videos') AND geloescht_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_spalte_video
  ON public.ablage_ordner (drive_id, custom_column_id, kooperation_video_id)
  WHERE art = 'spalte_video' AND geloescht_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_ordner_custom_column
  ON public.ablage_ordner (custom_column_id) WHERE custom_column_id IS NOT NULL;

ALTER TABLE public.ablage_upload DROP CONSTRAINT IF EXISTS ablage_upload_typ_check;
ALTER TABLE public.ablage_upload ADD CONSTRAINT ablage_upload_typ_check CHECK (typ IN (
  'video', 'story', 'still', 'roh', 'spalte',
  'vertrag', 'vertrag_unterschrieben', 'rechnung', 'beleg', 'auftragsdokument'
));

-- ─── Pfade und webUrls nachziehen ───────────────────────────
-- Neu: custom_column_assets (file_path/file_url) und der Ordner-Link in custom_column_values.value.

CREATE OR REPLACE FUNCTION public.ablage_pfad_umschreiben(p_drive_id text, p_alt text, p_neu text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  c integer;
  t text;
  s text[];
BEGIN
  IF p_alt IS NULL OR p_neu IS NULL OR p_alt = '' OR p_alt = p_neu THEN
    RETURN 0;
  END IF;
  UPDATE ablage_ordner
     SET pfad = p_neu || substr(pfad, length(p_alt) + 1), updated_at = now()
   WHERE drive_id = p_drive_id AND left(pfad, length(p_alt) + 1) = p_alt || '/';
  GET DIAGNOSTICS c = ROW_COUNT;
  n := n + c;
  UPDATE ablage_eingang
     SET pfad = p_neu || substr(pfad, length(p_alt) + 1)
   WHERE drive_id = p_drive_id AND left(pfad, length(p_alt) + 1) = p_alt || '/';
  FOREACH t IN ARRAY ARRAY['kooperation_video_asset', 'kooperation_story_asset',
                           'kooperation_bilder_asset', 'kooperation_rohmaterial_asset',
                           'custom_column_assets']
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET file_path = $2 || substr(file_path, length($1) + 1)
        WHERE ablage = ''sharepoint'' AND drive_id = $3 AND left(file_path, length($1) + 1) = $1 || ''/''', t)
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  FOREACH s SLICE 1 IN ARRAY ARRAY[
    ['vertraege', 'datei_path', 'datei_ablage', 'datei_drive_id'],
    ['vertraege', 'dropbox_file_path', 'signiert_ablage', 'signiert_drive_id'],
    ['rechnung_pdfs', 'file_path', 'ablage', 'drive_id'],
    ['rechnung_belege', 'file_path', 'ablage', 'drive_id'],
    ['auftrag_dokumente', 'dropbox_file_path', 'ablage', 'drive_id']
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = $2 || substr(%2$I, length($1) + 1)
        WHERE %3$I = ''sharepoint'' AND %4$I = $3 AND left(%2$I, length($1) + 1) = $1 || ''/''', s[1], s[2], s[3], s[4])
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_pfad_umschreiben(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_pfad_umschreiben(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.ablage_url_umschreiben(p_drive_id text, p_alt text, p_neu text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  c integer;
  t text;
  paar text[];
  s text[];
BEGIN
  IF p_alt IS NULL OR p_neu IS NULL OR p_alt = '' OR p_alt = p_neu THEN
    RETURN 0;
  END IF;
  FOREACH t IN ARRAY ARRAY['kooperation_video_asset', 'kooperation_story_asset',
                           'kooperation_bilder_asset', 'kooperation_rohmaterial_asset',
                           'custom_column_assets']
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET file_url = $2 || substr(file_url, length($1) + 1)
        WHERE ablage = ''sharepoint'' AND drive_id = $3
          AND (file_url = $1 OR left(file_url, length($1) + 1) = $1 || ''/'')', t)
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  -- Ordner-Links tragen keine drive_id; der Präfix (Host + Site + Bibliothek) ist eindeutig
  FOREACH paar SLICE 1 IN ARRAY ARRAY[
    ['kooperation_rohmaterial_asset', 'folder_url'],
    ['kooperation_videos', 'folder_url'],
    ['kooperation_videos', 'story_folder_url'],
    ['kooperationen', 'bilder_folder_url'],
    ['custom_column_values', 'value']
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = $2 || substr(%2$I, length($1) + 1)
        WHERE %2$I = $1 OR left(%2$I, length($1) + 1) = $1 || ''/''', paar[1], paar[2])
      USING p_alt, p_neu;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  FOREACH s SLICE 1 IN ARRAY ARRAY[
    ['vertraege', 'datei_url', 'datei_ablage', 'datei_drive_id'],
    ['vertraege', 'dropbox_file_url', 'signiert_ablage', 'signiert_drive_id'],
    ['rechnung_pdfs', 'file_url', 'ablage', 'drive_id'],
    ['rechnung_belege', 'file_url', 'ablage', 'drive_id'],
    ['auftrag_dokumente', 'dropbox_file_url', 'ablage', 'drive_id']
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = $2 || substr(%2$I, length($1) + 1)
        WHERE %3$I = ''sharepoint'' AND %4$I = $3
          AND (%2$I = $1 OR left(%2$I, length($1) + 1) = $1 || ''/'')', s[1], s[2], s[3], s[4])
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_url_umschreiben(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_url_umschreiben(text, text, text) TO service_role;

-- ─── Creator-Upload ohne Staging ────────────────────────────
-- Der Code schreibt weder staging_key noch ablage; 20261229 droppt beide Spalten.

ALTER TABLE public.creator_upload_job
  ALTER COLUMN staging_key DROP NOT NULL,
  ALTER COLUMN ablage SET DEFAULT 'sharepoint';

COMMIT;
