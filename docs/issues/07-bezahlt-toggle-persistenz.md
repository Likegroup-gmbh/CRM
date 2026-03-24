# Bezahlt-Toggle: Persistenz + Event-Handling

## Parent PRD

`docs/PRD-bezahlt-toggle-rechnungsliste.md`

## What to build

Der Toggle aus Issue 06 wird interaktiv: Klick speichert den Status in die Datenbank und gibt visuelles Feedback.

End-to-end:
- `_bezahltUpdateInFlight = new Set()` im Konstruktor initialisieren
- Delegierter `change`-Event-Listener in `bindAdditionalEvents` (mit AbortSignal)
- Listener filtert auf CSS-Klasse `rechnung-bezahlt-toggle`
- Toggle AN → `dataService.updateEntity('rechnung', id, { status: 'Bezahlt' })`
- Toggle AUS → `dataService.updateEntity('rechnung', id, { status: 'Offen' })`
- Während Request: `input.disabled = true`, kein zweiter Request möglich (Inflight-Guard)
- Bei Erfolg: `entityUpdated` CustomEvent feuern mit `field: 'status'`
- Bei Fehler: Checkbox auf vorherigen Zustand zurückdrehen + Fehler-Toast/Alert

## Acceptance criteria

- [ ] Toggle-Klick setzt Status auf `Bezahlt` (AN) bzw. `Offen` (AUS) in der Datenbank
- [ ] Während des Speicherns ist der Toggle disabled (kein Doppelklick möglich)
- [ ] Bei Erfolg wird `entityUpdated` CustomEvent gefeuert
- [ ] Bei Fehler springt der Toggle zurück und eine Fehlermeldung erscheint
- [ ] Inflight-Guard verhindert parallele Requests für dieselbe Rechnung
- [ ] `bezahlt_am` wird NICHT verändert

## Blocked by

- Blocked by Issue 06 (Bezahlt-Toggle: Render + CSS)

## User stories addressed

- User Story 2: Status mit einem Klick umschalten
- User Story 3: Mehrere Rechnungen schnell hintereinander markieren
- User Story 4: Visuelles Feedback und Fehler-Rollback
- User Story 5: Deaktivieren setzt auf "Offen"
- User Story 8: Keine doppelten Requests
- User Story 9: Verständliche Fehlermeldung
