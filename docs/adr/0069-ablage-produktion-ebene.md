# 0069 Ablage: Produktion als Ordner-Ebene

In SharePoint lag unter der Kampagne direkt die Kooperation (`Medien/<Marke>/<Kampagne>/<Kooperation>/…`). Eine Kampagne hat aber oft mehrere Produktionen. Beim RECOVERY KIT sind es fünf, und alle Creator lagen gemischt in einem Ordner. Im CRM ändert sich nichts: Die Produktion bleibt `kooperationen.produktion_id` bzw. `vertraege.produktion_id`. Neu ist nur die Ebene im Finder und in SharePoint.

## Entscheidung

- **Pfad:**
  - Medien: `Daten/<Firma>/Medien/[<Marke>/]<Kampagne>/[<Produktion>/]<Kooperation>/Videos/Video_N/…`
  - Verträge: `Daten/<Firma>/Verträge/[<Marke>/]<Kampagne>/[<Produktion>/]`
  - Rechnungen und Aufträge bekommen keine Produktions-Ebene.
- **Name** ist der Produktionsname 1:1, bereinigt wie alle Ordnernamen (`bereinigen`, max. 40 Zeichen, hart abgeschnitten). Ohne Namen heißt der Ordner „Produktion“. Bei Gleichstand gibt es den Zähler „(2)“.
- **Ohne Produktion** liegt die Kooperation bzw. der Vertrag wie bisher direkt in der Kampagne. Es gibt keinen Sammelordner „Ohne Produktion“.
- **Register:**
  - Medien: `ablage_ordner.art = 'produktion'` mit neuer Spalte `produktion_id`. Je Drive und Produktion gibt es einen Ordner (`ux_ablage_ordner_produktion`).
  - Verträge: `art = 'dokument'`, `ebene = 'produktion'`, `dok_schluessel = vertraege:<Unternehmen>:produktion:<Produktion>`.
  - `produktion_id` steht in `BESITZ`. Freie Ordner unter der Produktion erben sie.
  - Die FK steht auf `ON DELETE SET NULL`. Fällt eine Produktion weg, zieht die Kooperation zurück in die Kampagne, und der leere Produktions-Ordner bleibt stehen.
- **Neue Ordner:**
  - `kette()` hängt die Kooperation unter die Produktion, wenn `koop.produktion_id` gesetzt ist.
  - `dokumentEbenen()` ergänzt für Verträge die Produktion, aber nur, wenn sie zur Kampagne des Vertrags gehört.
  - Alle Wege laufen über `kette()` bzw. `dokumentKette()`: Upload, Creator-Upload, Gerüst, Bestandsumzug und Bild verschieben. Keiner braucht einen Sonderfall.
- **Beweglich:**
  - `produktion` steht in `BEWEGLICH`. Wechselt die Linie (`linieVerschieben`) oder die Produktion, hängt `umhaengen()` den Kooperations-Ordner per Graph-Move um. Die `item_id` bleibt, `ablage_pfad_umschreiben` und `ablage_url_umschreiben` ziehen Pfade und Links nach.
  - Vertrags-PDFs sind keine Fachordner. `struktur.js` verschiebt sie einzeln, aber nur, wenn sie direkt im Kampagnen- oder Produktions-Ordner liegen. Was im Finder in einen freien Unterordner gelegt wurde, bleibt dort (ADR 0068).
- **Bestand und Pflege:**
  - Die RPC `ablage_struktur_offen` findet Kooperationen und Verträge, deren Ordner nicht zur Produktion passt.
  - Der Abgleich zieht je Lauf bis zu 5 davon nach (`strukturNachziehen`). Fehlt die RPC, etwa weil die Migration noch nicht da ist, wird das als Fehler gezählt, und der Abgleich läuft weiter.
  - Umsortieren bekommt eine dritte Phase nach den Bereichen: `produktionenEinfuehren`. Der Trockenlauf zählt sie in `zaehler.produktion` (`kooperationen`, `vertraege`, `neu`).
  - Der Namensabgleich zieht Produktions-Ordner nach, wenn die Produktion im CRM umbenannt wird.
- **Finder:**
  - Produktions-Ordner sind Fachordner. Umbenennen oder Verschieben im Finder dreht das CRM zurück.
  - Dateien direkt im Produktions-Ordner landen in Nicht zugeordnet.
  - Rechte: Der Ordner ist nicht verwaltet und erbt von der Kampagne.

## Verworfen

- **Produktion im Kooperationsnamen** (`<Produktion> – <Creator>`). Damit wird nichts gruppiert, und die Namen werden noch länger.
- **Sammelordner „Ohne Produktion“.** Das ist ein zusätzlicher Move für jeden Altbestand, der nichts sortiert.
- **Produktion auch unter Rechnungen.** Rechnungen hängen an Kampagne oder Auftrag, nicht an einer Produktion.
- **Kurzname oder Nummer statt Name.** Im Finder soll man die Produktion erkennen, ohne ins CRM zu schauen.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261211_ablage_produktion.sql`. Sie setzt `20261210` voraus. Rollback steht im Kopf der Datei.
  2. Functions.
  3. Client.
  4. Umsortieren zuerst auf der Test-Site laufen lassen, dann auf Live Unternehmen für Unternehmen, jeweils nach dem Trockenlauf.
- Auch ohne Umsortieren zieht der Abgleich den Bestand nach und nach um, 5 Einträge je Lauf.
- Lange Produktionsnamen werden mitten im Wort abgeschnitten („STAY LOOSE — Creator-Kampagne Recovery K“).
- Pfade ändern sich, also entstehen die betroffenen Poster neu (wie in ADR 0067).
- Ordner-Links außerhalb des CRM zeigen auf den alten Pfad.
- Die Dropbox-Ablage bleibt, wie sie ist (eingefroren, ADR 0065).
