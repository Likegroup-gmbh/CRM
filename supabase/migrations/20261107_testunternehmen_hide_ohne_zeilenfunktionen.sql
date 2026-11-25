-- Performance: testunternehmen_hide-Policies (RESTRICTIVE, ~85 Tabellen) ohne Funktionsaufruf pro Zeile.
--
-- Vorher: ( SELECT testunternehmen_ok[_xyz](tabelle.spalte) ) -> SECURITY-DEFINER-Funktion pro Zeile
-- (das umhüllende SELECT hilft nicht, weil das Argument an der Zeile hängt).
-- Nachher: Pro Statement einmal die (kleine) Menge der Test-IDs je Entitätstyp holen
-- und pro Zeile nur `spalte = ANY(array)` prüfen. Admins kürzen über is_admin() (InitPlan) ab.
--
-- Semantik unverändert (siehe testunternehmen_ok*): sichtbar ist eine Zeile, wenn
--   Admin ODER Spalte IS NULL ODER das zugehörige Unternehmen kein Testunternehmen ist.
-- Der Entitätstyp bestimmt, wie die ID auf das Unternehmen abgebildet wird:
--   (leer) unternehmen | marke | auftrag | briefing(campaign_briefings) | casting(creator_auswahl)
--   persona(personas) | produkt | skript(skripte) | strategie
--   kampagne      -> COALESCE(kampagne.unternehmen_id, auftrag.unternehmen_id)
--   kooperation   -> kooperationen.kampagne_id -> kampagne
--   video         -> kooperation_videos.kooperation_id -> kooperation
--   entity        -> (entity_type, entity_id) -> je nach Typ eines der obigen (3 Tabellen, unten explizit)
--
-- Rollback pro Tabelle:
--   ALTER POLICY testunternehmen_hide ON public.<tabelle>
--     USING ((SELECT public.testunternehmen_ok_<typ>(<tabelle>.<spalte>)));

-- Helfer: Mengen der Test-IDs (ohne Test-Unternehmen sind alle Arrays leer)

CREATE OR REPLACE FUNCTION private.rls_test_marke_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.marke x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_auftrag_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.auftrag x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_briefing_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.campaign_briefings x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_casting_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.creator_auswahl x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_persona_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.personas x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_produkt_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.produkt x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_skript_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.skripte x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_strategie_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.strategie x
      WHERE x.unternehmen_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_kampagne_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(k.id), '{}'::uuid[])
      FROM public.kampagne k
      LEFT JOIN public.auftrag a ON a.id = k.auftrag_id
      WHERE COALESCE(k.unternehmen_id, a.unternehmen_id) = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_kooperation_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.kooperationen x
      WHERE x.kampagne_id = ANY ((SELECT private.rls_test_kampagne_ids())::uuid[]); $$;

CREATE OR REPLACE FUNCTION private.rls_test_video_ids() RETURNS uuid[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(array_agg(x.id), '{}'::uuid[]) FROM public.kooperation_videos x
      WHERE x.kooperation_id = ANY ((SELECT private.rls_test_kooperation_ids())::uuid[]); $$;

DO $grant$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'marke','auftrag','briefing','casting','persona','produkt','skript','strategie','kampagne','kooperation','video'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION private.rls_test_%s_ids() FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION private.rls_test_%s_ids() TO authenticated, anon', f);
  END LOOP;
END
$grant$;

-- Policies umstellen: Typ und Spalte werden aus der bestehenden Policy gelesen.
DO $mig$
DECLARE
  r record;
  m text[];
  kind text;
  n_alt int := 0;
  n_skip int := 0;
BEGIN
  FOR r IN
    SELECT tablename, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'testunternehmen_hide'
      AND qual LIKE '%testunternehmen_ok%'
      AND tablename <> 'kampagne'            -- in 20261106 bereits umgestellt
    ORDER BY tablename
  LOOP
    m := regexp_match(r.qual, 'testunternehmen_ok(?:_([a-z]+))?\((\w+)\.(\w+)\)');
    IF m IS NULL THEN
      n_skip := n_skip + 1;
      RAISE NOTICE 'uebersprungen (Sonderfall): %', r.tablename;
      CONTINUE;
    END IF;
    kind := COALESCE(m[1], 'unternehmen');
    IF to_regprocedure(format('private.rls_test_%s_ids()', kind)) IS NULL THEN
      RAISE EXCEPTION 'Helfer private.rls_test_%_ids() fehlt (Tabelle %)', kind, r.tablename;
    END IF;
    EXECUTE format(
      'ALTER POLICY testunternehmen_hide ON public.%I USING ((SELECT public.is_admin()) OR %I IS NULL OR NOT (%I = ANY ((SELECT private.rls_test_%s_ids())::uuid[])))',
      r.tablename, m[3], m[3], kind
    );
    n_alt := n_alt + 1;
  END LOOP;
  RAISE NOTICE 'testunternehmen_hide umgestellt: %, uebersprungen: %', n_alt, n_skip;
END
$mig$;

-- Sonderfall: Policies auf (entity_type, entity_id) - 3 Tabellen, Typ-Mapping wie testunternehmen_ok_entity().
-- Unbekannte Typen (z. B. 'video') waren schon vorher immer sichtbar (ELSE true).
DO $entity$
DECLARE
  t text;
  expr text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_entity_assignments','entity_dokumente','list_shares'] LOOP
    expr := format($f$(SELECT public.is_admin()) OR NOT COALESCE(
      CASE lower(COALESCE(entity_type::text, ''))
        WHEN 'unternehmen'         THEN entity_id = ANY ((SELECT private.rls_test_unternehmen_ids())::uuid[])
        WHEN 'marke'               THEN entity_id = ANY ((SELECT private.rls_test_marke_ids())::uuid[])
        WHEN 'auftrag'             THEN entity_id = ANY ((SELECT private.rls_test_auftrag_ids())::uuid[])
        WHEN 'kampagne'            THEN entity_id = ANY ((SELECT private.rls_test_kampagne_ids())::uuid[])
        WHEN 'kooperation'         THEN entity_id = ANY ((SELECT private.rls_test_kooperation_ids())::uuid[])
        WHEN 'kooperationen'       THEN entity_id = ANY ((SELECT private.rls_test_kooperation_ids())::uuid[])
        WHEN 'creator_auswahl'     THEN entity_id = ANY ((SELECT private.rls_test_casting_ids())::uuid[])
        WHEN 'casting'             THEN entity_id = ANY ((SELECT private.rls_test_casting_ids())::uuid[])
        WHEN 'strategie'           THEN entity_id = ANY ((SELECT private.rls_test_strategie_ids())::uuid[])
        WHEN 'skript'              THEN entity_id = ANY ((SELECT private.rls_test_skript_ids())::uuid[])
        WHEN 'skripte'             THEN entity_id = ANY ((SELECT private.rls_test_skript_ids())::uuid[])
        WHEN 'produkt'             THEN entity_id = ANY ((SELECT private.rls_test_produkt_ids())::uuid[])
        WHEN 'persona'             THEN entity_id = ANY ((SELECT private.rls_test_persona_ids())::uuid[])
        WHEN 'personas'            THEN entity_id = ANY ((SELECT private.rls_test_persona_ids())::uuid[])
        WHEN 'briefing'            THEN entity_id = ANY ((SELECT private.rls_test_briefing_ids())::uuid[])
        WHEN 'campaign_briefings'  THEN entity_id = ANY ((SELECT private.rls_test_briefing_ids())::uuid[])
        ELSE false
      END, false)$f$);
    EXECUTE format('ALTER POLICY testunternehmen_hide ON public.%I USING (%s)', t, expr);
  END LOOP;
END
$entity$;
