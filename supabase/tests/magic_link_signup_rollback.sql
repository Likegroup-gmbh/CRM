-- Signup-Trigger fuer Magic Links pruefen, ohne Daten zu hinterlassen.
--
-- Legt in einer Transaktion einen Token und einen auth.users-Eintrag an (mit
-- boeswilligem role = 'admin' in den Metadaten) und bricht am Ende mit einer
-- Exception ab. Postgres rollt dadurch alles zurueck.
--
-- Erwartete Ausgabe (der "Fehler" ist das Ergebnis):
--   ROLLBACK-ERGEBNIS: rolle=kunde unterrolle=can_view freigeschaltet=t verknuepft_ap=1 link_used=t
--
-- Abweichung = Registrierung ueber Einladungslink ist kaputt:
--   rolle=pending      -> Token wird nicht beansprucht (handle_new_auth_user)
--   rolle=admin        -> role aus den Metadaten wird wieder uebernommen (Sicherheitsluecke)
--   verknuepft_ap=0    -> kunde_ansprechpartner wird nicht gefuellt
--
-- Ausfuehren: Supabase SQL-Editor oder `execute_sql` (MCP). Braucht mindestens einen
-- Ansprechpartner; hier ein beliebiger mit oviva.com-Adresse, sonst Filter anpassen.
-- Nach dem Lauf pruefen: select count(*) from auth.users where email = 'smoketest-rollback@example.com'; -> 0

DO $$
DECLARE
  v_ap uuid;
  v_tok text := 'smoketest' || md5(random()::text) || md5(random()::text);
  v_uid uuid := gen_random_uuid();
  v_res text;
BEGIN
  SELECT id INTO v_ap FROM public.ansprechpartner ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.magic_links (token, ansprechpartner_id, expires_at)
  VALUES (v_tok, v_ap, '9999-12-31');

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'smoketest-rollback@example.com',
    jsonb_build_object('magic_token', v_tok, 'role', 'admin', 'name', 'Smoke Test'),
    now(), now()
  );

  SELECT format(
    'rolle=%s unterrolle=%s freigeschaltet=%s verknuepft_ap=%s link_used=%s',
    b.rolle, b.unterrolle, b.freigeschaltet,
    (SELECT count(*) FROM public.kunde_ansprechpartner k WHERE k.kunde_id = b.id),
    (SELECT used_at IS NOT NULL FROM public.magic_links WHERE token = v_tok)
  ) INTO v_res
  FROM public.benutzer b
  WHERE b.auth_user_id = v_uid;

  RAISE EXCEPTION 'ROLLBACK-ERGEBNIS: %', v_res;
END $$;
