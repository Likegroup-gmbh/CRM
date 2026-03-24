# Bezahlt-Toggle: Sync mit Aktionsmenü

## Parent PRD

`docs/PRD-bezahlt-toggle-rechnungsliste.md`

## What to build

Wenn der Status einer Rechnung über das Aktionsmenü geändert wird, muss der Toggle in der Tabellenzeile synchron aktualisiert werden.

End-to-end:
- Der bestehende `entityUpdated`-Listener in `RechnungList.js` ruft bereits `updateSingleRow(id, value)` auf
- `updateSingleRow` wird erweitert: nach dem Status-Text-Update wird auch die Toggle-Checkbox in der Zeile gesucht und ihr `checked`-Zustand auf `(newStatus === 'Bezahlt')` gesetzt
- Beide Richtungen funktionieren: Toggle → Aktionsmenü-Badge aktualisiert sich (bereits durch `updateSingleRow`), Aktionsmenü → Toggle aktualisiert sich (neu)

## Acceptance criteria

- [ ] Statusänderung über Aktionsmenü auf "Bezahlt" → Toggle wird checked
- [ ] Statusänderung über Aktionsmenü auf "Offen"/"Rückfrage"/"An Qonto gesendet" → Toggle wird unchecked
- [ ] Statusänderung über Toggle → Status-Text in der Zeile aktualisiert sich korrekt
- [ ] Kein Seitenreload nötig für die Synchronisation

## Blocked by

- Blocked by Issue 07 (Bezahlt-Toggle: Persistenz + Event-Handling)

## User stories addressed

- User Story 6: Toggle und Aktionsmenü bleiben synchron
- User Story 10: Toggle zeigt korrekten Zustand nach Aktionsmenü-Änderung
