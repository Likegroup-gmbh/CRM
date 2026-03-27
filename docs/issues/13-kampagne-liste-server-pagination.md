# Kampagnen-Liste: Server-Pagination & schlanke Query

## Parent PRD

`docs/PRD-kampagne-performance-optimierung.md`

## What to build

Die Kampagnen-Liste (`KampagneList.js`) von "alles auf einmal laden" auf Server-seitige Pagination umstellen, analog zum bestehenden Pattern in `AuftragList.js`. Gleichzeitig die Query verschlanken: explizite Spalten statt `SELECT *`, unnötige Joins entfernen, doppelten Mitarbeiter-Load eliminieren.

End-to-end:
- `PaginationSystem` in `KampagneList` integrieren (nicht `BasePaginatedList` extenden, da Kanban/Kalender-Views erhalten bleiben)
- In `loadKampagnenWithRelations()`:
  - `SELECT *` → explizite Spaltenliste (nur was die Tabelle anzeigt: id, kampagnenname, eigener_name, start, deadline_*, status_id, creatoranzahl, videoanzahl, created_at, unternehmen_id, marke_id, auftrag_id)
  - `.select(columns, { count: 'exact' })` für Gesamtzahl
  - `.range(from, to)` mit Werten aus `PaginationSystem.getRange()`
  - `auftrag:auftrag_id(id, auftragsname, auftrag_details(id))` Embed entfernen → nur `auftrag:auftrag_id(id, auftragsname)`
  - `loadManyToManyRelations` für Mitarbeiter entfernen → nur `v_kampagne_mitarbeiter_aggregated` nutzen
- Ungenutzten `parallelLoad`-Import entfernen
- Cache-Key um `page` und `itemsPerPage` erweitern
- Pagination-UI unterhalb der Tabelle rendern (Containter-ID im Template)
- PaginationSystem-Init in `initializeFilterBar()` oder separater Methode
- Test: `KampagneListPagination.test.js`

## Acceptance criteria

- [ ] Kampagnen-Liste zeigt standardmäßig 25 Einträge pro Seite
- [ ] Pagination-UI mit "Zeige X-Y von Z", Seitennavigation und Dropdown (10/15/25/50) ist sichtbar
- [ ] Seitenwechsel lädt neue Daten vom Server (`.range()` wird mit korrekten Werten aufgerufen)
- [ ] `{ count: 'exact' }` ist im Select → Gesamtzahl stimmt
- [ ] Explizite Spaltenliste statt `SELECT *` in der Query
- [ ] `auftrag_details` Embed ist entfernt
- [ ] Mitarbeiter werden nur über `v_kampagne_mitarbeiter_aggregated` geladen (kein doppelter Pfad mehr)
- [ ] Ungenutzter `parallelLoad`-Import ist entfernt
- [ ] Filter funktionieren weiterhin korrekt mit Pagination (Seitenwechsel auf 1 bei Filteränderung)
- [ ] Suche funktioniert weiterhin mit Debounce
- [ ] Cache-Key enthält Page + ItemsPerPage
- [ ] Permission-Filter (`allowedIds`) funktioniert mit `.range()`
- [ ] Kanban- und Kalender-View sind unverändert und funktionieren weiterhin
- [ ] Test `KampagneListPagination.test.js` prüft: Range-Werte, count: exact, Seitenwechsel, Cache-Key, Permission-Filter

## Blocked by

- Blocked by Issue 12 (DB-Indizes sollten vorher da sein für optimale Query-Performance)

## User stories addressed

- User Story 1: Kampagnen-Liste in unter 2 Sekunden
- User Story 2: Durch Kampagnen blättern (Pagination)
- User Story 3: Einträge pro Seite wählbar
- User Story 11: Filter und Suche funktionieren mit Pagination
- User Story 12: 60s-Cache kompatibel mit Pagination
- User Story 14: Permission-Filterung funktioniert mit Pagination
