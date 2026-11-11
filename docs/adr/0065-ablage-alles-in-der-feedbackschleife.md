# 0065 Ablage: alles in der Feedbackschleife

Die SharePoint-Ablage trennte nach Dateiart: `Kooperation/{Videos,Storys,Bilder,Rohmaterial}`, darunter je `Video_N` und dann erst die Runden. Videos lagen zusätzlich in Varianten-Ordnern (`Feedbackschleife_1/A/…`). Im Finder suchte man eine Runde also an drei Stellen. Der Videos-Tab und die Lightbox zeigen eine Runde dagegen längst als Einheit (Videos, Bilder, Stories derselben `version_number`), und neue Dateien haben keine Variante mehr. Ordner und CRM liefen auseinander.

## Entscheidung

- **Eine Runde ist ein Ordner.** `Kooperation/Videos/Video_N/Feedbackschleife_K` bzw. `…/Finale_Version` enthält alles, was der Creator in dieser Runde liefert:
  - Videos und Bilder flach, der Typ kommt aus der Dateiendung.
  - Stories in `Story_K` (K = `slot_index`). Der Ordner ist nötig, weil Story und Video beide `.mp4` sind und die Story einen Slot braucht.
  - Finale Videos in den Format-Ordnern (`9-16`, `4-5`, `1-1`) wie bisher. Finale Stories liegen ohne Format-Ordner in `Finale_Version/Story_K`; ihr Seitenverhältnis kommt aus den Pixelmaßen wie bei Videos.
- **Typ-Ordner** gibt es nur noch für `Videos` und `Rohmaterial`. Das Gerüst legt je Video die Schleifen 1 bis 3, `Finale_Version` und in jeder Runde einen `Story_K` je Slot an.
- **Register:** Ein `Story_K` hat `art = 'story'`, `typ = 'videos'` und die `version_number` seiner Schleife; `version_number IS NULL` heißt, er liegt in der Finalen Version. `ablage_geruest_offen` zählt einen Slot als fertig, sobald sein Ordner in der Finalen Version existiert (Migration `20261207`).
- **Bilder ohne Video** (Altbestand, Creator-Upload ohne Ziel) liegen in der Runde des ersten Videos und bekommen beim Ablegen dessen `video_id`, so wie `CONTEXT.md` das für die Anzeige schon festlegte. Upload-Kontext, Commit (`video_id`), Creator-Job und Dropbox-Umzug tragen das Video weiter.
- **Varianten-Ordner** entstehen nicht mehr. Der Abgleich zieht eine Datei aus einem alten Varianten-Ordner flach in ihre Schleife, die Variante bleibt an der Zeile (Tags hängen daran). Ein Unterordner einer Video-Schleife, der nicht `Story_K` heißt, ist ein freier Ordner.
- **Kunden-Link** nur noch auf `Videos/`, dort liegt alles. `typ: 'storys'` von alten Clients ist ein Alias dafür.
- **Lightbox und Player** hängen an den Asset-Zeilen, nicht an Ordnern. Der Player lädt Bilder ohne Bedingung auf `bilder_folder_url` nach; SharePoint setzt diesen Link nicht mehr.
- **Bestand umsortieren** (`umsortieren.js`, Admin-Seite je Unternehmen):
  1. Ein Trockenlauf zählt aus Register und Eingang, was in alten Ordnern liegt.
  2. Der Lauf verschiebt jede Original-Zeile per Graph-Move in ihren `zielOrdner`; die `item_id` bleibt. Er zieht Asset-Spalten (auch die der Promote-Finalen), Eingang und `story_folder_url` nach.
  3. Danach werden leere alte Ordner gelöscht, tiefste zuerst: erst `geloescht_at` im Register, dann SharePoint. In umgekehrter Reihenfolge würde der Abgleich die Löschung als Kaskade auf die Assets anwenden. Leselinks auf diesen Ordnern werden widerrufen, ein SharePoint-`bilder_folder_url` geleert.
  4. Dateien ohne CRM-Zeile bleiben liegen, ihre Ordner auch.

  Jeder Lauf plant neu, ist also wiederholbar. Reicht das Budget nicht, stößt sich die Background Function selbst an (höchstens 20 Runden).

## Verworfen

- **Stories ohne eigenen Ordner flach in die Schleife.** Story und Video sind nicht an der Endung unterscheidbar, und ohne Ordner fehlt der Slot.
- **Bilder in `Bilder/` unter der Runde.** Das ist ein zusätzlicher Klick ohne Information; die Endung reicht.
- **Dropbox mit umbauen.** Dropbox ist eingefroren und läuft aus. Ihre alte Struktur ist eine bekannte Abweichung.
- **Bestand neu hochladen statt verschieben.** Neue Items bekämen neue `item_id`s, geteilte Links und SharePoint-Versionen gingen verloren, und jede Datei liefe einmal komplett durch die Function. Ein Move innerhalb desselben Drives überträgt keine Bytes.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261207_ablage_feedbackschleife.sql`. Sie setzt `20261201` und `20261202` voraus. Rollback: `ablage_geruest_offen` aus `20261202` neu einspielen.
  2. Functions.
  3. Client.
- Umsortieren zuerst auf Staging mit einem Testunternehmen laufen lassen. Erst danach auf Live, Unternehmen für Unternehmen, jeweils nach dem Trockenlauf.
- Die Klassifizierung behält Legacy-Zweige für `Storys/`, `Bilder/` und Varianten-Ordner, bis überall umsortiert ist. Danach können sie weg.
- Posterschlüssel ist `file_path + revision` (ADR 0064). Verschobene Dateien bekommen neue Poster, die alten verwaisen und werden geräumt.
- Ein Bild ohne Video in einer Kooperation ohne Video kann nicht abgelegt werden (Fehler statt eines Ordners ohne Video).
