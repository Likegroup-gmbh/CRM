-- RLS auf kooperation_video_comment: inline 6-Table-Joins durch SECURITY DEFINER
-- Helper ersetzen. Die Joins liefen unter RLS der Zieltabellen (videos,
-- kooperationen, kampagne, marke, kunde_*, benutzer) und haben Kunden-Upserts
-- gegen das 8s-Statement-Timeout von authenticated getrieben — Write war oft
-- schon committed, die UI zeigte trotzdem "Nicht gespeichert".
--
-- Semantik unveraendert: alle Staff plus Kunde ueber Marke oder Unternehmen.
-- Gast-Policies bleiben (gast_can_access_video).

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_video_comment(p_video_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT is_admin_or_mitarbeiter())
    OR EXISTS (
      SELECT 1
      FROM kooperation_videos v
      JOIN kooperationen k ON k.id = v.kooperation_id
      JOIN kampagne ka ON ka.id = k.kampagne_id
      JOIN kunde_marke km ON km.marke_id = ka.marke_id
      WHERE v.id = p_video_id
        AND km.kunde_id = (SELECT get_current_benutzer_id())
    )
    OR EXISTS (
      SELECT 1
      FROM kooperation_videos v
      JOIN kooperationen k ON k.id = v.kooperation_id
      JOIN kampagne ka ON ka.id = k.kampagne_id
      JOIN kunde_unternehmen ku ON ku.unternehmen_id = ka.unternehmen_id
      WHERE v.id = p_video_id
        AND ku.kunde_id = (SELECT get_current_benutzer_id())
    );
$$;

COMMENT ON FUNCTION public.can_access_video_comment(uuid) IS
  'Darf der aktuelle Benutzer Video-Feedback dieser Video-ID sehen/schreiben? '
  'SECURITY DEFINER, damit die Funktion in RLS-Policies ohne Re-Entry auf die '
  'Join-Tabellen verwendet werden kann.';

DROP POLICY IF EXISTS kooperation_video_comment_select ON public.kooperation_video_comment;
CREATE POLICY kooperation_video_comment_select ON public.kooperation_video_comment
  FOR SELECT
  USING ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_video_comment_insert ON public.kooperation_video_comment;
CREATE POLICY kooperation_video_comment_insert ON public.kooperation_video_comment
  FOR INSERT
  WITH CHECK ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_video_comment_update ON public.kooperation_video_comment;
CREATE POLICY kooperation_video_comment_update ON public.kooperation_video_comment
  FOR UPDATE
  USING ((SELECT can_access_video_comment(video_id)))
  WITH CHECK ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_video_comment_delete ON public.kooperation_video_comment;
CREATE POLICY kooperation_video_comment_delete ON public.kooperation_video_comment
  FOR DELETE
  USING ((SELECT can_access_video_comment(video_id)));

COMMIT;
