-- Fix: RLS Policy "Users can view their own permissions" auf user_permissions
-- Problem: auth.uid() wird pro Zeile neu ausgewertet → schlechte Performance bei vielen Rows
-- Lösung: (select auth.uid()) evaluiert einmal pro Query
-- Siehe: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

CREATE POLICY "Users can view their own permissions" ON public.user_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = (SELECT auth.uid())
        AND benutzer.id = user_permissions.user_id
    )
  );
