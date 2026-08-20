-- Skripte: Mitarbeiter-Scope serverseitig per RLS durchsetzen.
-- Bisher lief der Scope nur clientseitig (isSkriptInScope), RLS liess
-- Mitarbeiter alle Skripte lesen/aendern/loeschen.
--
-- Muster: can_mitarbeiter_access_rechnung (kampagne_mitarbeiter /
-- marke_mitarbeiter / mitarbeiter_unternehmen, hierarchisch Kampagne > Marke
-- > Unternehmen). Zusaetzlich eigene created_by (auth_user_id), damit ein
-- Mitarbeiter seinen frisch erzeugten Stub ohne Kontext nicht verliert.
--
-- Kunden-Block bleibt aus 20260819_kunde_briefing_skripte_select.sql.

CREATE OR REPLACE FUNCTION public.can_mitarbeiter_access_skript(
  p_unternehmen_id uuid,
  p_marke_id uuid,
  p_kampagne_id uuid,
  p_created_by uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT is_admin())
    OR p_created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM benutzer b
      WHERE b.auth_user_id = (SELECT auth.uid())
        AND b.rolle = 'mitarbeiter'
        AND (
          (p_kampagne_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM kampagne k
             WHERE k.id = p_kampagne_id
               AND (
                 EXISTS (SELECT 1 FROM kampagne_mitarbeiter km WHERE km.kampagne_id = k.id AND km.mitarbeiter_id = b.id)
                 OR EXISTS (SELECT 1 FROM marke_mitarbeiter mm WHERE mm.marke_id = k.marke_id AND mm.mitarbeiter_id = b.id)
                 OR EXISTS (SELECT 1 FROM mitarbeiter_unternehmen mu WHERE mu.unternehmen_id = k.unternehmen_id AND mu.mitarbeiter_id = b.id)
               )
          ))
          OR (p_kampagne_id IS NULL AND p_marke_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM marke_mitarbeiter mm WHERE mm.marke_id = p_marke_id AND mm.mitarbeiter_id = b.id)
            OR EXISTS (
              SELECT 1 FROM marke m
                JOIN mitarbeiter_unternehmen mu ON mu.unternehmen_id = m.unternehmen_id
               WHERE m.id = p_marke_id AND mu.mitarbeiter_id = b.id
            )
          ))
          OR (p_kampagne_id IS NULL AND p_marke_id IS NULL AND p_unternehmen_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM mitarbeiter_unternehmen mu WHERE mu.unternehmen_id = p_unternehmen_id AND mu.mitarbeiter_id = b.id
          ))
        )
    );
$$;

-- ============================================================
-- skripte: SELECT = Mitarbeiter-Scope ODER Kunden-Scope
-- ============================================================

DROP POLICY IF EXISTS skripte_select ON skripte;
CREATE POLICY skripte_select ON skripte
  FOR SELECT
  USING (
    (SELECT can_mitarbeiter_access_skript(unternehmen_id, marke_id, kampagne_id, created_by))
    OR (
      (SELECT get_current_user_rolle()) = ANY (ARRAY['kunde'::text, 'kunde_editor'::text])
      AND (
        EXISTS (
          SELECT 1 FROM kunde_unternehmen ku
           WHERE ku.unternehmen_id = skripte.unternehmen_id
             AND ku.kunde_id = (SELECT get_current_benutzer_id())
        )
        OR EXISTS (
          SELECT 1 FROM kunde_marke km
           WHERE km.marke_id = skripte.marke_id
             AND km.kunde_id = (SELECT get_current_benutzer_id())
        )
        OR EXISTS (
          SELECT 1 FROM marke m
            JOIN kunde_unternehmen ku ON ku.unternehmen_id = m.unternehmen_id
           WHERE m.id = skripte.marke_id
             AND ku.kunde_id = (SELECT get_current_benutzer_id())
        )
        OR EXISTS (
          SELECT 1 FROM kampagne k
           WHERE k.id = skripte.kampagne_id
             AND (
               EXISTS (
                 SELECT 1 FROM kunde_unternehmen ku
                  WHERE ku.unternehmen_id = k.unternehmen_id
                    AND ku.kunde_id = (SELECT get_current_benutzer_id())
               )
               OR EXISTS (
                 SELECT 1 FROM kunde_marke km
                  WHERE km.marke_id = k.marke_id
                    AND km.kunde_id = (SELECT get_current_benutzer_id())
               )
               OR EXISTS (
                 SELECT 1 FROM marke m
                   JOIN kunde_unternehmen ku ON ku.unternehmen_id = m.unternehmen_id
                  WHERE m.id = k.marke_id
                    AND ku.kunde_id = (SELECT get_current_benutzer_id())
               )
             )
        )
      )
    )
  );

-- ============================================================
-- skripte: UPDATE/DELETE nur noch im Mitarbeiter-Scope
-- ============================================================

DROP POLICY IF EXISTS skripte_update ON skripte;
CREATE POLICY skripte_update ON skripte
  FOR UPDATE
  USING ((SELECT can_mitarbeiter_access_skript(unternehmen_id, marke_id, kampagne_id, created_by)))
  WITH CHECK ((SELECT can_mitarbeiter_access_skript(unternehmen_id, marke_id, kampagne_id, created_by)));

DROP POLICY IF EXISTS skripte_delete ON skripte;
CREATE POLICY skripte_delete ON skripte
  FOR DELETE
  USING ((SELECT can_mitarbeiter_access_skript(unternehmen_id, marke_id, kampagne_id, created_by)));

-- ============================================================
-- Kindtabellen: an Parent-Sichtbarkeit koppeln statt pauschal staff-only
-- ============================================================

DROP POLICY IF EXISTS skript_versionen_select ON skript_versionen;
CREATE POLICY skript_versionen_select ON skript_versionen
  FOR SELECT
  USING (
    (SELECT is_admin())
    OR EXISTS (
      SELECT 1 FROM skripte s
       WHERE s.id = skript_versionen.skript_id
    )
  );

DROP POLICY IF EXISTS skript_versionen_update ON skript_versionen;
CREATE POLICY skript_versionen_update ON skript_versionen
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_versionen.skript_id))
  WITH CHECK (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_versionen.skript_id));

DROP POLICY IF EXISTS skript_versionen_delete ON skript_versionen;
CREATE POLICY skript_versionen_delete ON skript_versionen
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_versionen.skript_id));

DROP POLICY IF EXISTS skript_chat_messages_select ON skript_chat_messages;
CREATE POLICY skript_chat_messages_select ON skript_chat_messages
  FOR SELECT
  USING (
    (SELECT is_admin())
    OR EXISTS (
      SELECT 1 FROM skripte s
       WHERE s.id = skript_chat_messages.skript_id
    )
  );

DROP POLICY IF EXISTS skript_chat_messages_update ON skript_chat_messages;
CREATE POLICY skript_chat_messages_update ON skript_chat_messages
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_chat_messages.skript_id))
  WITH CHECK (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_chat_messages.skript_id));

DROP POLICY IF EXISTS skript_chat_messages_delete ON skript_chat_messages;
CREATE POLICY skript_chat_messages_delete ON skript_chat_messages
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_chat_messages.skript_id));

DROP POLICY IF EXISTS skript_feedback_select ON skript_feedback;
CREATE POLICY skript_feedback_select ON skript_feedback
  FOR SELECT
  USING (
    (SELECT is_admin())
    OR EXISTS (
      SELECT 1 FROM skripte s
       WHERE s.id = skript_feedback.skript_id
    )
  );

DROP POLICY IF EXISTS skript_feedback_update ON skript_feedback;
CREATE POLICY skript_feedback_update ON skript_feedback
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_feedback.skript_id))
  WITH CHECK (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_feedback.skript_id));

DROP POLICY IF EXISTS skript_feedback_delete ON skript_feedback;
CREATE POLICY skript_feedback_delete ON skript_feedback
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_feedback.skript_id));

DROP POLICY IF EXISTS skript_generation_jobs_select ON skript_generation_jobs;
CREATE POLICY skript_generation_jobs_select ON skript_generation_jobs
  FOR SELECT
  USING (
    (SELECT is_admin())
    OR EXISTS (
      SELECT 1 FROM skripte s
       WHERE s.id = skript_generation_jobs.skript_id
    )
  );

DROP POLICY IF EXISTS skript_generation_jobs_update ON skript_generation_jobs;
CREATE POLICY skript_generation_jobs_update ON skript_generation_jobs
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_generation_jobs.skript_id))
  WITH CHECK (EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_generation_jobs.skript_id));
