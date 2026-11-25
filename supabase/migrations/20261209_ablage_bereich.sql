-- Medienablage: Bereichs-Ebene unter dem Unternehmen (ADR 0067).
-- Daten/<Firma>/Medien/<Marke>/<Kampagne>/... und Daten/<Firma>/Verträge. Ein Bereichsordner ist
-- ein Fachordner mit art = 'bereich' und genau einem Ordner je (Unternehmen, Bereich).
-- ablage_url_umschreiben zieht die webUrls nach, wenn das CRM einen Ordner verschiebt oder
-- umbenennt (Graph-webUrls sind pfadbasiert; ablage_pfad_umschreiben kennt nur file_path).
--
-- ROLLBACK (nur solange keine Zeile art = 'bereich' existiert):
--   DROP FUNCTION IF EXISTS public.ablage_url_umschreiben(text, text, text);
--   DROP INDEX IF EXISTS public.ux_ablage_ordner_bereich;
--   ALTER TABLE public.ablage_ordner DROP COLUMN bereich;
--   art-CHECK ohne 'bereich' wie in 20261201_medienablage.sql neu setzen.

BEGIN;

ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_art_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_art_check CHECK (art IN (
  'unternehmen', 'bereich', 'marke', 'kampagne', 'kooperation', 'typ', 'video', 'story',
  'schleife', 'finale', 'format', 'variante', 'frei', 'test', 'unzugeordnet'
));

ALTER TABLE public.ablage_ordner ADD COLUMN IF NOT EXISTS bereich text;
ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_bereich_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_bereich_check
  CHECK (bereich IN ('medien', 'vertraege'));
COMMENT ON COLUMN public.ablage_ordner.bereich IS
  'Bereich unter dem Unternehmen (medien, vertraege). Gesetzt am Bereichsordner; freie Ordner direkt darunter (und deren freie Unterordner) erben ihn.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_bereich
  ON public.ablage_ordner (drive_id, unternehmen_id, bereich) WHERE art = 'bereich' AND geloescht_at IS NULL;

-- webUrl-Präfix ersetzen: der Ordner selbst (gleich) und alles darunter (Präfix + '/').
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
BEGIN
  IF p_alt IS NULL OR p_neu IS NULL OR p_alt = '' OR p_alt = p_neu THEN
    RETURN 0;
  END IF;
  FOREACH t IN ARRAY ARRAY['kooperation_video_asset', 'kooperation_story_asset',
                           'kooperation_bilder_asset', 'kooperation_rohmaterial_asset']
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
    ['kooperationen', 'bilder_folder_url']
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = $2 || substr(%2$I, length($1) + 1)
        WHERE %2$I = $1 OR left(%2$I, length($1) + 1) = $1 || ''/''', paar[1], paar[2])
      USING p_alt, p_neu;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_url_umschreiben(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_url_umschreiben(text, text, text) TO service_role;

COMMIT;
