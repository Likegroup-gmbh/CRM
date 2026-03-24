# Integration-Tests: Vertragsspalte und Zuordnungslogik

## Parent PRD

Siehe `docs/PRD-vertragsspalte-rechnungsliste.md`

## What to build

Integration-Tests für die Vertragszuordnungslogik und das Spalten-Rendering in der Rechnungsliste. Tests prüfen das externe Verhalten (Input → Output), nicht Implementierungsdetails.

## Acceptance criteria

- [ ] Test: Rechnung mit Vertrag → Spalte zeigt Link zum PDF
- [ ] Test: Rechnung ohne Vertrag → Spalte zeigt Warn-Icon
- [ ] Test: Rechnung ohne Kooperation → kein Fehler, Warn-Icon
- [ ] Test: Vertrag-Link-Priorität (Dropbox > Unterschrieben > Standard)
- [ ] Test: Auto-Zuordnung beim Erstellen setzt korrekte `vertrag_id`
- [ ] Test: Auto-Zuordnung ohne unterschriebenen Vertrag → `vertrag_id` bleibt null
- [ ] Tests nutzen Vitest + `vi.fn()` Mocks (Pattern aus `VertragRepository.test.js`)

## Blocked by

- Blocked by Issue #2 (Vertragsspalte)
- Blocked by Issue #3 (Auto-Zuordnung)

## User stories addressed

- Alle User Stories (Absicherung der gesamten Implementierung)
