# DB Performance-Indizes für Kampagnen-Queries

## Parent PRD

`docs/PRD-kampagne-performance-optimierung.md`

## What to build

Eine Supabase-Migration mit Indizes für die am häufigsten gefilterten Spalten in Kampagnen-bezogenen Queries. Diese Indizes beschleunigen die `.eq('kampagne_id', ...)` und `.in('kampagne_id', [...])` Aufrufe, die sowohl in der Liste als auch auf der Detailseite massiv genutzt werden.

HITL: Vor Anwendung im Supabase Dashboard prüfen, ob die Indizes bereits existieren (z.B. implizit durch Foreign Keys). `IF NOT EXISTS` schützt zwar vor Fehler, aber bestehende Indizes sollten nicht doppelt angelegt werden.

End-to-end:
- Neue Migration `supabase/migrations/YYYYMMDD_add_performance_indexes.sql`
- `CREATE INDEX IF NOT EXISTS idx_kooperationen_kampagne_id ON kooperationen(kampagne_id)`
- `CREATE INDEX IF NOT EXISTS idx_kampagne_mitarbeiter_kampagne_id ON kampagne_mitarbeiter(kampagne_id)`
- `CREATE INDEX IF NOT EXISTS idx_kampagne_mitarbeiter_kampagne_role ON kampagne_mitarbeiter(kampagne_id, role)`
- `CREATE INDEX IF NOT EXISTS idx_kooperation_videos_kooperation_id ON kooperation_videos(kooperation_id)`
- `CREATE INDEX IF NOT EXISTS idx_ansprechpartner_kampagne_kampagne_id ON ansprechpartner_kampagne(kampagne_id)`

## Acceptance criteria

- [ ] Migration-Datei existiert unter `supabase/migrations/`
- [ ] Alle 5 Indizes sind mit `IF NOT EXISTS` definiert
- [ ] Migration läuft ohne Fehler auf der Supabase-Instanz
- [ ] Prüfung im Supabase Dashboard bestätigt, dass die Indizes angelegt wurden
- [ ] Keine bestehenden Queries werden negativ beeinflusst

## Blocked by

None - kann sofort starten (parallel zu Issue 11).

## User stories addressed

- User Story 1: Kampagnen-Liste in unter 2 Sekunden (DB-Grundlage)
- User Story 4: Detail-Seite in unter 3 Sekunden (DB-Grundlage)
- User Story 9: Kooperationen-Video-Tabelle schneller laden
