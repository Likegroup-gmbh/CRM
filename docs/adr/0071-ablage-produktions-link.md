# 0071 Ablage: Kunden-Leselink auf den Produktions-Ordner

Der Ordner-Link im Videos-Tab zeigt auf `Videos/` einer einzelnen Kooperation. Eine Produktion hat aber oft viele Creator. Für jeden einen eigenen Link zu verschicken ist mühsam, und der Kunde muss sich die Links selbst zusammensuchen. Seit ADR 0069 gibt es in SharePoint einen Ordner je Produktion, unter dem alle Kooperationen liegen. Ein Link auf diesen Ordner reicht, und der Kunde navigiert darin selbst.

## Entscheidung

- **Zweiter Link, der erste bleibt:** Der Ordner-Link der Kooperation (`Videos/`, Team und Kunden) ändert sich nicht. Neu ist ein Link auf den Produktions-Ordner (`ablage_ordner.art = 'produktion'`).
- **Gleiche Eckdaten:** anonym („Jeder mit dem Link“), nur Ansicht, 365 Tage, `retainInheritedPermissions`. Ein aktiver Link mit mehr als 90 Tagen Restlaufzeit wird wiederverwendet. Lehnt der Tenant das Ablaufdatum ab, gibt es einen zweiten Versuch ohne Ablauf. Kommt dabei ein unbefristeter Link zurück, wird er sofort wieder entfernt. Erstellen, Wiederverwenden und Speichern laufen für beide Links über denselben Code (`linkFuerOrdner`).
- **Nur Team:** `ablage-freigabe` mit `{ aktion: 'erstellen' | 'liste', produktion_id }`.
  - Kunden und Gäste bekommen 403 (`istStaff`).
  - Die Produktion muss für den Aufrufer sichtbar sein (`sichtbar(caller, 'produktion', id)`, RLS `produktion_select` über die Kampagne), sonst 404.
  - Fehlt der Produktions-Ordner im Register, kommt 409 `nicht_sharepoint`. Die Produktion hat dann noch keine Datei in SharePoint.
  - `widerrufen` prüft je nach Zeile die Kooperation oder die Produktion.
- **Daten:** `ablage_freigabelink.produktion_id` (FK `ON DELETE SET NULL`), `kooperation_id` wird nullable, `ordner_art = 'produktion'`. Mit SET NULL bleibt ein Link nach dem Löschen der Produktion als Zeile stehen und lässt sich widerrufen. Der leere Ordner bleibt laut ADR 0069 ohnehin. Die Select-Policy lässt Admins und Mitarbeiter Zeilen zu sichtbaren Produktionen lesen. Der Client liest die Tabelle nicht direkt, die Policy ist also nur der Vollständigkeit halber da.
- **Rechte-Abgleich:**
  - Der Link unterbricht in SharePoint die Vererbung am Produktions-Ordner. Ohne Gegenmaßnahme bekämen später zugeordnete Mitarbeiter dort im Finder keinen Zugriff. Ein Produktions-Ordner mit aktivem Link läuft deshalb wie der Typ-Ordner mit Link mit der Kampagne mit (`mitlaufen`). Ohne Link bleibt er unverwaltet und erbt.
  - `laden()` holt die Link-Ordner für `art IN ('typ', 'produktion')` nach.
  - `linkEntzogen`: Ein Link ohne Kooperation bleibt nur, solange der Ersteller Admin oder Mitarbeiter ist. Wie beim Kooperations-Link gilt das auch dann, wenn der Ersteller gesperrt wird. Ist der Ersteller ein Kunde oder unbekannt, wird der Link widerrufen.
  - Löschen (`kaskadeLoeschen`) und Umsortieren (`aufraeumen`) widerrufen Links per `item_id`, das gilt also auch für Produktions-Ordner. Ein Graph-Move oder Umbenennen ändert die `item_id` nicht, der Link bleibt gültig.
- **Videos-Tab:** Icon-Button `link` in der Leiste der Spalte „Kooperationen“, neben „Alle einklappen“. Er erscheint nur im Team-Modus, nie für Gäste, nur mit `detail.produktionId` und nur, wenn mindestens eine Kooperation Dateien in SharePoint hat. Der Tooltip sagt, dass auch das Rohmaterial mitgeht. Clipboard (Safari-Trick, Prompt als Fallback), Toast mit Ablaufdatum und Busy-Zustand teilt sich der Button mit dem Ordner-Link (`linkErstellen`).

## Verworfen

- **Link auf den Kampagnen-Ordner.** Kampagnen-Ordner sind verwaltet (eigene Rechte, sobald Zuordnungen dazukommen), und unter ihnen liegen auch fremde Produktionen. Der Kunde soll nur die eine Produktion sehen.
- **Rohmaterial ausnehmen.** Dafür müsste an jedem `Rohmaterial/` die Vererbung unterbrochen werden. Das sind viele eigene SharePoint-Scopes, die der Abgleich pflegen müsste, und ob anonyme Links sich daran halten, ist ungeprüft. Wir nehmen es hin und weisen im Tooltip darauf hin.
- **Eigener Kunden-Ordner nur mit Finals.** Das wäre sauberer, braucht aber Kopien oder Verknüpfungen und einen eigenen Sync. Kommt in Frage, wenn Rohmaterial beim Kunden zum Problem wird.
- **Button auch für Kunden.** Kunden sehen im CRM nur ihre Kooperationen, der Produktions-Ordner kann mehr enthalten. Für sie bleibt der Ordner-Link der Kooperation.

## Folgen

- Der Kunde sieht im Produktions-Ordner alles: alle Kooperationen, Feedbackschleifen und `Rohmaterial/` jedes Creators.
- Deploy-Reihenfolge:
  1. Migration `20261213_ablage_freigabelink_produktion.sql`. Rollback steht im Kopf der Datei. Ohne die Spalte schlägt der Insert fehl, also nicht umdrehen.
  2. Functions.
  3. Client.
- Voraussetzung: Die Site „Medienablage“ erlaubt in den Freigabe-Einstellungen „Anyone“. Sonst kommt 409 `links_gesperrt`, genau wie beim Ordner-Link.
- Produktionen ohne SharePoint-Ordner (nur Dropbox-Bestand, ADR 0065) bekommen keinen Button bzw. 409.
