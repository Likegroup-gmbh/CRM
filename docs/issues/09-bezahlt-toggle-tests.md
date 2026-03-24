# Bezahlt-Toggle: Tests

## Parent PRD

`docs/PRD-bezahlt-toggle-rechnungsliste.md`

## What to build

Unit-Tests für den Bezahlt-Toggle in `src/__tests__/RechnungBezahltToggle.test.js`. Das Test-Pattern folgt `RechnungVertragColumn.test.js`: Import der Render-Funktion, Aufruf mit verschiedenen Datensätzen, Assertion auf HTML-Output.

Für Event-Handling-Tests (Inflight-Guard, Fehler-Rollback, Berechtigungen) wird ein minimales DOM-Setup mit `document.createElement` verwendet.

### Testfälle

1. Toggle rendert `checked` bei Status "Bezahlt"
2. Toggle rendert ohne `checked` bei Status "Offen"
3. Toggle rendert ohne `checked` bei Status "Rückfrage" (und anderen Nicht-Bezahlt-Status)
4. Toggle rendert `disabled` wenn `canEdit=false`
5. Toggle rendert ohne `disabled` wenn `canEdit=true`
6. Inflight-Guard: Während laufendem Update kein zweiter Request
7. Fehler-Rollback: Bei API-Fehler wird Checkbox zurückgesetzt
8. Berechtigungsprüfung: Kunden-Toggle ist disabled

## Acceptance criteria

- [ ] Testdatei `src/__tests__/RechnungBezahltToggle.test.js` existiert
- [ ] Alle 8 Testfälle sind implementiert und grün
- [ ] Tests laufen mit `vitest` ohne Fehler
- [ ] Tests prüfen externes Verhalten, nicht Implementierungsdetails

## Blocked by

- Blocked by Issue 06 (Render-Funktion muss exportierbar sein für Import in Tests)

## User stories addressed

- Alle User Stories (Qualitätssicherung des gesamten Features)
