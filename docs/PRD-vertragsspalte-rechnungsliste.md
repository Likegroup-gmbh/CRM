# PRD: Vertragsspalte in der Rechnungsliste

## Problem Statement

CRM-Nutzer, die mit der Rechnungsliste arbeiten, haben aktuell keine Möglichkeit, direkt aus der Liste heraus den zugehörigen unterschriebenen Vertrag einzusehen. Um den Vertrag zu finden, müssen sie manuell über die Kooperation oder Kampagne navigieren und dort im Vertrags-Tab suchen. Das kostet Zeit und ist fehleranfällig, insbesondere bei der Prüfung offener Rechnungen.

## Solution

In der Rechnungs-Hauptliste (`/rechnung`) wird eine neue Spalte **"Vertrag"** nach der bestehenden Beleg-Spalte eingefügt. Diese Spalte zeigt einen direkten Link zum unterschriebenen Vertrags-PDF (öffnet in neuem Tab). Wenn kein unterschriebener Vertrag existiert, wird ein Warn-Icon angezeigt. Die Zuordnung erfolgt über ein neues FK-Feld `vertrag_id` direkt auf der `rechnung`-Tabelle. Beim Erstellen einer Rechnung wird der passende unterschriebene Vertrag automatisch zugeordnet. Nachträglich kann der Vertrag auch manuell im Rechnungsformular geändert werden.

## User Stories

1. Als CRM-Nutzer möchte ich in der Rechnungsliste den zugehörigen Vertrag als klickbaren Link sehen, damit ich den Vertrag direkt öffnen kann, ohne durch andere Module navigieren zu müssen.
2. Als CRM-Nutzer möchte ich, dass der Link zum unterschriebenen Vertrags-PDF in einem neuen Tab öffnet, damit ich Rechnung und Vertrag parallel einsehen kann.
3. Als CRM-Nutzer möchte ich ein Warn-Icon sehen, wenn zu einer Rechnung kein unterschriebener Vertrag vorhanden ist, damit ich fehlende Verträge schnell identifizieren kann.
4. Als CRM-Nutzer möchte ich, dass beim Erstellen einer Rechnung der passende unterschriebene Vertrag automatisch zugeordnet wird, damit ich die Zuordnung nicht manuell vornehmen muss.
5. Als CRM-Nutzer möchte ich den zugeordneten Vertrag einer Rechnung nachträglich im Formular ändern können, damit ich Fehlzuordnungen korrigieren kann.
6. Als CRM-Nutzer möchte ich im Vertrags-Dropdown nur Verträge sehen, die zur selben Kooperation/Kampagne/Creator gehören, damit ich nicht versehentlich einen falschen Vertrag zuordne.
7. Als CRM-Nutzer möchte ich, dass die Vertragsspalte die Priorität Dropbox-URL > Unterschriebene-URL > Standard-PDF-URL einhält, damit immer die relevanteste Version des Vertrags verlinkt wird.
8. Als CRM-Nutzer möchte ich, dass die Rechnungsliste auch bei vielen Rechnungen performant bleibt, obwohl eine neue Spalte mit Vertragsdaten geladen wird.
9. Als CRM-Nutzer möchte ich, dass Rechnungen ohne Kooperation (und damit ohne möglichen Vertrag) korrekt behandelt werden, ohne Fehler in der Liste zu verursachen.
10. Als CRM-Nutzer möchte ich, dass der Vertragsname oder ein generisches Label ("Vertrag") als Linktext angezeigt wird, damit klar ist, worum es sich handelt.

## Implementation Decisions

### Datenbank

- **Neue Spalte:** `vertrag_id uuid REFERENCES public.vertraege(id)` auf `public.rechnung`
- **Kein Backfill** für bestehende Rechnungen – die Spalte wird nur für neue/bearbeitete Rechnungen befüllt
- **Nullable:** Nicht jede Rechnung hat zwingend einen Vertrag

### Entity-Config (DataService)

- `rechnung.fields` wird um `vertrag_id: 'uuid'` erweitert
- `rechnung.relations` wird um `vertrag: { table: 'vertraege', foreignKey: 'vertrag_id', displayField: 'name' }` erweitert
- Der Supabase-Query im `rechnung`-Zweig von `loadEntities` wird um einen JOIN auf `vertraege` erweitert, der `id`, `name`, `unterschriebener_vertrag_url`, `dropbox_file_url` und `datei_url` mitlädt

### Rechnungsliste

- Neue Spalte "Vertrag" wird **nach der Beleg-Spalte** eingefügt
- **Mit Vertrag:** Klickbarer Link zum PDF (via bestehende `VertragUtils.getVertragLinkUrl`-Logik)
- **Ohne Vertrag:** Warn-Icon (⚠) mit Tooltip "Kein unterschriebener Vertrag"
- `colspan` der Loading-Row wird um 1 erhöht

### Rechnungserstellung

- In der bestehenden `validateVertragForKooperation`-Methode wird die gefundene `vertrag.id` gespeichert und beim Erstellen der Rechnung als `vertrag_id` mitgegeben
- Die Methode filtert bereits auf `is_draft = false` – zusätzlich wird auf vorhandene `unterschriebener_vertrag_url` oder `dropbox_file_url` geprüft, um nur tatsächlich unterschriebene Verträge zuzuordnen

### Rechnungsformular (Bearbeitung)

- Im Formular wird ein optionales Dropdown-Feld für `vertrag_id` hinzugefügt
- Verfügbare Verträge werden über die `kooperation_id` der Rechnung geladen (via `VertragRepository.loadByKooperation`)
- Nur finale (nicht-Entwurf) Verträge werden als Optionen angeboten

### Link-Auflösung (Priorität)

Bestehende Logik in `VertragUtils.getVertragLinkUrl`:
1. `dropbox_file_url`
2. `unterschriebener_vertrag_url`
3. `datei_url`

## Testing Decisions

**Gute Tests** testen das externe Verhalten, nicht Implementierungsdetails. Sie prüfen "Was kommt raus?", nicht "Wie wird es intern berechnet?".

### Module die getestet werden

1. **Vertragszuordnungslogik** – Integration-Test: Rechnung erstellen → prüfen, dass `vertrag_id` korrekt gesetzt wird
2. **Rechnungsliste Rendering** – Integration-Test: Rechnungen mit/ohne Vertrag laden → prüfen, dass Spalte korrekt gerendert wird (Link vs. Warn-Icon)
3. **VertragUtils.getVertragLinkUrl** – bereits getestet in `src/__tests__/VertragUtils.test.js`, Erweiterung nur falls neue Fälle hinzukommen

### Prior Art

- `src/__tests__/VertragRepository.test.js` – Mocked Supabase Client, testet Laden von Verträgen per Kooperation/Kampagne
- `src/__tests__/VertragUtils.test.js` – Utility-Funktionen für Link-URL und Status
- `src/__tests__/VertragSyncHelper.test.js` – Sync-Logik zwischen Vertrag und Kooperation
- Vitest als Test-Framework, `vi.fn()` für Mocks

## Out of Scope

- Vertragsspalte in eingebetteten Rechnungstabellen (Auftrag-Detail, Unternehmen-Detail, Kampagne-Detail) – nur die Hauptliste `/rechnung` wird angepasst
- Backfill bestehender Rechnungen mit `vertrag_id`
- Änderungen am Vertrags-Modul selbst
- RLS-Policies für die neue Spalte (nutzt bestehende Rechnung-Policies)

## Further Notes

- Die `rechnung`-Tabelle hat bereits einen DB-Trigger `RECHNUNG_VERTRAG_REQUIRED`, der prüft, ob ein finaler Vertrag existiert. Dieser Trigger arbeitet über `creator_id + kampagne_id` und ist unabhängig vom neuen `vertrag_id`-Feld.
- Langfristig könnte der Backfill für bestehende Rechnungen als separates Ticket nachgezogen werden, um die Vertragsspalte auch für historische Daten nutzbar zu machen.
- Die Prioritäts-Reihenfolge für den Vertragslink (Dropbox > Unterschrieben > Standard) ist bereits in `VertragUtils.getVertragLinkUrl` implementiert und wird wiederverwendet.
