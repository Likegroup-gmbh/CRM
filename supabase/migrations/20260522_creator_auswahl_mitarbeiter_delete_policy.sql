-- Alte Admin-only DELETE-Policy entfernen
DROP POLICY IF EXISTS creator_auswahl_admin_delete ON creator_auswahl;

-- Neue scoped DELETE-Policy: Admins alles, Mitarbeiter nur im Kampagnen-Scope
CREATE POLICY creator_auswahl_scoped_delete ON creator_auswahl
  FOR DELETE
  USING (
    is_admin()
    OR (
      EXISTS (
        SELECT 1 FROM benutzer b
        WHERE b.auth_user_id = auth.uid()
          AND b.rolle = 'mitarbeiter'
      )
      AND kampagne_id IS NOT NULL
      AND can_access_kampagne(kampagne_id, unternehmen_id, marke_id)
    )
  );
