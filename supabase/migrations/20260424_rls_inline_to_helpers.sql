-- Migration: Verbleibende Inline-benutzer-Lookups durch SECURITY DEFINER Helper ersetzen
-- Eliminiert rekursive RLS-Checks auf benutzer-Tabelle
-- Betroffene Tabellen: feedback_comments, feedback_votes, kooperation_tasks,
--                      rechnung_belege, kooperation_video_asset

BEGIN;

-- ============================================================
-- 1. feedback_comments: author_id-Vergleich → get_current_benutzer_id()
-- ============================================================

DROP POLICY IF EXISTS feedback_comments_delete ON public.feedback_comments;
CREATE POLICY feedback_comments_delete ON public.feedback_comments
  FOR DELETE TO authenticated
  USING (author_id = (SELECT get_current_benutzer_id()));

DROP POLICY IF EXISTS feedback_comments_update ON public.feedback_comments;
CREATE POLICY feedback_comments_update ON public.feedback_comments
  FOR UPDATE TO authenticated
  USING (author_id = (SELECT get_current_benutzer_id()))
  WITH CHECK (author_id = (SELECT get_current_benutzer_id()));

-- ============================================================
-- 2. feedback_votes: user_id-Vergleich → get_current_benutzer_id()
-- ============================================================

DROP POLICY IF EXISTS feedback_votes_delete ON public.feedback_votes;
CREATE POLICY feedback_votes_delete ON public.feedback_votes
  FOR DELETE TO public
  USING (user_id = (SELECT get_current_benutzer_id()));

DROP POLICY IF EXISTS feedback_votes_insert ON public.feedback_votes;
CREATE POLICY feedback_votes_insert ON public.feedback_votes
  FOR INSERT TO public
  WITH CHECK (user_id = (SELECT get_current_benutzer_id()));

DROP POLICY IF EXISTS feedback_votes_update ON public.feedback_votes;
CREATE POLICY feedback_votes_update ON public.feedback_votes
  FOR UPDATE TO public
  USING (user_id = (SELECT get_current_benutzer_id()))
  WITH CHECK (user_id = (SELECT get_current_benutzer_id()));

-- ============================================================
-- 3. kooperation_tasks: Inline EXISTS + benutzer.id → is_admin() + get_current_benutzer_id()
-- ============================================================

DROP POLICY IF EXISTS tasks_delete_policy ON public.kooperation_tasks;
CREATE POLICY tasks_delete_policy ON public.kooperation_tasks
  FOR DELETE TO public
  USING (
    (SELECT is_admin())
    OR created_by = (SELECT get_current_benutzer_id())
  );

DROP POLICY IF EXISTS tasks_insert_policy ON public.kooperation_tasks;
CREATE POLICY tasks_insert_policy ON public.kooperation_tasks
  FOR INSERT TO public
  WITH CHECK (
    (SELECT is_admin())
    OR user_can_access_task_entity(entity_type::text, entity_id, (SELECT get_current_benutzer_id()))
  );

-- ============================================================
-- 4. rechnung_belege: EXISTS + benutzer JOIN → get_current_benutzer_id()
-- ============================================================

DROP POLICY IF EXISTS rechnung_belege_delete_owner ON public.rechnung_belege;
CREATE POLICY rechnung_belege_delete_owner ON public.rechnung_belege
  FOR DELETE TO public
  USING (uploaded_by = (SELECT get_current_benutzer_id()));

-- ============================================================
-- 5. kooperation_video_asset SELECT: benutzer-JOIN aus Kunde-Branches entfernen
--    Vorher: 5-Tabellen-JOIN-Ketten mit benutzer am Ende
--    Nachher: 4-Tabellen-JOIN + get_current_benutzer_id() (eine JOIN-Stufe weniger)
-- ============================================================

DROP POLICY IF EXISTS kooperation_video_asset_select ON public.kooperation_video_asset;
CREATE POLICY kooperation_video_asset_select ON public.kooperation_video_asset
  FOR SELECT TO public
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR EXISTS (
      SELECT 1
      FROM kooperation_videos kv
        JOIN kooperationen k ON k.id = kv.kooperation_id
        JOIN kampagne ka ON ka.id = k.kampagne_id
        JOIN marke m ON m.id = ka.marke_id
        JOIN kunde_marke km ON km.marke_id = m.id
      WHERE kv.id = kooperation_video_asset.video_id
        AND km.kunde_id = (SELECT get_current_benutzer_id())
    )
    OR EXISTS (
      SELECT 1
      FROM kooperation_videos kv
        JOIN kooperationen k ON k.id = kv.kooperation_id
        JOIN kampagne ka ON ka.id = k.kampagne_id
        JOIN kunde_unternehmen ku ON ku.unternehmen_id = ka.unternehmen_id
      WHERE kv.id = kooperation_video_asset.video_id
        AND ku.kunde_id = (SELECT get_current_benutzer_id())
    )
  );

COMMIT;
