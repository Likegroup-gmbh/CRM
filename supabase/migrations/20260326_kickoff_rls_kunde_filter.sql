DROP POLICY IF EXISTS "marke_kickoff_select" ON marke_kickoff;

CREATE POLICY "marke_kickoff_select" ON marke_kickoff FOR SELECT USING (
  -- Admin: alles
  (EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.auth_user_id = (SELECT auth.uid())
      AND benutzer.rolle = 'admin'
  ))
  OR
  -- Mitarbeiter: alles
  (EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.auth_user_id = (SELECT auth.uid())
      AND benutzer.rolle = 'mitarbeiter'
  ))
  OR
  -- Kunde: nur eigene Unternehmen (direkt oder ueber Marke)
  (EXISTS (
    SELECT 1 FROM kunde_unternehmen ku
    WHERE ku.kunde_id = (
      SELECT b.id FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid())
    )
    AND (
      ku.unternehmen_id = marke_kickoff.unternehmen_id
      OR ku.unternehmen_id = (
        SELECT m.unternehmen_id FROM marke m WHERE m.id = marke_kickoff.marke_id
      )
    )
  ))
);
