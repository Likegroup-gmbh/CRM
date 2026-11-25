-- Teilrechnung: Zahlungsstand vom Auftrag uebernehmen.
--
-- Hintergrund: Die Kundenrechnungen-Liste liest den Zahlungsstand aus auftrag_teilrechnung,
-- sobald ein Auftrag Teilrechnungen hat. Der Projekt-Wizard hat Teilrechnungen beim Speichern
-- ohne Zahlungsstand neu angelegt, waehrend der Auftrag selbst bezahlt blieb. Ergebnis: bezahlte
-- Rechnungen erscheinen als ueberfaellig (22 Auftraege SharkNinja, Stand 26.10.2026).
--
-- Nur Auftraege mit genau einer Teilrechnung, damit bei mehreren nichts falsch zugeordnet wird.
-- Kopiert werden nur ueberwiesen und ueberwiesen_am. Idempotent: ein zweiter Lauf findet nichts mehr.

DO $$
DECLARE
  n_betroffen int;
  n_geaendert int;
BEGIN
  SELECT count(*) INTO n_betroffen
  FROM auftrag_teilrechnung t
  JOIN auftrag a ON a.id = t.auftrag_id
  WHERE (a.ueberwiesen OR a.ueberwiesen_am IS NOT NULL)
    AND NOT t.ueberwiesen
    AND t.ueberwiesen_am IS NULL
    AND (SELECT count(*) FROM auftrag_teilrechnung x WHERE x.auftrag_id = a.id) = 1;

  UPDATE auftrag_teilrechnung t
  SET ueberwiesen = true,
      ueberwiesen_am = a.ueberwiesen_am
  FROM auftrag a
  WHERE a.id = t.auftrag_id
    AND (a.ueberwiesen OR a.ueberwiesen_am IS NOT NULL)
    AND NOT t.ueberwiesen
    AND t.ueberwiesen_am IS NULL
    AND (SELECT count(*) FROM auftrag_teilrechnung x WHERE x.auftrag_id = a.id) = 1;

  GET DIAGNOSTICS n_geaendert = ROW_COUNT;
  RAISE NOTICE 'Teilrechnungen betroffen: %, aktualisiert: %', n_betroffen, n_geaendert;
END $$;
