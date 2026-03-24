# Feature: Bezahlt-Toggle in der Rechnungsliste

## Problem Statement

In der Rechnungsliste muss der Status einer Rechnung aktuell über das Aktionsmenü (Drei-Punkte-Menü → "Status ändern") geändert werden. Das erfordert mehrere Klicks und ist umständlich, wenn man schnell mehrere Rechnungen als "Bezahlt" markieren möchte. Nutzer wünschen sich eine schnellere Möglichkeit, den Bezahlt-Status direkt in der Tabellenübersicht umzuschalten – analog zum Newsletter-Toggle bei Ansprechpartnern.

## Solution

Ein Toggle-Switch wird als eigene Spalte ("Bezahlt") in der Rechnungstabelle eingefügt, direkt vor der Aktionsspalte. Der Toggle zeigt den aktuellen Bezahlt-Status an und ermöglicht es, den Status mit einem Klick umzuschalten:

- **Toggle AN** → Status wird auf `Bezahlt` gesetzt
- **Toggle AUS** → Status wird auf `Offen` zurückgesetzt

Der Toggle nutzt die bestehenden CSS-Komponenten (`toggle-switch`, `toggle-slider`) und das bewährte Pattern aus der Ansprechpartner-Liste (Newsletter-Toggle). Das Aktionsmenü bleibt unverändert bestehen. Beide Wege (Toggle und Aktionsmenü) bleiben synchron.

## User Stories

1. Als Mitarbeiter möchte ich in der Rechnungsliste auf einen Blick sehen, welche Rechnungen bezahlt sind, damit ich den Überblick behalte.
2. Als Mitarbeiter möchte ich den Bezahlt-Status einer Rechnung mit einem einzigen Klick umschalten, damit ich nicht durch das Aktionsmenü navigieren muss.
3. Als Mitarbeiter möchte ich mehrere Rechnungen schnell hintereinander als bezahlt markieren können, damit die Stapelverarbeitung nach Zahlungseingang effizient ist.
4. Als Mitarbeiter möchte ich, dass der Toggle sofort visuell reagiert und bei Fehler automatisch zurückspringt, damit ich sicher bin, dass die Änderung gespeichert wurde.
5. Als Mitarbeiter möchte ich, dass wenn ich den Toggle deaktiviere, der Status auf "Offen" zurückgesetzt wird, damit das Verhalten vorhersehbar ist.
6. Als Mitarbeiter möchte ich, dass der Toggle mit dem Aktionsmenü synchron bleibt, damit der Status konsistent angezeigt wird, egal über welchen Weg er geändert wurde.
7. Als Kunde (ohne Bearbeitungsrechte) möchte ich den Toggle als ausgegraut/disabled sehen, damit ich weiß, dass ich den Status nicht ändern kann.
8. Als Mitarbeiter möchte ich, dass während des Speichervorgangs keine doppelten Requests abgeschickt werden, damit keine inkonsistenten Zustände entstehen.
9. Als Mitarbeiter möchte ich bei einem Speicherfehler eine verständliche Fehlermeldung sehen, damit ich weiß, dass die Änderung nicht gespeichert wurde.
10. Als Mitarbeiter möchte ich, dass der Toggle auch nach Statusänderung über das Aktionsmenü den korrekten Zustand anzeigt, ohne die Seite neu laden zu müssen.

## Implementation Decisions

### Pattern: Newsletter-Toggle als Vorlage
- Das bestehende Newsletter-Toggle-Pattern aus `AnsprechpartnerList` wird 1:1 übernommen: eigene Render-Methode, delegierter `change`-Event-Listener mit Inflight-Guard, Fehler-Rollback, `entityUpdated` CustomEvent.

### Toggle-Logik
- **Checked** = Status ist `Bezahlt`
- **Unchecked** = Status ist nicht `Bezahlt` (beliebiger anderer Status)
- **Toggle AN** → setzt Status auf `Bezahlt`
- **Toggle AUS** → setzt Status immer auf `Offen` (kein "vorheriger Status" wird gemerkt)
- **bezahlt_am** wird NICHT automatisch gesetzt oder geändert

### Berechtigung
- Alle Nutzer mit `canEdit`-Rechten (alle außer Kunden) können den Toggle bedienen
- Für Kunden: Toggle ist `disabled` und ausgegraut (opacity 0.65)

### Platzierung in der Tabelle
- Eigene Spalte "Bezahlt" direkt **vor der Aktionsspalte**
- Header: `<th class="table-cell-center">Bezahlt</th>`
- Zelle: `<td class="table-cell-center">` mit Toggle-HTML

### Persistenz
- Update über `window.dataService.updateEntity('rechnung', id, { status: newStatus })`
- Nach Erfolg: `entityUpdated` CustomEvent mit `field: 'status'` feuern
- Der bestehende `entityUpdated`-Listener in der Liste aktualisiert die Zeile inline

### Sync mit Aktionsmenü
- Der bestehende `updateSingleRow`-Handler wird erweitert: bei Statusänderung wird auch die Toggle-Checkbox in der Zeile synchronisiert (`checked` = `Bezahlt`)

### CSS
- Wrapper-Klasse `rechnung-bezahlt-toggle-wrapper` analog zu `ansprechpartner-newsletter-toggle-wrapper`
- Basis-Styles `.toggle-switch` / `.toggle-slider` sind bereits global vorhanden
- Checkbox-Klasse für Event-Delegation: `rechnung-bezahlt-toggle`

### Betroffene Module
- `RechnungList.js`: Toggle-Methode, Spalte, Event-Listener, Inflight-Guard, Sync
- `tabellen.css`: Modulspezifische CSS-Ergänzung

### Nicht betroffene Module
- `DataService.js` – `status` ist bereits als `string` gemappt
- `ActionConfig.js` – Aktionsmenü bleibt unverändert
- `FormConfig.js` – Formularfeld bleibt unverändert
- Keine Datenbank-Migration nötig

## Testing Decisions

### Testphilosophie
- Tests prüfen das **externe Verhalten** (Render-Output, Zustandsänderungen), nicht Implementierungsdetails
- Tests verwenden `vitest` (wie alle bestehenden Tests im Projekt)
- Reine Unit-Tests auf die exportierte/render-Logik, kein DOM-Mounting nötig

### Prior Art
- `src/__tests__/RechnungVertragColumn.test.js` testet eine Render-Funktion aus dem Rechnungs-Modul: Import der Funktion, Aufruf mit verschiedenen Datensätzen, Assertion auf HTML-Output via `toContain`. Gleiches Pattern wird hier verwendet.

### Testfälle

1. **Toggle rendert korrekt bei Status "Bezahlt"**: Checkbox hat `checked`-Attribut
2. **Toggle rendert korrekt bei Status "Offen"**: Checkbox hat kein `checked`-Attribut
3. **Toggle rendert korrekt bei anderen Status** (z.B. "Rückfrage"): kein `checked`
4. **Toggle ist disabled wenn canEdit=false**: `disabled`-Attribut vorhanden
5. **Toggle ist enabled wenn canEdit=true**: kein `disabled`-Attribut
6. **Inflight-Guard**: Während eines laufenden Updates wird kein zweiter Request abgeschickt
7. **Fehler-Rollback**: Bei API-Fehler wird die Checkbox auf den vorherigen Zustand zurückgesetzt
8. **Berechtigungsprüfung**: Kunden sehen den Toggle als disabled

### Testdatei
- `src/__tests__/RechnungBezahltToggle.test.js`

## Out of Scope

- Toggle in der Rechnungs-Detailansicht
- Automatisches Setzen von `bezahlt_am` beim Umschalten
- Änderungen an den Rechnungs-Filtern
- Bulk-Toggle (mehrere Rechnungen gleichzeitig umschalten)
- Änderungen am Aktionsmenü oder dessen Berechtigungen
- Neue Datenbank-Felder oder Migrationen

## Further Notes

- Wenn eine Rechnung über das Aktionsmenü auf einen Status gesetzt wird, der weder "Offen" noch "Bezahlt" ist (z.B. "Rückfrage"), zeigt der Toggle "aus" an. Ein erneutes Aktivieren setzt auf "Bezahlt", Deaktivieren setzt immer auf "Offen" – nicht zurück auf "Rückfrage".
- Die bestehende Sortierlogik in der Liste (Bezahlt-Rechnungen nach unten) bleibt unverändert und profitiert automatisch vom Toggle, da der Status korrekt aktualisiert wird.
