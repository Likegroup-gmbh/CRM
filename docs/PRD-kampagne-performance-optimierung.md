# PRD: Kampagne Performance-Optimierung

## Problem Statement

Die Kampagnen-Seiten im CRM sind zu langsam. Die Kampagnen-Liste braucht spürbar lange zum Laden, weil alle Kampagnen ohne Pagination auf einmal geholt werden (`SELECT *` mit mehreren Joins und M:N-Relationen). Die Kampagnen-Detailseite braucht bei Mitarbeitern 10–15 Sekunden zum Laden, weil ~15+ Supabase-Queries in mehreren Wasserfällen ausgeführt werden, Kooperationen doppelt geladen werden und Mitarbeiter-Rollen in 4 separaten Queries statt einer abgefragt werden. Nutzer klicken aus Frustration 3–4 Mal auf den Kampagnennamen, was das System aufhängt, weil jeder Klick einen vollen Init-Zyklus startet und kein Mehrfach-Klick-Schutz existiert. Die Kooperationen-Video-Tabelle auf der Detailseite lädt ebenfalls langsam (3-stufiger Ladevorgang) und das Loading-UI ist inkonsistent (Mix aus Spinner, Ladebalken und Skeleton).

## Solution

Ganzheitliche Performance-Optimierung der Kampagnen-Module durch:

1. **Navigation Guard** gegen Mehrfach-Klicks im zentralen Router
2. **Server-seitige Pagination** für die Kampagnen-Liste (analog zu Creator/Unternehmen/Auftrag)
3. **Query-Konsolidierung** auf der Detailseite (von ~15 auf ~8 Queries)
4. **Ladeoptimierung** der Video-Tabelle (Stufen zusammenfassen, Daten wiederverwenden)
5. **Einheitliches Skeleton-Loading-UI** statt Mix aus Spinner/Ladebalken/Skeleton
6. **DB-Indizes** auf den häufigsten Filter-Spalten

## User Stories

1. Als Mitarbeiter möchte ich, dass die Kampagnen-Liste in unter 2 Sekunden lädt, damit ich effizient arbeiten kann.
2. Als Mitarbeiter möchte ich durch Kampagnen blättern können (Pagination), damit nicht alle auf einmal geladen werden müssen.
3. Als Mitarbeiter möchte ich die Anzahl der Einträge pro Seite selbst wählen können (10/15/25/50), damit ich die Ansicht an meine Bedürfnisse anpasse.
4. Als Mitarbeiter möchte ich, dass die Kampagnen-Detailseite in unter 3 Sekunden lädt, statt 10–15 Sekunden wie bisher.
5. Als Mitarbeiter möchte ich, dass ein Klick auf einen Kampagnennamen sofort visuelles Feedback gibt, damit ich weiß, dass die Navigation gestartet wurde.
6. Als Mitarbeiter möchte ich, dass mehrfaches Klicken auf denselben Link keinen Effekt hat, damit das System nicht aufhängt.
7. Als Mitarbeiter möchte ich sofort ein Skeleton-Layout sehen wenn die Detailseite lädt, statt einen weißen Bildschirm.
8. Als Mitarbeiter möchte ich, dass der Kampagnen-Header (Name, Status, Unternehmen) zuerst angezeigt wird und die Tabs nachgeladen werden (Progressive Loading).
9. Als Mitarbeiter möchte ich, dass die Kooperationen-Video-Tabelle schneller lädt, auch wenn viele Kooperationen existieren.
10. Als Mitarbeiter möchte ich ein einheitliches Lade-Pattern auf der Detailseite sehen (immer Skeleton), statt mal Spinner, mal Ladebalken, mal Skeleton.
11. Als Mitarbeiter möchte ich, dass Filter und Suche in der Kampagnen-Liste weiterhin wie gewohnt funktionieren, auch mit Pagination.
12. Als Mitarbeiter möchte ich, dass der 60-Sekunden-Cache der Kampagnen-Liste weiterhin funktioniert und mit Pagination kompatibel ist.
13. Als Mitarbeiter möchte ich, dass Datenänderungen (neue Kooperation, Statuswechsel) korrekt die relevanten Caches invalidieren.
14. Als Admin möchte ich, dass die Permission-Filterung (nur eigene Kampagnen für Nicht-Admins) auch mit Pagination korrekt funktioniert.

## Implementation Decisions

### Mehrfach-Klick-Schutz (Navigation Guard)

- In `ModuleRegistry.navigateTo()` wird ein `_isNavigating`-Flag eingeführt. Solange eine Navigation läuft, werden weitere `navigateTo()`-Aufrufe ignoriert.
- Visuelles Feedback: Beim Klick auf einen Kampagnennamen wird sofort ein CSS-State gesetzt (z.B. Opacity/Cursor), damit der User sieht "es passiert was".
- Das Flag wird im `finally`-Block zurückgesetzt, egal ob die Navigation erfolgreich war oder nicht.

### Kampagnen-Liste: Server-Pagination

- `KampagneList` wird NICHT auf `BasePaginatedList` umgebaut, da es auch Kanban/Kalender-Views verwaltet. Stattdessen wird `PaginationSystem` direkt integriert (wie `AuftragList`).
- Die Supabase-Query in `loadKampagnenWithRelations()` bekommt `.range(from, to)` mit `{ count: 'exact' }` für die Gesamtzahl.
- `SELECT *` wird durch eine explizite Spaltenliste ersetzt (nur was die Tabelle tatsächlich anzeigt).
- Der `auftrag:auftrag_id(id, auftragsname, auftrag_details(id))` Embed wird entfernt – `auftrag_details` wird in der Liste nicht angezeigt.
- Die doppelte Mitarbeiter-Ladung wird eliminiert: `loadManyToManyRelations` für Mitarbeiter entfällt, nur noch `v_kampagne_mitarbeiter_aggregated` wird genutzt.
- Der ungenutzte `parallelLoad`-Import wird entfernt.
- Kanban und Kalender werden in diesem Durchgang NICHT verändert.
- Der bestehende 60s-Cache (`kampagnenCache`) muss pro Seite/Filter-Kombination arbeiten (Cache-Key um Page erweitern).

### Kampagnen-Detail: Query-Konsolidierung

- **Kooperationen raus aus `loadCriticalData`**: Die `KampagneKooperationenVideoTable` lädt Kooperationen sowieso mit mehr Feldern und Joins. Wenn ein Count für einen Badge im Header nötig ist, wird ein leichtgewichtiger `{ count: 'exact', head: true }`-Query verwendet.
- **Mitarbeiter-Rollen: 4 Queries → 1**: Die 4 einzelnen `kampagne_mitarbeiter`-Queries (cutter, copywriter, strategie, creator_sourcing) werden durch eine einzige Query mit `.in('role', [...])` ersetzt und clientseitig nach Rolle gruppiert.
- **Toter Code fixen**: `loadKampagneData`-Referenzen in Event-Handlern (`entityUpdated`, `softRefresh`, Ansprechpartner-Update) werden durch `loadCriticalData` oder eine neue schlanke Refresh-Methode ersetzt.
- **Doppelter Kampagne-Fetch eliminieren**: `loadColumnVisibilitySettings()` in der VideoTable holt `kampagne` nochmal nur für `video_table_hidden_columns` – stattdessen wird der Wert aus dem bereits geladenen `kampagneData` der Detail-Seite übergeben.

### Video-Tabelle: Ladeoptimierung

- Stufe 2 (Videos, Creator, Verträge) und Stufe 3 (Versand, Assets, Comments) werden in ein einziges `Promise.allSettled` zusammengefasst statt sequentiell.
- Das `Promise.race` mit 3s-Timeout für Assets/Comments wird entfernt. Stattdessen: alles parallel laden, bei Timeout graceful degraden (Daten anzeigen die da sind, Rest nachladen).
- Kooperationen-Daten werden von der Detail-Seite übergeben statt nochmal gefetcht (z.B. über `init(kampagneId, { kooperationen })` Parameter oder Setter).

### Einheitliches Loading-UI

- Detail-Seite bekommt ein Skeleton-Layout das sofort beim Init gerendert wird (vor den Queries).
- Progressive Loading: Kampagne-Header (Name, Status, Unternehmen) wird zuerst gerendert sobald die Kampagne-Query zurückkommt. Tabs werden lazy nachgeladen.
- Die Video-Tabelle hat bereits Skeleton-Loading – das bleibt, aber der separate Spinner/Ladebalken in der Detail-Seite wird durch dasselbe Skeleton-Pattern ersetzt.
- Alle Lade-Zustände nutzen CSS-Klassen aus dem bestehenden Skeleton-System.

### DB-Indizes (Migration)

Neue Migration `supabase/migrations/YYYYMMDD_add_performance_indexes.sql` mit:
- `CREATE INDEX IF NOT EXISTS idx_kooperationen_kampagne_id ON kooperationen(kampagne_id)`
- `CREATE INDEX IF NOT EXISTS idx_kampagne_mitarbeiter_kampagne_id ON kampagne_mitarbeiter(kampagne_id)`
- `CREATE INDEX IF NOT EXISTS idx_kampagne_mitarbeiter_kampagne_role ON kampagne_mitarbeiter(kampagne_id, role)`
- `CREATE INDEX IF NOT EXISTS idx_kooperation_videos_kooperation_id ON kooperation_videos(kooperation_id)`
- `CREATE INDEX IF NOT EXISTS idx_ansprechpartner_kampagne_kampagne_id ON ansprechpartner_kampagne(kampagne_id)`

Alle mit `IF NOT EXISTS`, falls Supabase sie bereits implizit angelegt hat.

## Testing Decisions

### Was einen guten Test ausmacht

Tests prüfen ausschließlich externes Verhalten (Inputs → Outputs), nicht Implementierungsdetails. Supabase-Calls werden über `window.supabase = { from: vi.fn(...) }` gemockt mit verkettbaren Query-Buildern (`.select().eq().range().then()`). Das bestehende Pattern aus `AuftragsdetailsList.test.js` wird als Vorlage verwendet.

### Zu testende Module

1. **Navigation Guard** (`src/__tests__/NavigationGuard.test.js`)
   - Zweiter `navigateTo()`-Call während laufender Navigation wird ignoriert
   - Flag wird nach Fehler korrekt zurückgesetzt
   - Nach Abschluss funktioniert Navigation wieder normal

2. **KampagneList Pagination** (`src/__tests__/KampagneListPagination.test.js`)
   - `.range(from, to)` wird mit korrekten Werten aufgerufen
   - `{ count: 'exact' }` ist im Select
   - Seitenwechsel löst neue Query mit angepasster Range aus
   - Cache-Key enthält Seitennummer
   - Permission-Filter (`allowedIds`) funktioniert mit Pagination

3. **KampagneDetail Query-Konsolidierung** (`src/__tests__/KampagneDetailQueries.test.js`)
   - Mitarbeiter-Rollen kommen in einer einzigen Query (`.in('role', [...])`)
   - Kooperationen werden NICHT in `loadCriticalData` geladen
   - `loadKampagneData`-Referenzen sind bereinigt (keine Laufzeitfehler bei Events)

### Bestehendes Test-Setup
- Framework: vitest + jsdom
- Testverzeichnis: `src/__tests__/`
- Mocking-Pattern: `vi.fn()` für Supabase-Client, chainable Query-Builder
- Vorlagen: `AuftragsdetailsList.test.js` (Pagination), `App.test.js` (Unit-Pattern)

## Out of Scope

- **Kanban-View und Kalender-View** Optimierung (werden separat angegangen)
- **Andere Listen** (Creator, Unternehmen etc.) – die haben bereits Pagination
- **Supabase RPC-Funktionen** – die Optimierungen reichen mit Indizes + Query-Reduktion
- **Offline-/Service-Worker-Caching** – aktuell nicht im Projekt vorhanden, lohnt sich für diesen Scope nicht
- **Realtime-Subscriptions** Optimierung – funktioniert, ist nicht Teil des Ladezeit-Problems
- **Bundle-Size-Optimierung** – Vite Chunking ist bereits konfiguriert

## Further Notes

- Die View `v_kampagne_mitarbeiter_aggregated` ist nicht im Repo definiert (lebt nur in Supabase). Falls die View Performance-Probleme hat, müsste man sie im Supabase Dashboard prüfen und ggf. materialisieren.
- Der `kampagnenCache` mit 60s TTL ist grundsätzlich gut, muss aber mit Pagination kompatibel gemacht werden (Cache-Key um Page/ItemsPerPage erweitern).
- `KampagneFilterLogic.applyVirtualFilters` hat einen Bug: `virtual_creator_count` nutzt `kampagne.kooperationen?.length`, aber die Liste lädt keine Kooperationen. Das sollte auf `creatoranzahl` geändert werden – ist aber ein separater Bugfix.
- Es gibt einen weiteren Bug: `isKampagneCompleted` prüft `kampagne.status?.name`, aber die Liste setzt `status_name` flach. Auch ein separater Fix.
