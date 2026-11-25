-- Medienablage: alles in der Feedbackschleife (ADR 0065). Story_K liegt jetzt in jeder Runde
-- unter Videos/Video_N (Feedbackschleife_K bzw. Finale_Version), nicht mehr unter Storys/.
-- Das Gerüst gilt für einen Story-Slot erst als fertig, wenn sein Ordner in der Finalen Version
-- existiert (den legt geruest() als letzten an). Alte Storys/-Zeilen zählen nicht mehr.
--
-- ROLLBACK: Funktion aus 20261202_medienablage_creator_umzug.sql erneut einspielen.

BEGIN;

CREATE OR REPLACE FUNCTION public.ablage_geruest_offen(p_drive_id text, p_limit integer DEFAULT 5)
RETURNS TABLE (kooperation_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sp AS (
    SELECT k.id AS kooperation_id
    FROM kooperationen k
    JOIN kampagne ka ON ka.id = k.kampagne_id
    JOIN unternehmen u ON u.id = ka.unternehmen_id
    WHERE u.ablage_ziel = 'sharepoint'
  ),
  offen AS (
    SELECT v.kooperation_id, v.created_at
    FROM kooperation_videos v
    JOIN sp ON sp.kooperation_id = v.kooperation_id
    WHERE NOT EXISTS (
      SELECT 1 FROM ablage_ordner o
      WHERE o.drive_id = p_drive_id AND o.art = 'video' AND o.typ = 'videos'
        AND o.kooperation_video_id = v.id AND o.item_id IS NOT NULL AND o.geloescht_at IS NULL
    )
    UNION ALL
    SELECT v.kooperation_id, s.created_at
    FROM kooperation_story s
    JOIN kooperation_videos v ON v.id = s.video_id
    JOIN sp ON sp.kooperation_id = v.kooperation_id
    WHERE NOT EXISTS (
      SELECT 1 FROM ablage_ordner o
      WHERE o.drive_id = p_drive_id AND o.art = 'story' AND o.typ = 'videos' AND o.version_number IS NULL
        AND o.kooperation_video_id = v.id AND o.story_nummer = s.slot_index
        AND o.item_id IS NOT NULL AND o.geloescht_at IS NULL
    )
  )
  SELECT o.kooperation_id
  FROM offen o
  GROUP BY o.kooperation_id
  ORDER BY min(o.created_at)
  LIMIT p_limit
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_geruest_offen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_geruest_offen(text, integer) TO service_role;

COMMIT;
