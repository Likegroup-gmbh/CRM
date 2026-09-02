-- Neue Mitarbeiter-Klasse: Finanzen (View-only Projektmanagement)

INSERT INTO mitarbeiter_klasse (id, name, description, sort_order)
SELECT gen_random_uuid(),
       'Finanzen',
       'View-only Projektmanagement (Aufträge, Kundenrechnungen, Auftragsdetails, Kampagnen)',
       75
WHERE NOT EXISTS (
  SELECT 1 FROM mitarbeiter_klasse WHERE name = 'Finanzen'
);

NOTIFY pgrst, 'reload schema';
