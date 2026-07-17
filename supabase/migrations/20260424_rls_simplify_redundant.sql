-- Migration: Redundante auth.role()-Checks vereinfachen und Duplikat-Policy entfernen
-- kampagne_mitarbeiter/marke_mitarbeiter: TO authenticated + USING(auth.role()='authenticated') ist doppelt
-- magic_links: "Authenticated kann Magic Link verwenden" ist Subset von magic_links_update

BEGIN;

-- ============================================================
-- 1. kampagne_mitarbeiter: auth.role()-Check entfernen (redundant mit TO authenticated)
-- ============================================================

DROP POLICY IF EXISTS kampagne_mitarbeiter_select ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_select ON public.kampagne_mitarbeiter
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS kampagne_mitarbeiter_insert ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_insert ON public.kampagne_mitarbeiter
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS kampagne_mitarbeiter_update ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_update ON public.kampagne_mitarbeiter
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS kampagne_mitarbeiter_delete ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_delete ON public.kampagne_mitarbeiter
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. marke_mitarbeiter: DELETE/INSERT/UPDATE → USING(true)
--    SELECT: alle 3 Branches (auth.role(), is_admin, eigene ID) erfordern
--    authenticated → TO authenticated USING(true) ist aequivalent
-- ============================================================

DROP POLICY IF EXISTS marke_mitarbeiter_select ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_select ON public.marke_mitarbeiter
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS marke_mitarbeiter_insert ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_insert ON public.marke_mitarbeiter
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS marke_mitarbeiter_update ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_update ON public.marke_mitarbeiter
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS marke_mitarbeiter_delete ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_delete ON public.marke_mitarbeiter
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. magic_links: Redundante Update-Policy entfernen
--    "Authenticated kann Magic Link verwenden" (TO authenticated) ist komplett
--    abgedeckt durch magic_links_update (TO public) mit gleichen Bedingungen
-- ============================================================

DROP POLICY IF EXISTS "Authenticated kann Magic Link verwenden" ON public.magic_links;

COMMIT;
