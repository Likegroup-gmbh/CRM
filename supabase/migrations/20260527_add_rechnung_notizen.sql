-- Tabelle für Rückfrage-Notizen an Rechnungen (max. 1 pro Rechnung via UNIQUE constraint)
CREATE TABLE IF NOT EXISTS public.rechnung_notizen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rechnung_id UUID NOT NULL REFERENCES public.rechnung(id) ON DELETE CASCADE,
  notiz TEXT NOT NULL,
  erstellt_von UUID NOT NULL REFERENCES public.benutzer(id),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rechnung_id)
);

ALTER TABLE public.rechnung_notizen ENABLE ROW LEVEL SECURITY;

-- Interne User (admin, mitarbeiter) können Notizen lesen
CREATE POLICY "rechnung_notizen_select_internal"
  ON public.rechnung_notizen FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
      AND benutzer.rolle IN ('admin', 'mitarbeiter')
    )
  );

-- Interne User können Notizen erstellen
CREATE POLICY "rechnung_notizen_insert_internal"
  ON public.rechnung_notizen FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
      AND benutzer.rolle IN ('admin', 'mitarbeiter')
    )
  );

-- Nur Ersteller oder Admin können updaten
CREATE POLICY "rechnung_notizen_update_owner_admin"
  ON public.rechnung_notizen FOR UPDATE
  TO authenticated
  USING (
    erstellt_von = (SELECT id FROM public.benutzer WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
      AND benutzer.rolle = 'admin'
    )
  );

-- Nur Ersteller oder Admin können löschen
CREATE POLICY "rechnung_notizen_delete_owner_admin"
  ON public.rechnung_notizen FOR DELETE
  TO authenticated
  USING (
    erstellt_von = (SELECT id FROM public.benutzer WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
      AND benutzer.rolle = 'admin'
    )
  );
