# Auto-Zuordnung: vertrag_id beim Erstellen einer Rechnung setzen

## Parent PRD

Siehe `docs/PRD-vertragsspalte-rechnungsliste.md`

## What to build

Beim Erstellen einer Rechnung wird der passende unterschriebene Vertrag automatisch ermittelt und als `vertrag_id` gespeichert. Die bestehende `validateVertragForKooperation`-Methode in `RechnungDetail.js` lädt bereits den passenden Vertrag – die gefundene ID muss nur beim Speichern mitgegeben werden.

End-to-end: Validierungslogik liefert Vertrag-ID → wird in die Rechnung geschrieben → nach dem Speichern hat die Rechnung eine `vertrag_id`.

## Acceptance criteria

- [ ] `validateVertragForKooperation` speichert die gefundene `vertrag.id` (z.B. auf `this.foundVertragId`)
- [ ] Beim Erstellen einer Rechnung wird `vertrag_id` in die Daten aufgenommen
- [ ] Nur tatsächlich unterschriebene Verträge werden zugeordnet (Filter: `unterschriebener_vertrag_url` oder `dropbox_file_url` vorhanden)
- [ ] Wenn kein unterschriebener Vertrag gefunden wird, bleibt `vertrag_id` null (kein Fehler)
- [ ] Bestehender Validierungs-Flow (Fehler bei fehlendem Vertrag) bleibt unverändert

## Blocked by

- Blocked by Issue #1 (DB-Migration + DataService)

## User stories addressed

- User Story 4 (Automatische Zuordnung beim Erstellen)
