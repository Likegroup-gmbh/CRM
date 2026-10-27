-- Performance: rechnung-SELECT-Policy und Gast-Pruefung ohne Zeilenfunktionen.
--
-- Problem 1: rechnung_select_policy ruft can_mitarbeiter_access_rechnung(zeile)
--   (SECURITY DEFINER, SET search_path) pro Zeile auf, auch fuer Admin.
--   Auch (SELECT fn(zeile)) laeuft pro Zeile.
-- Problem 2: ~35 Policies (`*_no_gast`, marke_gast_scope, ...) rufen
--   current_role_is_gast() ungewrappt pro Zeile auf (auth.jwt()-Parsing je Zeile).
--
-- Loesung: unkorrelierte Mengen-Helfer in `private` (InitPlan / gehashter SubPlan)
-- und current_role_is_gast() in (SELECT ...) einwickeln (InitPlan, 1x pro Query).
-- Semantik unveraendert; Aequivalenz mit Rollback-Transaktion getestet.
--
-- ROLLBACK (Teil 1):
--   ALTER POLICY rechnung_select_policy ON public.rechnung USING (
--     (SELECT can_mitarbeiter_access_rechnung(unternehmen_id, kampagne_id, kooperation_id))
--     OR EXISTS (SELECT 1 FROM kunde_unternehmen ku
--                WHERE ku.kunde_id = (SELECT get_current_benutzer_id())
--                  AND ku.unternehmen_id = rechnung.unternehmen_id));
--   DROP FUNCTION private.rls_mit_kooperation_ids(); DROP FUNCTION private.rls_mit_kampagne_ids();
-- ROLLBACK (Teil 2): in den betroffenen Policies `(SELECT public.current_role_is_gast())`
--   wieder durch `current_role_is_gast()` ersetzen.

-- 1) Helfer: Kampagnen/Kooperationen, auf die der Mitarbeiter laut
--    can_mitarbeiter_access_rechnung Zugriff hat (nur rolle = 'mitarbeiter').
CREATE OR REPLACE FUNCTION private.rls_mit_kampagne_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $f$
  WITH me AS (
    SELECT b.id FROM public.benutzer b
    WHERE b.auth_user_id = auth.uid() AND b.rolle = 'mitarbeiter'
  )
  SELECT km.kampagne_id FROM public.kampagne_mitarbeiter km JOIN me ON me.id = km.mitarbeiter_id
  UNION
  SELECT k.id FROM public.kampagne k
    JOIN public.marke_mitarbeiter mm ON mm.marke_id = k.marke_id
    JOIN me ON me.id = mm.mitarbeiter_id
  UNION
  SELECT k.id FROM public.kampagne k
    JOIN public.mitarbeiter_unternehmen mu ON mu.unternehmen_id = k.unternehmen_id
    JOIN me ON me.id = mu.mitarbeiter_id
$f$;

CREATE OR REPLACE FUNCTION private.rls_mit_kooperation_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $f$
  SELECT koop.id FROM public.kooperationen koop
  WHERE koop.kampagne_id IN (SELECT private.rls_mit_kampagne_ids())
$f$;

REVOKE ALL ON FUNCTION private.rls_mit_kampagne_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.rls_mit_kooperation_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.rls_mit_kampagne_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.rls_mit_kooperation_ids() TO authenticated, anon;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

-- 2) rechnung_select_policy: Admin | eigene Unternehmen (Mitarbeiter + Kunde)
--    | Mitarbeiter-Kampagnen | Mitarbeiter-Kooperationen.
ALTER POLICY rechnung_select_policy ON public.rechnung USING (
  (SELECT public.is_admin())
  OR unternehmen_id = ANY ((SELECT private.rls_my_unternehmen_ids())::uuid[])
  OR kampagne_id IN (SELECT private.rls_mit_kampagne_ids())
  OR kooperation_id IN (SELECT private.rls_mit_kooperation_ids())
);

-- 3) current_role_is_gast() in allen Policies als InitPlan auswerten.
DO $do$
DECLARE
  r record;
  v_using text;
  v_check text;
  v_sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') ~ '(?<!SELECT )current_role_is_gast\(\)'
        OR coalesce(with_check, '') ~ '(?<!SELECT )current_role_is_gast\(\)')
  LOOP
    v_using := regexp_replace(r.qual, '(?<!SELECT )current_role_is_gast\(\)',
                              '(SELECT public.current_role_is_gast())', 'g');
    v_check := regexp_replace(r.with_check, '(?<!SELECT )current_role_is_gast\(\)',
                              '(SELECT public.current_role_is_gast())', 'g');
    v_sql := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF v_using IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_using);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END
$do$;
