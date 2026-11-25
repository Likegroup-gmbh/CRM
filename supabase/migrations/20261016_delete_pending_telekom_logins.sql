-- Einmal-Cleanup: 2 Telekom-Kunden, die sich faelschlich ueber die oeffentliche
-- Mitarbeiter-Registrierung angemeldet haben und als rolle='pending'
-- in der Mitarbeiterliste ("Ohne Rolle") aufgetaucht sind:
--   Tara Gonzalez Diaz  <tara.gonzalez-diaz@telekom.de>
--   Andrea Leise        <andrea.leise@telekom.de>
--
-- Es werden NUR die Anmeldedaten entfernt (public.benutzer + auth.users),
-- damit die E-Mails fuer eine erneute Kunden-Registrierung frei sind.
-- Ansprechpartner, Unternehmen/Marken bleiben unangetastet.
-- (Vorher geprueft: keine verknuepften Rows ueber alle FKs auf benutzer/auth.users.)

DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    'cb631600-150c-45de-939e-d07074cb5e82'::uuid, -- Tara Gonzalez Diaz
    '64cb09e3-fd87-4bd1-add0-dfe6d8b45926'::uuid  -- Andrea Leise
  ];
  v_auth_ids uuid[];
BEGIN
  -- auth_user_ids nur von Rows holen, die wirklich pending sind (Sicherheitsnetz)
  SELECT COALESCE(array_agg(auth_user_id), ARRAY[]::uuid[])
    INTO v_auth_ids
  FROM public.benutzer
  WHERE id = ANY (v_ids)
    AND rolle = 'pending'
    AND auth_user_id IS NOT NULL;

  DELETE FROM public.benutzer
  WHERE id = ANY (v_ids)
    AND rolle = 'pending';

  IF cardinality(v_auth_ids) > 0 THEN
    DELETE FROM auth.users WHERE id = ANY (v_auth_ids);
  END IF;
END $$;
