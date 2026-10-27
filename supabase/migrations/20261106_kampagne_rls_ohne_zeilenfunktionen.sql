-- Performance: RLS auf kampagne ohne Funktionsaufruf pro Zeile.
--
-- Problem: kampagne_select_policy und testunternehmen_hide riefen pro Zeile die
-- SECURITY-DEFINER-Funktionen can_access_kampagne() bzw. testunternehmen_ok() auf.
-- Die Argumente hängen an der Zeile, deshalb läuft auch das umhüllende (SELECT ...)
-- pro Zeile und nicht als InitPlan. Jede Funktion hat ein SET search_path (kein Inlining).
-- Gemessen als Mitarbeiter: get_kampagnen_list ~219 ms/Aufruf (ohne RLS: ~72 ms).
--
-- Lösung: Pro Statement einmal die Menge der erlaubten IDs holen (uncorrelated InitPlan)
-- und pro Zeile nur noch `= ANY(array)` prüfen. Semantik identisch zu
-- can_access_kampagne()/testunternehmen_ok():
--   Admin                          -> alles
--   Mitarbeiter (benutzer.rolle)   -> kampagne_mitarbeiter / marke_mitarbeiter / mitarbeiter_unternehmen
--   Kunde                          -> kunde_unternehmen
--   Testunternehmen                -> nur für Admins sichtbar
--
-- Hardening: Helfer liegen im Schema private (nicht per PostgREST-RPC erreichbar),
-- search_path ist leer, alle Objekte sind vollqualifiziert.
-- anon braucht USAGE + EXECUTE, weil Policies mit Rolle public auch für anonyme Requests
-- ausgewertet werden; für anon liefern die Helfer leere Arrays (auth.uid() ist NULL).
--
-- can_access_kampagne() und testunternehmen_ok() bleiben bestehen (andere Policies nutzen sie noch).
--
-- Rollback:
--   ALTER POLICY kampagne_select_policy ON public.kampagne
--     USING ((SELECT public.can_access_kampagne(kampagne.id, kampagne.unternehmen_id, kampagne.marke_id)));
--   ALTER POLICY testunternehmen_hide ON public.kampagne
--     USING ((SELECT public.testunternehmen_ok(kampagne.unternehmen_id)));

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

CREATE OR REPLACE FUNCTION private.rls_test_unternehmen_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT COALESCE(array_agg(u.id), '{}'::uuid[]) FROM public.unternehmen u WHERE u.ist_test;
$$;

CREATE OR REPLACE FUNCTION private.rls_my_unternehmen_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT COALESCE(array_agg(s.x), '{}'::uuid[])
  FROM (
    SELECT mu.unternehmen_id AS x
    FROM public.mitarbeiter_unternehmen mu
    JOIN public.benutzer b ON b.id = mu.mitarbeiter_id
    WHERE b.auth_user_id = auth.uid() AND b.rolle = 'mitarbeiter'
    UNION
    SELECT ku.unternehmen_id
    FROM public.kunde_unternehmen ku
    WHERE ku.kunde_id = public.get_current_benutzer_id()
  ) s;
$$;

CREATE OR REPLACE FUNCTION private.rls_my_marke_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT COALESCE(array_agg(mm.marke_id), '{}'::uuid[])
  FROM public.marke_mitarbeiter mm
  JOIN public.benutzer b ON b.id = mm.mitarbeiter_id
  WHERE b.auth_user_id = auth.uid() AND b.rolle = 'mitarbeiter';
$$;

CREATE OR REPLACE FUNCTION private.rls_my_kampagne_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT COALESCE(array_agg(km.kampagne_id), '{}'::uuid[])
  FROM public.kampagne_mitarbeiter km
  JOIN public.benutzer b ON b.id = km.mitarbeiter_id
  WHERE b.auth_user_id = auth.uid() AND b.rolle = 'mitarbeiter';
$$;

REVOKE ALL ON FUNCTION private.rls_test_unternehmen_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.rls_my_unternehmen_ids()   FROM PUBLIC;
REVOKE ALL ON FUNCTION private.rls_my_marke_ids()         FROM PUBLIC;
REVOKE ALL ON FUNCTION private.rls_my_kampagne_ids()      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.rls_test_unternehmen_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.rls_my_unternehmen_ids()   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.rls_my_marke_ids()         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.rls_my_kampagne_ids()      TO authenticated, anon;

ALTER POLICY kampagne_select_policy ON public.kampagne
  USING (
    (SELECT public.is_admin())
    OR unternehmen_id = ANY ((SELECT private.rls_my_unternehmen_ids())::uuid[])
    OR marke_id       = ANY ((SELECT private.rls_my_marke_ids())::uuid[])
    OR id             = ANY ((SELECT private.rls_my_kampagne_ids())::uuid[])
  );

ALTER POLICY testunternehmen_hide ON public.kampagne
  USING (
    (SELECT public.is_admin())
    OR unternehmen_id IS NULL
    OR NOT (unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]))
  );
