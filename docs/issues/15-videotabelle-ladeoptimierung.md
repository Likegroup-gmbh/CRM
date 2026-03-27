# Video-Tabelle: Ladeoptimierung & einheitliches Loading-UI

## Parent PRD

`docs/PRD-kampagne-performance-optimierung.md`

## What to build

Die `KampagneKooperationenVideoTable` optimieren: Lade-Stufen zusammenfassen, redundante Fetches eliminieren und das Loading-UI auf ein konsistentes Skeleton-Pattern vereinheitlichen. Aktuell lädt die Tabelle in 3 sequentiellen Stufen (Kooperationen → Videos/Creator/Verträge → Versand/Assets/Comments) und fetcht Kooperationen erneut, obwohl die Detail-Seite sie bereits hat.

End-to-end:

**Ladeoptimierung:**
- Stufe 2 (Videos, Creator, Verträge) und Stufe 3 (Versand, Assets, Comments) in ein einziges `Promise.allSettled` zusammenfassen
- `Promise.race` mit 3s-Timeout für Assets/Comments entfernen → alles parallel laden, bei Timeout graceful degraden (Tabelle mit verfügbaren Daten anzeigen, fehlende Daten nachladen wenn sie kommen)
- Kooperationen-Daten von `KampagneDetail` entgegennehmen statt nochmal fetchen: entweder über `init(kampagneId, { kooperationen })` Parameter oder Setter-Methode
- Doppelten Kampagne-Fetch in `loadColumnVisibilitySettings()` eliminieren (Daten von Detail-Seite nutzen, siehe Issue 14)

**Einheitliches Loading-UI:**
- Bestehenden Mix aus Spinner und Ladebalken durch konsistentes Skeleton ersetzen
- Das Skeleton-Pattern der VideoTable (`renderSkeletonLoading()`) bleibt Basis, aber Spinner/Ladebalken-Elemente in der Detail-Seite werden durch dasselbe Pattern ersetzt

## Acceptance criteria

- [ ] Videos, Creator, Verträge, Versand, Assets und Comments werden in einem einzigen `Promise.allSettled` geladen (keine sequentiellen Stufen mehr)
- [ ] Kein `Promise.race` mit Timeout mehr für Assets/Comments
- [ ] Kooperationen werden nicht erneut gefetcht wenn sie von der Detail-Seite übergeben wurden
- [ ] Kampagne-Daten werden nicht erneut gefetcht (über Parameter von Detail-Seite)
- [ ] Bei Teilerfolg (z.B. Assets-Query schlägt fehl) wird die Tabelle trotzdem mit den verfügbaren Daten angezeigt
- [ ] Kein Spinner oder Ladebalken mehr - nur noch Skeleton-Pattern
- [ ] Loading-UI ist visuell konsistent zwischen Detail-Seite und Video-Tabelle
- [ ] `refresh()` funktioniert weiterhin korrekt (z.B. nach Datenänderung)
- [ ] Realtime-Handler (`VideoTableRealtimeHandler`) funktioniert weiterhin

## Blocked by

- Blocked by Issue 14 (Detail-Seite muss Kooperationen-Daten übergeben können + Kampagne-Daten weitergeben)

## User stories addressed

- User Story 9: Kooperationen-Video-Tabelle schneller laden
- User Story 10: Einheitliches Lade-Pattern (Skeleton statt Spinner/Ladebalken-Mix)
