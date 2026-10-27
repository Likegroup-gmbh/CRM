-- Signup-Rollen nicht mehr aus dem Browser.
--
-- Problem: handle_new_auth_user uebernahm raw_user_meta_data->>'role' (frei vom Client
-- setzbar). Wer sich mit role = 'admin' / 'investor' / 'agent' registrierte, bekam diese
-- Rolle, und is_admin() ignorierte freigeschaltet. Zusaetzlich liessen drei
-- "*_magiclink_*_temp"-Policies auf benutzer anon beliebige Kunden-Zeilen lesen, aendern
-- und anlegen; magic_links waren fuer anon komplett auflistbar, und
-- link_kunde_from_magic_link (SECURITY DEFINER) war ohne Token-Pruefung an anon freigegeben.
--
-- Loesung: Eine Rolle entsteht nur aus einem Beweis, den die Datenbank selbst prueft.
--   1. is_admin() / is_admin_or_mitarbeiter() verlangen freigeschaltet = true.
--   2. Token-Vorschau fuer die Magic-Link-Seite als eng gefasste Funktion statt offener Tabelle.
--   3. handle_new_auth_user ignoriert 'role'. Alles startet als pending, ausser ein gueltiger,
--      unbenutzter Magic-Link-Token (magic_token in den Metadaten) macht daraus einen
--      freigeschalteten Kunden. Die Verknuepfungen entstehen in derselben Transaktion.
--   4. Guard-Trigger auf benutzer (INSERT und UPDATE) fuer Zugriffe direkt ueber die API.
--   5. Offene Policies und der offene RPC werden geschlossen.
--
-- Stand der Live-Daten beim Schreiben (Audit): alle Admins, Investoren, Agents und
-- Mitarbeiter sind freigeschaltet = true; einziger admin mit freigeschaltet = false ist ein
-- Testkonto. Es gibt bewusst keinen Backfill, damit dieses Konto nicht freigeschaltet wird.
--
-- Ausrollen: Diese Migration und das Frontend-Deployment direkt hintereinander. Dazwischen
-- scheitert die Magic-Link-Registrierung (altes Frontend benutzt die geschlossenen Policies,
-- neues Frontend braucht magic_link_vorschau und den Token im Signup).
-- Dateiname folgt der Repo-Konvention (Datum als Praefix, wie 20261101_*.sql).

-- ============================================================================
-- 1. Hilfsfunktionen: freigeschaltet zaehlt
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM benutzer
    WHERE auth_user_id = (SELECT auth.uid())
      AND rolle = 'admin'
      AND freigeschaltet IS TRUE
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_mitarbeiter()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM benutzer
    WHERE auth_user_id = (SELECT auth.uid())
      AND rolle IN ('admin', 'mitarbeiter')
      AND freigeschaltet IS TRUE
  );
$function$;

-- ============================================================================
-- 2. Token-Vorschau fuer magic-register.html (ersetzt direkten Tabellenzugriff)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.magic_link_vorschau(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link public.magic_links%ROWTYPE;
  v_ansprechpartner jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 OR length(p_token) > 200 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_link FROM public.magic_links WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'not_found');
  END IF;
  IF v_link.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'used');
  END IF;
  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;

  SELECT jsonb_build_object(
    'id', a.id,
    'vorname', a.vorname,
    'nachname', a.nachname,
    'email', a.email,
    'unternehmen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', u.id, 'firmenname', u.firmenname))
      FROM public.ansprechpartner_unternehmen au
      JOIN public.unternehmen u ON u.id = au.unternehmen_id
      WHERE au.ansprechpartner_id = a.id
    ), '[]'::jsonb),
    'marken', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'markenname', m.markenname))
      FROM public.ansprechpartner_marke am
      JOIN public.marke m ON m.id = am.marke_id
      WHERE am.ansprechpartner_id = a.id
    ), '[]'::jsonb)
  )
  INTO v_ansprechpartner
  FROM public.ansprechpartner a
  WHERE a.id = v_link.ansprechpartner_id;

  RETURN jsonb_build_object(
    'valid', true,
    'magic_link_id', v_link.id,
    'expires_at', v_link.expires_at,
    'ansprechpartner', v_ansprechpartner
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.magic_link_vorschau(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.magic_link_vorschau(text) TO anon, authenticated;

-- ============================================================================
-- 3. Signup-Trigger: role aus den Metadaten wird ignoriert
-- ============================================================================
-- Bestehender Trigger on_auth_user_created (AFTER INSERT ON auth.users) bleibt.
-- Der Domain-Check trg_enforce_employee_signup_domain (20261017) bleibt ebenfalls; er liest
-- 'role' nur als Filter, die Rolle wird daraus nicht abgeleitet.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_token text;
  v_link_id uuid;
  v_ansprechpartner_id uuid;
  v_rolle text := 'pending';
  v_unterrolle text := 'awaiting_approval';
  v_freigeschaltet boolean := false;
  v_benutzer_id uuid;
  v_geburtsdatum date;
BEGIN
  v_token := nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'magic_token', '')), '');

  -- Einziger Weg zu einer sofort freigeschalteten Rolle: gueltiger, unbenutzter Token.
  -- Der Update beansprucht den Token atomar (zwei parallele Signups koennen ihn nicht beide nutzen).
  IF v_token IS NOT NULL THEN
    UPDATE public.magic_links
       SET used_at = now()
     WHERE token = v_token
       AND used_at IS NULL
       AND expires_at > now()
    RETURNING id, ansprechpartner_id INTO v_link_id, v_ansprechpartner_id;

    IF v_link_id IS NOT NULL THEN
      v_rolle := 'kunde';
      v_unterrolle := 'can_view';
      v_freigeschaltet := true;
    END IF;
  END IF;

  BEGIN
    v_geburtsdatum := nullif(NEW.raw_user_meta_data ->> 'geburtsdatum', '')::date;
  EXCEPTION WHEN others THEN
    v_geburtsdatum := NULL;
  END;

  INSERT INTO public.benutzer (
    auth_user_id, name, vorname, nachname, email, geburtsdatum,
    rolle, unterrolle, freigeschaltet, created_at, updated_at
  )
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'vorname', '')), ''),
    nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'nachname', '')), ''),
    NEW.email,
    v_geburtsdatum,
    v_rolle,
    v_unterrolle,
    v_freigeschaltet,
    now(),
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = excluded.email,
    updated_at = now()
  RETURNING id INTO v_benutzer_id;

  -- Verknuepfungen wie bisher link_kunde_from_magic_link, jetzt in derselben Transaktion
  -- und nur fuer den Ansprechpartner, der am Token haengt (nie aus Client-Daten).
  IF v_link_id IS NOT NULL AND v_ansprechpartner_id IS NOT NULL THEN
    INSERT INTO public.kunde_ansprechpartner (kunde_id, ansprechpartner_id)
    VALUES (v_benutzer_id, v_ansprechpartner_id)
    ON CONFLICT (kunde_id, ansprechpartner_id) DO NOTHING;

    INSERT INTO public.kunde_unternehmen (kunde_id, unternehmen_id)
    SELECT v_benutzer_id, au.unternehmen_id
    FROM public.ansprechpartner_unternehmen au
    WHERE au.ansprechpartner_id = v_ansprechpartner_id
    ON CONFLICT (kunde_id, unternehmen_id) DO NOTHING;

    INSERT INTO public.kunde_marke (kunde_id, marke_id)
    SELECT v_benutzer_id, am.marke_id
    FROM public.ansprechpartner_marke am
    WHERE am.ansprechpartner_id = v_ansprechpartner_id
    ON CONFLICT (kunde_id, marke_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 4. Guard auf benutzer: privilegierte Spalten nur fuer freigeschaltete Admins
-- ============================================================================
-- SECURITY INVOKER (bewusst): current_user ist dann die Rolle des Aufrufers. Zugriffe direkt
-- ueber die API laufen als authenticated/anon und werden geprueft. SECURITY-DEFINER-Funktionen
-- (handle_new_auth_user, RPCs), service_role (Edge Functions) und der SQL-Editor laufen nicht
-- als diese Rollen und bleiben unberuehrt. Als SECURITY DEFINER waere current_user immer der
-- Owner und der Schutz wirkungslos.
-- Verhalten wie der bisherige Guard (Exception 42501); neu: auch INSERT, kein Freipass mehr
-- fuer anon (auth.uid() IS NULL), Staff darf Rolle/Rechte/Freischaltung nicht mehr setzen.
-- mitarbeiter_klasse_id darf Staff weiterhin aendern (unveraendert).

CREATE OR REPLACE FUNCTION public.benutzer_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF (SELECT public.is_admin()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.rolle IS DISTINCT FROM 'pending'
       OR coalesce(NEW.freigeschaltet, false)
       OR NEW.zugriffsrechte IS NOT NULL
       OR NEW.mitarbeiter_klasse_id IS NOT NULL
       OR coalesce(NEW.unterrolle, 'awaiting_approval') <> 'awaiting_approval'
    THEN
      RAISE EXCEPTION 'Anlegen mit privilegierten Feldern (Rolle/Rechte/Freischaltung) ist nicht erlaubt.'
        USING errcode = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.rolle IS DISTINCT FROM OLD.rolle)
     OR (NEW.unterrolle IS DISTINCT FROM OLD.unterrolle)
     OR (NEW.zugriffsrechte IS DISTINCT FROM OLD.zugriffsrechte)
     OR (NEW.freigeschaltet IS DISTINCT FROM OLD.freigeschaltet)
     OR (NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id)
  THEN
    RAISE EXCEPTION 'Aenderung privilegierter Felder (Rolle/Rechte/Freischaltung) ist nicht erlaubt.'
      USING errcode = '42501';
  END IF;

  IF (NEW.mitarbeiter_klasse_id IS DISTINCT FROM OLD.mitarbeiter_klasse_id)
     AND NOT (SELECT public.is_admin_or_mitarbeiter())
  THEN
    RAISE EXCEPTION 'Aenderung der Mitarbeiter-Klasse ist nicht erlaubt.'
      USING errcode = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS benutzer_guard_privileged_columns ON public.benutzer;

CREATE TRIGGER benutzer_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON public.benutzer
  FOR EACH ROW EXECUTE FUNCTION public.benutzer_guard_privileged_columns();

-- ============================================================================
-- 5. Offene Policies und der offene RPC
-- ============================================================================

-- Der Magic-Link-Flow laeuft jetzt komplett serverseitig (Trigger + magic_link_vorschau).
DROP POLICY IF EXISTS benutzer_magiclink_insert_temp ON public.benutzer;
DROP POLICY IF EXISTS benutzer_magiclink_select_temp ON public.benutzer;
DROP POLICY IF EXISTS benutzer_magiclink_update_temp ON public.benutzer;

-- Mitarbeiter duerfen fremde Admin-Zeilen nicht mehr aendern; eigene Zeile und andere
-- Mitarbeiter bleiben (Rolle/Rechte schuetzt zusaetzlich der Guard-Trigger).
DROP POLICY IF EXISTS benutzer_update ON public.benutzer;
CREATE POLICY benutzer_update ON public.benutzer FOR UPDATE TO public
  USING (
    (auth_user_id = (SELECT auth.uid()))
    OR ((SELECT get_current_user_rolle()) = 'admin')
    OR (((SELECT get_current_user_rolle()) = 'mitarbeiter') AND (rolle = 'mitarbeiter'))
  );

-- magic_links nur noch fuer Staff lesbar/aenderbar. Token-Pruefung laeuft ueber
-- magic_link_vorschau, das Beanspruchen im Signup-Trigger. Damit sind auch die
-- magic_links-Zweige in den Policies auf ansprechpartner_unternehmen / marke / unternehmen
-- fuer anon wirkungslos (deren Subquery unterliegt der RLS von magic_links).
DROP POLICY IF EXISTS magic_links_select ON public.magic_links;
CREATE POLICY magic_links_select ON public.magic_links FOR SELECT TO public
  USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS magic_links_update ON public.magic_links;
CREATE POLICY magic_links_update ON public.magic_links FOR UPDATE TO public
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

-- Prueft weder Token noch Besitzer von p_kunde_id. Die Verknuepfung macht jetzt
-- handle_new_auth_user. Funktion bleibt fuer service_role/postgres bestehen.
REVOKE EXECUTE ON FUNCTION public.link_kunde_from_magic_link(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_kunde_from_magic_link(uuid, uuid, uuid) FROM anon, authenticated;
