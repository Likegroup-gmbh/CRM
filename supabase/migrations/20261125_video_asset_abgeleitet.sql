-- is_current und link_content leitet die Datenbank ab, nicht mehr jeder Schreibpfad.
--
-- Beides ist eine Funktion der Asset-Zeilen eines Kooperationsvideos:
--   is_current   = Feedbackschleifen-Asset der hoechsten version_number (Finale nie)
--   link_content = file_url des neuesten Feedbackschleifen-Assets (version_number, dann created_at)
-- Bisher hielten sechs Pfade (Upload-Job, Upload-Drawer, Loesch-Sync, Creator-Upload,
-- Promote, Kooperationsdetail) das von Hand nach. Ein halber Job, zwei parallele Uploads
-- oder ein vergessener Pfad liessen die Werte driften (siehe 20260909_repair_asset_current.sql).
-- Der Trigger rechnet in derselben Transaktion wie die Asset-Zeile.
--
-- Parallele Uploads auf dasselbe Video serialisiert ein Zeilen-Lock auf kooperation_videos;
-- ohne ihn sieht jeder Upload nur seine eigene neue Zeile beim max() (Write Skew).
--
-- Deploy: erst diese Migration, dann der Client. Alte Bundles schreiben die Werte weiter
-- selbst, der Trigger korrigiert sie beim naechsten Asset-Schreibzugriff.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_kooperation_video_asset_abgeleitet ON public.kooperation_video_asset;
--   DROP FUNCTION IF EXISTS public.kooperation_video_asset_abgeleitet();
--   DROP FUNCTION IF EXISTS public.kooperation_video_abgeleitet_sync(uuid, boolean);
--   Danach muessen die Client-Pfade is_current/link_content wieder selbst schreiben.

BEGIN;

-- p_link: link_content mit ableiten. Nur wenn eine Feedbackschleifen-Zeile betroffen ist;
-- eine Finale allein darf den Content-Link (auch einen Altbestands-Link) nicht leeren.
CREATE OR REPLACE FUNCTION public.kooperation_video_abgeleitet_sync(p_video_id uuid, p_link boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top integer;
  v_link text;
BEGIN
  IF p_video_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM 1 FROM public.kooperation_videos WHERE id = p_video_id FOR UPDATE;

  SELECT max(version_number) INTO v_top
  FROM public.kooperation_video_asset
  WHERE video_id = p_video_id AND NOT is_final;

  UPDATE public.kooperation_video_asset
  SET is_current = coalesce(NOT is_final AND version_number = v_top, false)
  WHERE video_id = p_video_id
    AND is_current IS DISTINCT FROM coalesce(NOT is_final AND version_number = v_top, false);

  IF NOT p_link THEN
    RETURN;
  END IF;

  SELECT file_url INTO v_link
  FROM public.kooperation_video_asset
  WHERE video_id = p_video_id AND NOT is_final AND file_url IS NOT NULL
  ORDER BY version_number DESC, created_at DESC
  LIMIT 1;

  UPDATE public.kooperation_videos
  SET link_content = v_link
  WHERE id = p_video_id
    AND link_content IS DISTINCT FROM v_link;
END;
$$;

CREATE OR REPLACE FUNCTION public.kooperation_video_asset_abgeleitet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.kooperation_video_abgeleitet_sync(
      OLD.video_id,
      OLD.is_final IS FALSE
        OR (TG_OP = 'UPDATE' AND NEW.video_id IS NOT DISTINCT FROM OLD.video_id AND NEW.is_final IS FALSE));
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.video_id IS DISTINCT FROM OLD.video_id) THEN
    PERFORM public.kooperation_video_abgeleitet_sync(NEW.video_id, NEW.is_final IS FALSE);
  END IF;
  RETURN NULL;
END;
$$;

-- Nicht auf is_current: der Trigger schreibt die Spalte selbst und darf sich nicht ausloesen.
DROP TRIGGER IF EXISTS trg_kooperation_video_asset_abgeleitet ON public.kooperation_video_asset;
CREATE TRIGGER trg_kooperation_video_asset_abgeleitet
  AFTER INSERT OR DELETE OR UPDATE OF video_id, version_number, is_final, file_url, created_at
  ON public.kooperation_video_asset
  FOR EACH ROW EXECUTE FUNCTION public.kooperation_video_asset_abgeleitet();

REVOKE EXECUTE ON FUNCTION public.kooperation_video_abgeleitet_sync(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kooperation_video_asset_abgeleitet() FROM PUBLIC, anon, authenticated;

-- Bestand einmal abgleichen. Nur Videos mit Feedbackschleifen: Altbestand ohne Assets
-- behaelt seinen link_content.
SELECT public.kooperation_video_abgeleitet_sync(v.id)
FROM public.kooperation_videos v
WHERE EXISTS (
  SELECT 1 FROM public.kooperation_video_asset a
  WHERE a.video_id = v.id AND NOT a.is_final
);

COMMIT;
