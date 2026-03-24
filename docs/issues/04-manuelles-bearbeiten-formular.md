# Manuelles Bearbeiten: Vertrag-Dropdown im Rechnungsformular

## Parent PRD

Siehe `docs/PRD-vertragsspalte-rechnungsliste.md`

## What to build

Im Rechnungsformular (Bearbeitung) wird ein optionales Dropdown-Feld für `vertrag_id` hinzugefügt. Verfügbare Verträge werden über die `kooperation_id` der Rechnung geladen. Nur finale (nicht-Entwurf) Verträge werden als Optionen angeboten.

End-to-end: Formular zeigt Dropdown → Verträge per `VertragRepository.loadByKooperation` laden → Auswahl speichern → `vertrag_id` wird aktualisiert.

## Acceptance criteria

- [ ] Dropdown-Feld "Vertrag" im Rechnungsformular (Edit-Modus)
- [ ] Verfügbare Verträge werden über `kooperation_id` der Rechnung geladen
- [ ] Nur finale Verträge (`is_draft = false`) erscheinen als Optionen
- [ ] Aktuell zugeordneter Vertrag ist vorausgewählt
- [ ] Auswahl "Kein Vertrag" / leere Option möglich
- [ ] Änderung wird beim Speichern korrekt persistiert
- [ ] Dropdown ist deaktiviert wenn keine `kooperation_id` vorhanden

## Blocked by

- Blocked by Issue #1 (DB-Migration + DataService)

## User stories addressed

- User Story 5 (Nachträgliches Ändern)
- User Story 6 (Nur passende Verträge im Dropdown)
