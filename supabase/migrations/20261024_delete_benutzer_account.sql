-- Accounts aus Mitarbeiter- und Kundenliste loeschen.
-- Die Zeile liegt in public.benutzer, der Login in auth.users.
-- Ohne den Auth-User bleibt die E-Mail belegt und eine Neuregistrierung scheitert.

CREATE OR REPLACE FUNCTION public.delete_benutzer_account(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid;
  v_rolle text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Accounts löschen'
      USING ERRCODE = '42501';
  END IF;

  SELECT auth_user_id, rolle
    INTO v_auth, v_rolle
  FROM public.benutzer
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account nicht gefunden';
  END IF;

  IF v_rolle = 'admin' THEN
    RAISE EXCEPTION 'Admin-Accounts können hier nicht gelöscht werden';
  END IF;

  IF v_auth IS NOT NULL AND v_auth = auth.uid() THEN
    RAISE EXCEPTION 'Der eigene Account kann nicht gelöscht werden';
  END IF;

  DELETE FROM public.benutzer WHERE id = p_id;

  IF v_auth IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_benutzer_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_benutzer_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_benutzer_account(uuid) TO authenticated;
