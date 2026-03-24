# Bezahlt-Toggle: Render + CSS

## Parent PRD

`docs/PRD-bezahlt-toggle-rechnungsliste.md`

## What to build

Eine neue Spalte "Bezahlt" in der Rechnungstabelle, direkt vor der Aktionsspalte. Der Toggle zeigt visuell den aktuellen Bezahlt-Status an, ist aber in diesem Slice noch nicht interaktiv (Persistenz kommt in Issue 07).

End-to-end:
- `renderBezahltToggle(rechnung, canEdit)` Methode in `RechnungList.js` erstellen
- `<th>` im Tabellen-Header einfügen
- `<td>` mit Toggle-HTML in jeder Zeile rendern
- Toggle ist `checked` wenn `status === 'Bezahlt'`, sonst unchecked
- Toggle ist `disabled` wenn `canEdit === false`
- CSS-Klasse `rechnung-bezahlt-toggle-wrapper` in `tabellen.css` anlegen
- `tableColspan` um 1 erhöhen (falls relevant)
- Bestehende `.toggle-switch` / `.toggle-slider` Styles aus `components.css` wiederverwenden

## Acceptance criteria

- [ ] Neue Spalte "Bezahlt" ist in der Rechnungstabelle sichtbar, direkt vor der Aktionsspalte
- [ ] Toggle zeigt `checked` bei Rechnungen mit Status `Bezahlt`
- [ ] Toggle zeigt `unchecked` bei allen anderen Status (Offen, Rückfrage, An Qonto gesendet)
- [ ] Toggle ist `disabled` für Nutzer ohne Bearbeitungsrechte (Kunden)
- [ ] Toggle ist `enabled` für alle Nicht-Kunden
- [ ] Visuelles Styling ist konsistent mit dem Newsletter-Toggle bei Ansprechpartnern

## Blocked by

None - kann sofort gestartet werden.

## User stories addressed

- User Story 1: Als Mitarbeiter möchte ich auf einen Blick sehen, welche Rechnungen bezahlt sind
- User Story 7: Als Kunde sehe ich den Toggle als ausgegraut/disabled
