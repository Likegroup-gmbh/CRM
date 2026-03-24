# DB-Migration + DataService: vertrag_id auf Rechnung

## Parent PRD

Siehe `docs/PRD-vertragsspalte-rechnungsliste.md`

## What to build

Neues FK-Feld `vertrag_id` auf der `rechnung`-Tabelle anlegen und den DataService so erweitern, dass Vertragsdaten beim Laden der Rechnungen per JOIN mitgeliefert werden. Diese Slice liefert die Datengrundlage für alle weiteren Slices.

End-to-end: SQL-Migration → Entity-Config in DataService → Supabase-Query-JOIN → Vertragsdaten sind auf jedem geladenen Rechnungs-Objekt verfügbar.

## Acceptance criteria

- [ ] SQL-Migration `20260324_add_vertrag_id_to_rechnung.sql` erstellt `vertrag_id uuid REFERENCES public.vertraege(id)` auf `public.rechnung`
- [ ] `rechnung.fields` in DataService enthält `vertrag_id: 'uuid'`
- [ ] `rechnung.relations` in DataService enthält `vertrag: { table: 'vertraege', foreignKey: 'vertrag_id', displayField: 'name' }`
- [ ] Supabase-Query im `rechnung`-Zweig von `loadEntities` joined `vertrag:vertrag_id (id, name, unterschriebener_vertrag_url, dropbox_file_url, datei_url)`
- [ ] Geladene Rechnungen haben ein `vertrag`-Objekt (oder `null`) auf dem Datenobjekt
- [ ] Bestehende Rechnungen funktionieren weiterhin (nullable FK, kein Backfill)

## Blocked by

None - kann sofort gestartet werden.

## User stories addressed

- User Story 8 (Performance: Daten per JOIN statt N+1 Queries)
