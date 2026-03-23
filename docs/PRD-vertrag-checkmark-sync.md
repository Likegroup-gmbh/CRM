# PRD: Vertrag-Checkmark Sync absichern

## Problem Statement

Der Vertrag-Checkmark in der Kampagnen-Kooperations-Tabelle zeigt an, ob ein unterschriebener Vertrag fuer eine Kooperation vorliegt. Aktuell gibt es fuenf Luecken im Sync-Mechanismus, die dazu fuehren, dass der Checkmark in bestimmten Szenarien einen falschen Zustand anzeigt:

1. **Bulk-Delete vergisst Sync:** Wenn mehrere Vertraege gleichzeitig geloescht werden, wird der Checkmark auf der Kooperation nicht zurueckgesetzt.
2. **UI aktualisiert sich nicht:** Nach dem Upload eines unterschriebenen Vertrags in der Kampagnen-Ansicht muss der User die Seite manuell neu laden, um den Checkmark zu sehen.
3. **Realtime ohne DOM-Update:** Wenn ein anderer User einen Vertrag hochlaedt, wird die Aenderung zwar per Realtime empfangen, aber nicht im DOM angezeigt.
4. **Nachtraegliche Kooperations-Zuweisung:** Wenn ein Vertrag ohne Kooperation erstellt wird und spaeter einer zugewiesen wird, obwohl bereits eine Unterschrift vorliegt, wird kein Sync ausgeloest.
5. **Bestandsdaten-Migration fehlt:** Das SQL-Statement fuer die initiale Synchronisierung von Bestandsdaten (Issue #27) existiert nur als Kommentar im Code, nicht als ausfuehrbare Migration.

## Solution

Einfuehrung einer neuen `reconcileVertragCheckbox(koopId)`-Funktion als Single Source of Truth. Diese Funktion prueft selbststaendig, ob fuer eine Kooperation ein unterschriebener Vertrag existiert, und setzt den Checkmark entsprechend. Alle bestehenden und neuen Code-Pfade delegieren an diese Funktion, anstatt selbst `true`/`false` zu bestimmen. Zusaetzlich wird die UI so erweitert, dass Aenderungen am Checkmark sofort sichtbar werden (nach Upload und via Realtime).

## User Stories

1. Als Mitarbeiter moechte ich, dass der Vertrag-Checkmark sofort nach dem Upload eines unterschriebenen Vertrags in der Kampagnen-Tabelle erscheint, damit ich nicht die Seite neu laden muss.
2. Als Admin moechte ich, dass beim Bulk-Delete von Vertraegen der Checkmark auf betroffenen Kooperationen korrekt zurueckgesetzt wird, damit keine falschen Haekchen stehen bleiben.
3. Als Mitarbeiter moechte ich, dass wenn ich einem bestehenden Vertrag nachtraeglich eine Kooperation zuweise, der Checkmark automatisch gesetzt wird falls der Vertrag bereits unterschrieben ist.
4. Als Mitarbeiter moechte ich in der Kampagnen-Tabelle live sehen, wenn ein Kollege einen Vertrag hochlaedt, ohne die Seite neu laden zu muessen.
5. Als Admin moechte ich, dass Bestandsdaten korrekt migriert werden, damit alle historischen Kooperationen mit unterschriebenen Vertraegen den Checkmark anzeigen.
6. Als Mitarbeiter moechte ich, dass beim Loeschen eines einzelnen unterschriebenen Vertrags der Checkmark nur zurueckgesetzt wird, wenn kein anderer unterschriebener Vertrag fuer die Kooperation existiert.
7. Als Kunde moechte ich den Vertrag-Checkmark nur lesen koennen (disabled Checkbox), ohne ihn manuell aendern zu koennen, damit der Status konsistent bleibt.
8. Als Mitarbeiter moechte ich, dass der Checkmark nur bei einem tatsaechlich unterschriebenen Vertrag (Upload/Dropbox-Link vorhanden) aktiv wird, nicht schon beim Erstellen oder Finalisieren eines Vertrags.
9. Als Admin moechte ich, dass das Entfernen eines unterschriebenen Vertrags den Checkmark zuruecksetzt und die UI sofort aktualisiert.
10. Als Mitarbeiter moechte ich neben dem Checkmark einen Badge/Link sehen, der mich direkt zum unterschriebenen Vertrag fuehrt, wenn einer existiert.
11. Als Mitarbeiter moechte ich, dass der Vertrag-Checkmark als erster fachlicher Statusindikator (nach den fixen Spalten Nr/Creator) in der Kampagnen-Kooperations-Tabelle steht.

## Implementation Decisions

### Architektur: VertragBridge mit intent-basiertem commit (RFC #28)

- Neues Deep Module `VertragBridge` (Factory-Pattern) ersetzt sowohl `syncVertragCheckbox` als auch das geplante `reconcileVertragCheckbox`.
- `createVertragBridge({ supabase })` liefert `{ commit, renderCell, refreshFromServer }`.
- `commit({ kooperationId, intent })` fuehrt intern immer reconcile durch: DB-Query "Existiert ein Vertrag mit signed URL?" → UPDATE `kooperationen.vertrag_unterschrieben`.
- Intent-basiert statt bool-basiert: `'contract_signed'` / `'contract_removed'` verhindert Fehler durch falsche true/false-Werte.
- Standalone `deriveVertragStatus(vertrag)` als einzige Quelle fuer den Vertrags-Status (ersetzt 3 duplizierte Implementierungen).
- Supabase wird per DI injiziert (kein `window.supabase` im Bridge-Modul).

### Bulk-Delete Fix

- In `VertraegeList.deleteSelected()`: Vor dem DELETE alle betroffenen `kooperation_id`s sammeln (nur von Vertraegen die signed URLs haben). Nach dem DELETE `bridge.commit({ kooperationId, intent: 'contract_removed' })` fuer jede betroffene Kooperation aufrufen.

### UI Auto-Refresh nach Upload

- In `KampagneDetail`: Der onSuccess-Callback des `VertragUploadDrawer` ruft zusaetzlich `this.kooperationenVideoTable?.refresh()` auf.
- Gleiches fuer `VertraegeList`-basierte Uploads aus dem Vertraege-Tab in der Kampagne.

### Realtime DOM-Update

- In `VideoTableRealtimeHandler.handleKooperationUpdate`: Wenn sich `vertrag_unterschrieben` zwischen `payload.old` und `payload.new` unterscheidet, wird `bridge.refreshFromServer({ kooperationId })` aufgerufen und die `.col-vertrag` TD-Zelle mit `bridge.renderCell(updatedKoop)` neu gerendert.

### Nachtraegliche kooperation_id-Zuweisung

- Im Edit-Flow von Vertraegen (FormSystem/VertragDetail): Beim Update von `kooperation_id` wird geprueft ob `dropbox_file_url` oder `unterschriebener_vertrag_url` gesetzt ist. Falls ja: `bridge.commit({ kooperationId: neueKoopId, intent: 'contract_signed' })`. Falls die alte Kooperation existierte: `bridge.commit({ kooperationId: alteKoopId, intent: 'contract_removed' })`.

### Bestandsdaten-Migration

- SQL-Datei im Repo unter `supabase/migrations/`, manuell in Supabase auszufuehren.
- Inhalt: Das UPDATE-Statement aus dem VertragSyncHelper-Kommentar (Issue #27).

### Rollen und Berechtigungen

- Nur Admin und Mitarbeiter laden unterschriebene Vertraege hoch.
- Kunden sehen den Checkmark als disabled Checkbox (read-only).
- Manuelle Aenderung von `vertrag_unterschrieben` ist in der Kampagnen-Tabelle per Guard blockiert (bestehende Logik).

### Datenmodell-Annahme

- Pro Kooperation existiert in der Regel ein Vertrag. Der Checkmark repraesentiert: "Hat diese Kooperation mindestens einen unterschriebenen Vertrag?"

## Testing Decisions

### Was macht einen guten Test aus

- Tests pruefen nur oeffentliches Verhalten (Funktionsrueckgabewerte, DB-Aufrufe die gemacht werden), nicht interne Implementierung.
- Supabase-Client wird gemockt (wie im bestehenden `createTrackingSupabase` Pattern).
- DOM-Tests verwenden HTML-String-Assertions (wie bestehende `renderVertragCell`-Tests).

### Zu testende Module

1. **VertragBridge** (neu, ersetzt VertragSyncHelper):
   - `deriveVertragStatus`: 4 pure Cases (signed/draft/created/none).
   - `commit` mit `contract_signed`: SELECT vertraege + UPDATE kooperationen → `{ ok: true, status }`.
   - `commit` mit `contract_removed`: reconcile (prueft ob noch andere signed) → UPDATE.
   - `commit` ohne koopId: kein DB-Call → `{ ok: false }`.
   - `commit` bei DB-Fehler: graceful return.
   - `renderCell`: HTML mit checked + Badge-Link bzw. disabled unchecked Checkbox.

2. **VertraegeList** (Bulk-Delete):
   - `deleteSelected`: Sammelt betroffene Kooperation-IDs und ruft `bridge.commit()` auf.
   - `deleteSelected`: Ueberspringt commit fuer Vertraege ohne kooperation_id.

3. **VideoTableRealtimeHandler** (DOM-Update):
   - `handleKooperationUpdate`: Aktualisiert Vertragszelle im DOM wenn `vertrag_unterschrieben` sich aendert.
   - `handleKooperationUpdate`: Ignoriert Updates wenn `vertrag_unterschrieben` unveraendert bleibt.

4. **KampagneDetail** (UI-Refresh):
   - Nach Upload-Callback wird `kooperationenVideoTable.refresh()` aufgerufen.

### Test-Infrastruktur

- Shared Helper: `src/__tests__/helpers/supabaseTracking.js` mit `createTrackingSupabase(config)` (Support fuer `select`, `update`, `delete`, `in`).
- Framework: vitest mit `describe`/`it`/`expect`/`vi`.
- Alle Test-Dateien importieren von der shared Helper-Datei.

## Out of Scope

- **DB-Trigger:** Kein serverseitiger Trigger auf der `vertraege`-Tabelle. Der Sync bleibt clientseitig (JS).
- **Vertrag-Erstellung als Checkmark-Trigger:** Das reine Erstellen/Finalisieren eines Vertrags (ohne Unterschrift) setzt den Checkmark NICHT.
- **Mehrere Kooperationen pro Vertrag:** Ein Vertrag gehoert immer zu maximal einer Kooperation.
- **Offline/Conflict Resolution:** Kein Handling fuer gleichzeitige Aenderungen desselben Vertrags durch mehrere User.
- **Notifications:** Keine Push-Benachrichtigungen wenn sich der Vertragsstatus aendert.

## Architektur-Update: VertragBridge (RFC Issue #28)

Die urspruenglich geplante `reconcileVertragCheckbox`-Funktion wird durch ein tieferes Modul ersetzt: **VertragBridge**. Dies adressiert zusaetzlich 5 architektonische Reibungspunkte (Status-Duplikation, gemischte IO/View-Verantwortlichkeiten, verstreuter Sync, Test-Infra-Duplikat, fehlender Feature-Store).

### Mapping auf TDD-Slices

Die geplanten 10 TDD-Zyklen bleiben bestehen, nutzen aber die Bridge-API:

| Urspruenglich | Neu (Bridge) |
|---------------|-------------|
| `reconcileVertragCheckbox(koopId)` | `bridge.commit({ kooperationId, intent })` |
| `syncVertragCheckbox(koopId, true/false)` | `bridge.commit({ kooperationId, intent: 'contract_signed'/'contract_removed' })` |
| `renderVertragCell(koop)` | `bridge.renderCell(koop)` |
| `VertragUtils.getVertragStatus(v)` / inline Checks | `deriveVertragStatus(v)` (standalone) |

### Slice-Zuordnung der 5 Refactorings

- **Slice 1-4 (VertragSyncHelper / reconcile)**: `bridge.commit()` ersetzt sowohl `syncVertragCheckbox` als auch `reconcileVertragCheckbox`. Intern fuehrt `commit` immer reconcile durch (SELECT + UPDATE). `deriveVertragStatus` wird als standalone pure function extrahiert.
- **Slice 5-7 (Bulk-Delete)**: `deleteSelected()` ruft `bridge.commit({ intent: 'contract_removed' })` fuer jede betroffene Kooperation auf.
- **Slice 8-9 (Realtime DOM)**: `handleKooperationUpdate` nutzt `bridge.refreshFromServer()` + `bridge.renderCell()` fuer DOM-Patches.
- **Slice 10 (KampagneDetail Refresh)**: onSuccess-Callback nutzt `bridge.commit()`.

### Test-Infra Konsolidierung

`createTrackingSupabase` wird in `src/__tests__/helpers/supabaseTracking.js` als Shared-Helper extrahiert (mit Support fuer `select`, `update`, `delete`, `in`). Alle Test-Dateien importieren von dort.

### Migrations-Pfad

1. `VertragBridge.js` + `deriveVertragStatus` erstellen (Slice 1-4)
2. `createTrackingSupabase` Shared-Helper extrahieren
3. 4 Aufrufer von `syncVertragCheckbox` auf `bridge.commit()` umstellen
4. 1 Aufrufer von `renderVertragCell` auf `bridge.renderCell()` umstellen
5. Status-Logik in `KampagneDetail.renderVertraege` durch `deriveVertragStatus` ersetzen
6. `VertragSyncHelper.js` deprecaten/entfernen
7. `VertragUtils.getVertragStatus` als Thin-Wrapper auf `deriveVertragStatus`

## Further Notes

- Die Bestandsdaten-Migration (Issue #27) sollte VOR dem Deploy der neuen Logik ausgefuehrt werden, damit historische Daten korrekt sind.
- Die reconcile-Logik in `bridge.commit()` macht eine zusaetzliche DB-Abfrage pro Aufruf. Bei Bulk-Delete mit vielen Kooperationen koennte das relevant werden. Fuer den aktuellen Anwendungsfall (max. ~50 Vertraege gleichzeitig) ist das akzeptabel.
- Der bestehende Guard in `KampagneKooperationenVideoTable.handleFieldUpdate` (`vertrag_unterschrieben` blockiert fuer manuelle Aenderung) bleibt bestehen.
- Vollstaendiges RFC-Design: GitHub Issue #28.
