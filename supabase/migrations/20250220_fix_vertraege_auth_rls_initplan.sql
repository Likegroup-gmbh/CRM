-- Fix: auth_rls_initplan bei vertraege_insert
-- auth.role() pro Zeile ausgewertet → (SELECT auth.role()) einmal pro Query

DROP POLICY IF EXISTS vertraege_insert ON public.vertraege;

CREATE POLICY vertraege_insert ON public.vertraege
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'authenticated');
