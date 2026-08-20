-- Kunden: Briefings + Skripte SELECT im eigenen Scope
-- (kunde_unternehmen / kunde_marke, plus Kampagne bei Skripten).
-- INSERT/UPDATE/DELETE bleiben staff-only (bestehende Policies).

-- ============================================================
-- campaign_briefings: Firma / Marke des Kunden
-- ============================================================

DROP POLICY IF EXISTS campaign_briefings_select ON campaign_briefings;
CREATE POLICY campaign_briefings_select ON campaign_briefings
  FOR SELECT TO authenticated
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR (
      (SELECT get_current_user_rolle()) = ANY (ARRAY['kunde'::text, 'kunde_editor'::text])
      AND (
        EXISTS (
          SELECT 1 FROM kunde_unternehmen ku
           WHERE ku.unternehmen_id = campaign_briefings.unternehmen_id
             AND ku.kunde_id = (SELECT get_current_benutzer_id())
        )
        OR EXISTS (
          SELECT 1 FROM kunde_marke km
           WHERE km.marke_id = campaign_briefings.marke_id
             AND km.kunde_id = (SELECT get_current_benutzer_id())
        )
        OR EXISTS (
          SELECT 1 FROM marke m
            JOIN kunde_unternehmen ku ON ku.unternehmen_id = m.unternehmen_id
           WHERE m.id = campaign_briefings.marke_id
             AND ku.kunde_id = (SELECT get_current_benutzer_id())
        )
      )
    )
  );

-- ============================================================
-- skripte: Firma / Marke / Kampagne des Kunden
-- ============================================================

DROP POLICY IF EXISTS skripte_select ON skripte;
CREATE POLICY skripte_select ON skripte
  FOR SELECT
  USING (
    (SELECT is_admin_or_mitarbeiter())
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
-- skript_versionen: sichtbar wenn Parent-Skript sichtbar
-- ============================================================

DROP POLICY IF EXISTS skript_versionen_select ON skript_versionen;
CREATE POLICY skript_versionen_select ON skript_versionen
  FOR SELECT
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR EXISTS (
      SELECT 1 FROM skripte s
       WHERE s.id = skript_versionen.skript_id
    )
  );
