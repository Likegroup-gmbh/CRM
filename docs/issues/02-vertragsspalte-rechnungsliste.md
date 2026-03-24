# Vertragsspalte in der Rechnungsliste

## Parent PRD

Siehe `docs/PRD-vertragsspalte-rechnungsliste.md`

## What to build

Neue Spalte "Vertrag" in der Rechnungs-Hauptliste (`/rechnung`) nach der Beleg-Spalte. Zeigt einen direkten Link zum unterschriebenen Vertrags-PDF oder ein Warn-Icon, wenn kein Vertrag vorhanden ist.

End-to-end: Header-Spalte → Body-Spalte mit Link/Icon → `VertragUtils.getVertragLinkUrl` für URL-Auflösung → colspan-Anpassung der Loading-Row.

## Acceptance criteria

- [ ] Neue Spalte `<th class="col-vertrag">Vertrag</th>` nach der Beleg-Spalte im Header
- [ ] Rechnung mit Vertrag: Klickbarer Link zum PDF (öffnet in neuem Tab), Linktext ist Vertragsname oder "Vertrag"
- [ ] Rechnung ohne Vertrag: Warn-Icon (⚠) mit Tooltip "Kein unterschriebener Vertrag"
- [ ] Link-Priorität: `dropbox_file_url` > `unterschriebener_vertrag_url` > `datei_url` (via `VertragUtils.getVertragLinkUrl`)
- [ ] Rechnungen ohne `kooperation_id` / ohne `vertrag`-Objekt zeigen Warn-Icon ohne Fehler
- [ ] colspan der Loading-Row um 1 erhöht (Admin: 20, sonst: 19)

## Blocked by

- Blocked by Issue #1 (DB-Migration + DataService)

## User stories addressed

- User Story 1 (Vertrag als klickbarer Link)
- User Story 2 (PDF in neuem Tab)
- User Story 3 (Warn-Icon bei fehlendem Vertrag)
- User Story 7 (Link-Priorität)
- User Story 9 (Edge Case: Rechnungen ohne Kooperation)
- User Story 10 (Vertragsname als Linktext)
