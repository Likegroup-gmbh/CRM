# Detail-Seite: Query-Konsolidierung & Skeleton-UI

## Parent PRD

`docs/PRD-kampagne-performance-optimierung.md`

## What to build

Die Kampagnen-Detailseite (`KampagneDetail.js`) von ~15 Queries auf ~8 reduzieren, toten Code bereinigen und ein einheitliches Skeleton-Loading-UI einführen, damit der User sofort eine Seitenstruktur sieht statt 10-15 Sekunden weißen Bildschirm.

End-to-end:

**Query-Konsolidierung:**
- Kooperationen-Query aus `loadCriticalData()` entfernen (werden sowieso von `KampagneKooperationenVideoTable` mit mehr Feldern geladen). Falls Koops-Count für Badge nötig: `.select('id', { count: 'exact', head: true })` Count-only-Query
- 4 separate `kampagne_mitarbeiter`-Queries (cutter, copywriter, strategie, creator_sourcing) → 1 Query mit `.in('role', ['cutter','copywriter','strategie','creator_sourcing'])`, clientseitig nach Rolle gruppieren
- `loadColumnVisibilitySettings()` in VideoTable: Kampagne-Daten von Detail-Seite übergeben statt nochmal fetchen

**Toter Code fixen:**
- `loadKampagneData`-Referenzen in Event-Handlern (`entityUpdated`, `softRefresh`, Ansprechpartner-Update) durch `loadCriticalData` oder eine neue schlanke Refresh-Methode ersetzen

**Skeleton-UI:**
- Skeleton-Layout beim Init sofort rendern (vor allen Queries)
- Progressive Loading: Kampagne-Header (Name, Status, Unternehmen) rendern sobald die erste Query zurückkommt
- Tabs lazy nachladen: aktiver Tab wird zuerst geladen, Rest on-demand beim Tab-Wechsel
- Konsistentes Skeleton-Pattern (gleiche CSS-Klassen wie VideoTable)

**Test:** `KampagneDetailQueries.test.js`

## Acceptance criteria

- [ ] Kooperationen werden NICHT mehr in `loadCriticalData()` geladen
- [ ] Mitarbeiter-Rollen kommen in einer einzigen Supabase-Query (`.in('role', [...])`)
- [ ] Kampagne wird nur einmal gefetcht (kein zweiter Fetch in `loadColumnVisibilitySettings`)
- [ ] Keine Referenz auf `loadKampagneData` mehr im Code (alle durch funktionierenden Methodennamen ersetzt)
- [ ] Beim Navigieren zur Detailseite erscheint sofort ein Skeleton-Layout (kein weißer Bildschirm)
- [ ] Kampagne-Header (Name, Status, Unternehmen) wird zuerst gerendert, bevor alle Tabs fertig sind
- [ ] Tab-Daten werden lazy geladen (erst beim Wechsel zum Tab)
- [ ] Skeleton-CSS-Klassen sind konsistent mit dem bestehenden Pattern in der VideoTable
- [ ] Event-Handler (`entityUpdated`, `softRefresh`) funktionieren fehlerfrei nach dem Refactoring
- [ ] Test `KampagneDetailQueries.test.js` prüft: eine Mitarbeiter-Query, keine Koops in loadCriticalData, keine Laufzeitfehler bei Events

## Blocked by

- Blocked by Issue 12 (DB-Indizes für optimale Query-Performance)

## User stories addressed

- User Story 4: Detail-Seite in unter 3 Sekunden
- User Story 7: Sofort Skeleton sehen statt weißen Bildschirm
- User Story 8: Header zuerst, Tabs nachladen (Progressive Loading)
- User Story 10: Einheitliches Lade-Pattern (immer Skeleton)
- User Story 13: Cache-Invalidierung bei Datenänderungen funktioniert korrekt
