-- Einmal-Cleanup: 4 Kunden, die sich fälschlich über die öffentliche
-- Mitarbeiter-Registrierung (Login -> "Registrierung") angemeldet haben
-- und dadurch als rolle='pending' in der Mitarbeiterliste ("Ohne Rolle")
-- aufgetaucht sind:
--   Vanessa Tschepat  <vanessa.tschepat@telekom.de>
--   Christin Schulz   <christin.schulz@liebherr.com>
--   Hannah Kees       <kees.hannah@territory.group>
--   Eva Bohg          <eva.bohg@canon.de>
--
-- Es werden NUR die Anmeldedaten entfernt (public.benutzer + auth.users),
-- damit die E-Mails fuer eine erneute Kunden-Registrierung frei sind.
-- Ansprechpartner, magic_links, Unternehmen/Marken bleiben unangetastet.
-- (Vorher geprueft: keine kunde_ansprechpartner/kunde_unternehmen/kunde_marke-
-- Junctions und keine blockierenden FK-Rows auf diesen benutzer-IDs.)

DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    '5b7240cf-2094-456e-991a-651cc0d967e9'::uuid, -- Vanessa Tschepat
    'b632a858-41cb-4675-86a2-0626c10450a6'::uuid, -- Christin Schulz
    '46877375-4a8e-4ad0-9d5a-0bfc35b2ba8a'::uuid, -- Hannah Kees
    'ea323d9c-1c53-40cc-a6ac-e5d4eb88f56a'::uuid  -- Eva Bohg
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
