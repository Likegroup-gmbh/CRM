# 0042 Die Breadcrumb folgt dem Klickpfad

Die Breadcrumb zeigte immer den offiziellen Weg einer Seite. Wer von einer Produktion ins Casting und dann zum Creator ging, landete in `Creator > Max` und kam nur umständlich zurück. Herkunft gab es nur als `?von=` und nur für Produktion/Kampagne. Jede so erreichte Seite lud Produktion und Kampagne nach (zwei serielle Queries nach dem eigentlichen Entitäts-Load), nur um die Breadcrumb zu beschriften.

## Entscheidung

- Der Klickpfad liegt in `history.state.trail` (Liste aus `{ label, url }`). Beim Navigieren legt der Router einen Schnappschuss der aktuellen Breadcrumb ab; die Labels kommen aus der gerenderten Breadcrumb, nicht aus der Datenbank.
- Regeln (`src/core/breadcrumbTrail.js`, `nextTrail`):
  - Ziel ohne ID (Liste, Sidebar) setzt den Pfad zurück.
  - Gleicher Pfad (Tab-Wechsel, Reload) behält ihn.
  - Ziel steht schon im Pfad: Pfad wird bis davor gekürzt (keine Zyklen).
  - Liste derselben Entität → Detail: offizieller Weg.
  - Geschwister derselben Entität (Switcher) behalten den Pfad.
  - Sonst: Pfad = Schnappschuss der verlassenen Seite (inkl. `?tab=`).
- Module liefern weiter ihren offiziellen Weg (`updateBreadcrumb`) bzw. das Blatt (`updateDetailLabel`). Liegt ein Pfad vor, hängt das System nur das Blatt an — oder setzt den offiziellen Weg ab dem letzten Pfad-Crumb fort (Kampagne → Produktion, Unternehmen → Persona-Form).
- `backTarget(fallback)` (Abbrechen/Speichern) nimmt die letzte Pfad-Ebene.
- `?von=`/`returnTo` und `navHerkunft.js` entfallen vollständig.
- URL-Rewrites ohne Navigation laufen über `replaceRoute`, damit der Pfad im History-Eintrag bleibt.
- Ein Label-Cache (in-memory, nur Entitäts-Pfade) zeigt bekannte Namen sofort statt `...`.

## Verworfen

- `?von=` für alle Entitäten: lange URLs, und ein Kaltstart müsste alle Labels nachladen.
- `?von=` als Fallback nur für Produktion: zwei Mechanismen für dieselbe Sache.

## Folgen

- Neuer Tab und geteilte Links zeigen den offiziellen Weg; Reload, Zurück und Vor behalten den Pfad.
- Ab sieben Ebenen klappt die Mitte in `…` zusammen (Klick klappt auf).
- Inline-Bearbeiten auf der Detailseite hängt `Bearbeiten` als eigenen Crumb an (`showEditLeaf`), statt das Entitäts-Label zu überschreiben.
