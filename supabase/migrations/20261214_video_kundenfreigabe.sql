-- Video-Freigabe durch den Kunden im Videos-Tab (ADR 0072).
-- Ein Klick der Kundenseite legt die Dateien der aktuellen Feedbackschleife als Finale Version
-- ab und setzt kooperation_videos.freigabe (Checkbox der Kooperationstabelle) in derselben
-- Transaktion. Kunden und Gäste dürfen keine Asset-Zeilen schreiben, deshalb SECURITY DEFINER.
-- Rechte wie beim Video-Kommentar: Team und Kunde über can_access_video_comment, Gast nur mit
-- Feedback-Recht (gast_can_access_video(..., true)).
--
-- Die Final-Zeilen sind Verweise auf die Quelle wie bei "Als finale Version freigeben"
-- (PromoteFinalAsset.js): gleiche Datei, version_number 1, is_final, source_asset_id.
-- Das Seitenverhältnis (slot) kommt vom Client aus den Pixelmaßen der Datei.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.freigeben_video_kunde(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.zuruecknehmen_video_kunde(uuid, uuid[], boolean);
--   DROP FUNCTION IF EXISTS private.video_freigabe_erlaubt(uuid);

BEGIN;

CREATE OR REPLACE FUNCTION private.video_freigabe_erlaubt(p_video_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT (SELECT public.can_access_video_comment(p_video_id)) IS TRUE
      OR (SELECT public.gast_can_access_video(p_video_id, true)) IS TRUE;
$$;

REVOKE ALL ON FUNCTION private.video_freigabe_erlaubt(uuid) FROM PUBLIC;

/**
 * p_finals: [{ "kind": "video"|"story"|"still", "source_id": uuid, "slot": "9:16"|"4:5"|"1:1" }]
 * Rückgabe: { freigabe_vorher, video: [...], story: [...], still: [...] } mit den neuen Zeilen.
 */
CREATE OR REPLACE FUNCTION public.freigeben_video_kunde(p_video_id uuid, p_finals jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_vorher boolean;
  v_top integer;
  v_user uuid;
  v_eintrag jsonb;
  v_kind text;
  v_source uuid;
  v_slot text;
  v_row jsonb;
  v_video jsonb := '[]'::jsonb;
  v_story jsonb := '[]'::jsonb;
  v_still jsonb := '[]'::jsonb;
BEGIN
  IF p_video_id IS NULL OR NOT private.video_freigabe_erlaubt(p_video_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, dieses Video freizugeben' USING ERRCODE = '42501';
  END IF;
  IF p_finals IS NULL OR jsonb_typeof(p_finals) <> 'array' OR jsonb_array_length(p_finals) = 0 THEN
    RAISE EXCEPTION 'Keine Dateien zum Freigeben' USING ERRCODE = '22023';
  END IF;

  -- Serialisiert parallele Freigaben und Uploads auf dasselbe Video (wie kooperation_video_abgeleitet_sync)
  SELECT v.freigabe INTO v_vorher FROM public.kooperation_videos v WHERE v.id = p_video_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  -- Aktuelle Feedbackschleife: höchste Runde über Videos, Stories und Bilder des Videos
  SELECT max(x.v) INTO v_top FROM (
    SELECT coalesce(a.version_number, 1) AS v FROM public.kooperation_video_asset a WHERE a.video_id = p_video_id AND NOT a.is_final
    UNION ALL
    SELECT coalesce(s.version_number, 1) FROM public.kooperation_story_asset s WHERE s.video_id = p_video_id AND NOT s.is_final
    UNION ALL
    SELECT b.version_number FROM public.kooperation_bilder_asset b WHERE b.video_id = p_video_id AND NOT b.is_final
  ) x;
  IF v_top IS NULL THEN
    RAISE EXCEPTION 'Keine Feedbackschleife vorhanden' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kooperation_video_asset f
    JOIN public.kooperation_video_asset q ON q.id = f.source_asset_id
    WHERE f.video_id = p_video_id AND f.is_final AND coalesce(q.version_number, 1) = v_top
  ) OR EXISTS (
    SELECT 1 FROM public.kooperation_story_asset f
    JOIN public.kooperation_story_asset q ON q.id = f.source_asset_id
    WHERE f.video_id = p_video_id AND f.is_final AND coalesce(q.version_number, 1) = v_top
  ) OR EXISTS (
    SELECT 1 FROM public.kooperation_bilder_asset f
    JOIN public.kooperation_bilder_asset q ON q.id = f.source_asset_id
    WHERE f.video_id = p_video_id AND f.is_final AND q.version_number = v_top
  ) THEN
    RAISE EXCEPTION 'Diese Feedbackschleife ist bereits freigegeben' USING HINT = 'bereits_freigegeben';
  END IF;

  v_user := (SELECT public.get_current_benutzer_id());

  FOR v_eintrag IN SELECT * FROM jsonb_array_elements(p_finals) LOOP
    v_kind := v_eintrag->>'kind';
    v_source := nullif(v_eintrag->>'source_id', '')::uuid;
    v_slot := v_eintrag->>'slot';
    v_row := NULL;

    IF v_kind IN ('video', 'story') AND (v_slot IS NULL OR v_slot NOT IN ('9:16', '4:5', '1:1')) THEN
      RAISE EXCEPTION 'Unbekanntes Seitenverhältnis: %', coalesce(v_slot, '(leer)') USING ERRCODE = '22023';
    END IF;

    IF v_kind = 'video' THEN
      INSERT INTO public.kooperation_video_asset (
        video_id, file_url, file_path, file_name, file_size, version_number, variant_name, titel,
        is_current, is_final, source_asset_id, description,
        ablage, drive_id, item_id, etag, ctag, breite, hoehe, uploaded_by, created_at
      )
      SELECT q.video_id, q.file_url, q.file_path, q.file_name, q.file_size, 1, v_slot, q.titel,
        false, true, q.id, q.description,
        q.ablage, q.drive_id, q.item_id, q.etag, q.ctag, q.breite, q.hoehe, v_user, now()
      FROM public.kooperation_video_asset q
      WHERE q.id = v_source AND q.video_id = p_video_id AND NOT q.is_final
        AND coalesce(q.version_number, 1) = v_top
      RETURNING to_jsonb(kooperation_video_asset) INTO v_row;
      IF v_row IS NOT NULL THEN v_video := v_video || jsonb_build_array(v_row); END IF;

    ELSIF v_kind = 'story' THEN
      INSERT INTO public.kooperation_story_asset (
        story_id, video_id, file_url, file_path, file_name, file_size, version_number, variant_name, titel,
        is_current, is_final, source_asset_id,
        ablage, drive_id, item_id, etag, ctag, breite, hoehe, uploaded_by, created_at
      )
      SELECT q.story_id, q.video_id, q.file_url, q.file_path, q.file_name, q.file_size, 1, v_slot, q.titel,
        false, true, q.id,
        q.ablage, q.drive_id, q.item_id, q.etag, q.ctag, q.breite, q.hoehe, v_user, now()
      FROM public.kooperation_story_asset q
      WHERE q.id = v_source AND q.video_id = p_video_id AND NOT q.is_final
        AND coalesce(q.version_number, 1) = v_top
      RETURNING to_jsonb(kooperation_story_asset) INTO v_row;
      IF v_row IS NOT NULL THEN v_story := v_story || jsonb_build_array(v_row); END IF;

    ELSIF v_kind = 'still' THEN
      INSERT INTO public.kooperation_bilder_asset (
        kooperation_id, video_id, file_url, file_path, file_name, file_size, version_number, variant_name, titel,
        is_current, is_final, source_asset_id,
        ablage, drive_id, item_id, etag, ctag, breite, hoehe, uploaded_by, created_at
      )
      SELECT q.kooperation_id, q.video_id, q.file_url, q.file_path, q.file_name, q.file_size, 1, 'Still', q.titel,
        false, true, q.id,
        q.ablage, q.drive_id, q.item_id, q.etag, q.ctag, q.breite, q.hoehe, v_user, now()
      FROM public.kooperation_bilder_asset q
      WHERE q.id = v_source AND q.video_id = p_video_id AND NOT q.is_final
        AND q.version_number = v_top
      RETURNING to_jsonb(kooperation_bilder_asset) INTO v_row;
      IF v_row IS NOT NULL THEN v_still := v_still || jsonb_build_array(v_row); END IF;

    ELSE
      RAISE EXCEPTION 'Unbekannte Dateiart: %', coalesce(v_kind, '(leer)') USING ERRCODE = '22023';
    END IF;

    IF v_row IS NULL THEN
      RAISE EXCEPTION 'Datei % gehört nicht zur aktuellen Feedbackschleife', v_source USING ERRCODE = '22023';
    END IF;
  END LOOP;

  UPDATE public.kooperation_videos SET freigabe = true WHERE id = p_video_id AND freigabe IS DISTINCT FROM true;

  RETURN jsonb_build_object(
    'freigabe_vorher', coalesce(v_vorher, false),
    'video', v_video,
    'story', v_story,
    'still', v_still
  );
END;
$$;

/**
 * "Rückgängig" direkt nach der Freigabe: löscht nur die eben angelegten Verweise (Final mit Quelle,
 * jünger als 2 Minuten, vom selben Aufrufer) und stellt das Flag auf den Wert vor der Freigabe zurück.
 * Danach nimmt nur das Team eine Finale Version zurück.
 */
CREATE OR REPLACE FUNCTION public.zuruecknehmen_video_kunde(p_video_id uuid, p_ids uuid[], p_freigabe boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_frist timestamptz := now() - interval '2 minutes';
  v_user uuid := (SELECT public.get_current_benutzer_id());
  v_anzahl integer := 0;
  v_teil integer;
BEGIN
  IF p_video_id IS NULL OR NOT private.video_freigabe_erlaubt(p_video_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, diese Freigabe zurückzunehmen' USING ERRCODE = '42501';
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN;
  END IF;

  PERFORM 1 FROM public.kooperation_videos v WHERE v.id = p_video_id FOR UPDATE;

  DELETE FROM public.kooperation_video_asset
  WHERE id = ANY (p_ids) AND video_id = p_video_id AND is_final AND source_asset_id IS NOT NULL AND created_at >= v_frist
    AND uploaded_by IS NOT DISTINCT FROM v_user;
  GET DIAGNOSTICS v_teil = ROW_COUNT;
  v_anzahl := v_anzahl + v_teil;

  DELETE FROM public.kooperation_story_asset
  WHERE id = ANY (p_ids) AND video_id = p_video_id AND is_final AND source_asset_id IS NOT NULL AND created_at >= v_frist
    AND uploaded_by IS NOT DISTINCT FROM v_user;
  GET DIAGNOSTICS v_teil = ROW_COUNT;
  v_anzahl := v_anzahl + v_teil;

  DELETE FROM public.kooperation_bilder_asset
  WHERE id = ANY (p_ids) AND video_id = p_video_id AND is_final AND source_asset_id IS NOT NULL AND created_at >= v_frist
    AND uploaded_by IS NOT DISTINCT FROM v_user;
  GET DIAGNOSTICS v_teil = ROW_COUNT;
  v_anzahl := v_anzahl + v_teil;

  IF v_anzahl = 0 THEN
    RAISE EXCEPTION 'Die Freigabe lässt sich nicht mehr zurücknehmen' USING ERRCODE = '22023';
  END IF;

  UPDATE public.kooperation_videos SET freigabe = coalesce(p_freigabe, false) WHERE id = p_video_id;
END;
$$;

REVOKE ALL ON FUNCTION public.freigeben_video_kunde(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.zuruecknehmen_video_kunde(uuid, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freigeben_video_kunde(uuid, jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zuruecknehmen_video_kunde(uuid, uuid[], boolean) TO authenticated, anon;

COMMIT;
