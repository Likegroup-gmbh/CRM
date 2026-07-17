-- Fix: RLS Policy "Mitarbeiter haben vollen Zugriff auf Videos" auf kooperation_videos
-- Problem: auth.uid() wird pro Zeile neu ausgewertet → schlechte Performance
-- Lösung: (select auth.uid()) evaluiert einmal pro Query

DROP POLICY IF EXISTS "Mitarbeiter haben vollen Zugriff auf Videos" ON public.kooperation_videos;

CREATE POLICY "Mitarbeiter haben vollen Zugriff auf Videos" ON public.kooperation_videos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = (SELECT auth.uid())
        AND benutzer.rolle IN ('admin', 'mitarbeiter')
    )
  );
