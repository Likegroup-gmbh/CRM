# 0067 Ablage: Daten / Unternehmen / Bereich

Die SharePoint-Bibliothek hieß „Videos“, direkt darunter lagen `Unternehmen/Marke/Kampagne/Kooperation/…`. Als Nächstes sollen Verträge, Skripte und was Creator sonst schicken beim Kunden landen. Dafür fehlte eine Ebene unter dem Unternehmen, und der Name „Videos“ passte nicht mehr.

## Entscheidung

- **Bibliothek „Daten“.** Nur der Anzeigename ändert sich. URL (`/Videos`), Drive-ID und alle `item_id`s bleiben. `site-einrichten.mjs` findet die Bibliothek unter „Daten“ oder „Videos“ und setzt `Title` per `MERGE` auf `SP.List`.
- **Bereiche unter dem Unternehmen:**
  - `Medien/` nimmt alles auf, was bisher direkt unter dem Unternehmen lag (Marke, Kampagne, Kooperation, …).
  - `Verträge/` ist neu. Pfad: `Daten/<Firma>/Medien/<Marke>/<Kampagne>/<Kooperation>/Videos/Video_N/…` bzw. `Daten/<Firma>/Verträge/`.
- **Register:**
  - Bereichsordner haben `art = 'bereich'` und die Spalte `bereich` (`medien` | `vertraege`).
  - Je Drive und Unternehmen gibt es einen Ordner je Bereich (`ux_ablage_ordner_bereich`).
  - Freie Ordner darin erben `bereich` über `besitzVon`.
  - `kette()` legt `Medien/` an, `geruest()` zusätzlich `Verträge/`.
  - Ein weiterer Bereich braucht einen neuen Wert im CHECK und in `BEREICH_ORDNER`.
- **Rechte:**
  - Bereiche sind nicht verwaltet und erben vom Unternehmen, also Admins plus zugeordnete Mitarbeiter, wie bei den Videos.
  - Ein freier Ordner direkt in `Verträge/` zählt als oberster freier Ordner, genau wie bisher direkt unter dem Unternehmen.
- **Abgleich:**
  - `Medien` oder `Verträge`, im Finder unter dem Unternehmen angelegt, wird als Bereich registriert. Das gilt auch für die NFD-Form, die der Finder für Umlaute liefert; NFD gegen NFC zählt nicht als Umbenennung.
  - Dateien in `Verträge/` werden ignoriert, bis der Vertrags-Upload kommt.
  - Dateien direkt in `Medien/` landen in Nicht zugeordnet.
  - Umbenennen oder Verschieben eines Bereichs im Finder dreht das CRM zurück.
- **webUrls ziehen mit.**
  - Graph-webUrls sind pfadbasiert. Bisher blieben `file_url`, `folder_url`, `story_folder_url` und `bilder_folder_url` nach jedem CRM-Move oder -Rename auf dem alten Pfad stehen.
  - Neu ersetzt `ablage_url_umschreiben` den Präfix. `umhaengen`, `umbenennen` und `zurueckBenennen` rufen es auf.
  - `umhaengen` setzt das Register vor dem Graph-Move, sonst hält der Abgleich den Move für eine Finder-Verschiebung und nimmt ihn zurück. Scheitert der Move, wird das Register zurückgesetzt.
- **Bestand:**
  - Umsortieren (ADR 0065) bekommt eine Phase davor: `Medien/` und `Verträge/` anlegen, dann jede Marke und jede Kampagne ohne Marke direkt unter dem Unternehmen per Graph-Move nach `Medien/` hängen.
  - Das ist ein Move je Ordner; alles darunter wandert mit, ohne Bytes zu übertragen.
  - Der Trockenlauf zählt das in `zaehler.bereich`.
  - Auch ohne Umsortieren zieht der erste Upload einer Kooperation ihre Marke bzw. Kampagne nach `Medien/`, weil beide beweglich sind.

## Verworfen

- **Eigene Site für Verträge.** Das hieße zweite Drive-ID, zweites Abo und zweiter Abgleich. Die Rechte sollen dieselben sein wie bei den Videos, eine Trennung bringt also nichts.
- **Bereich unter der Kooperation** (`Kooperation/Verträge`). Ein Vertrag, etwa ein Rahmenvertrag, kann mehrere Kooperationen abdecken. Gesucht wird ein Vertrag je Firma.
- **Neue Bibliothek „Daten“ und umziehen.** Dabei entstehen neue `item_id`s, geteilte Links und SharePoint-Versionen gehen verloren. Umbenennen behält alles.
- **Bereich „Videos“ statt „Medien“.** Dann stünde „Videos“ doppelt im Pfad (`…/Videos/…/<Kooperation>/Videos/Video_N`), und der Bereich enthält auch Bilder, Stories und Rohmaterial.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261209_ablage_bereich.sql`. Sie setzt `20261201` voraus. Rollback steht im Kopf der Datei.
  2. Functions.
  3. Client.
  4. `site-einrichten.mjs` je Site, um die Bibliothek umzubenennen.
- Umsortieren zuerst auf der Test-Site laufen lassen. Erst danach auf Live, Unternehmen für Unternehmen, jeweils nach dem Trockenlauf.
- Posterschlüssel ist `file_path + revision` (ADR 0064). Durch den Bereich ändert sich jeder Pfad, also entstehen alle Poster einmal neu; die alten verwaisen und werden geräumt.
- Ordner-Links, die außerhalb des CRM gespeichert sind (Mails, Lesezeichen), zeigen auf den alten Pfad. Die Spalten im CRM ziehen nach.
- Heißt eine Marke beim Umsortieren schon „Medien“, wird der Bereich zu „Medien (2)“.
- Löschen eines Unternehmens löscht `Verträge/` mit.
- Die Dropbox-Ablage bleibt, wie sie ist (eingefroren, ADR 0065).
