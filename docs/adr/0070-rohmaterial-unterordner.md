# 0070 Ablage: Unterordner im Rohmaterial und Verschieben in die Feedbackschleife

Die Cutter arbeiten im Finder direkt im Rohmaterial: Creator-Abgaben landen dort, und sie legen sich Unterordner an (Creator-Name, „final“ …). Bisher war jeder Ordner unter `Rohmaterial/` ein freier Ordner. Seine Dateien hat der Abgleich ignoriert (`freier_ordner`), im CRM tauchten sie nicht auf. Wer nicht im Finder arbeitet, konnte Rohmaterial außerdem nicht in eine Feedbackschleife bringen, ohne es neu hochzuladen.

## Entscheidung

- **Klassifizierung:** Ein freier Ordner mit `typ = 'rohmaterial'` (also jeder Ordner unter `<Kooperation>/Rohmaterial/`, beliebig tief) gilt als Arbeitsordner. Dateien darin werden `roh`-Assets der Kooperation (`kooperation_rohmaterial_asset`). Das Register bleibt `art = 'frei'`, der Besitz kommt wie immer über `besitzVon(eltern)`.
- **Bestand:** Die Migration `20261212_ablage_rohmaterial_ordner.sql` öffnet die Eingänge wieder, die als `ignoriert/freier_ordner` in solchen Ordnern liegen. Der nächste Abgleich liest sie ein.
- **Creator-Upload:** Rohmaterial eines Creators landet in `Rohmaterial/<Creator-Name>/`. Der Ordner wird vor dem Upload angelegt und ins Register geschrieben (`ordner.rohUnterordner`), damit der Abgleich den Elternordner schon kennt. Ohne Creator-Namen bleibt die Wurzel.
- **Ordner im CRM anlegen:** `ablage-datei` Aktion `ordner_anlegen` (`kooperation_id`, `name`, optional `parent_item_id`). Der Server prüft, dass der Eltern-Ordner ein Rohmaterial-Ordner dieser Kooperation ist. Erlaubt sind höchstens 5 Ebenen. Gibt es den Namen schon, kommt der bestehende Ordner zurück (idempotent, auch im Wettlauf mit dem Abgleich über den Unique-Index). Umbenennen und Löschen gibt es nur im Finder.
- **Upload in einen Unterordner:** `ablage-upload-ziel` nimmt für `typ = 'roh'` optional `ordner_item_id`. Der Ordner muss zum Rohmaterial der Kooperation gehören, der Ordner-Link bleibt `Rohmaterial/`.
- **Verschieben in eine Feedbackschleife:** `ablage-datei` Aktion `roh_verschieben` (`ids`, `kooperation_video_id`, `version_number` 1–3, höchstens 20 je Anfrage, der Client schickt Pakete zu 10).
  - Je Datei: Graph-Move in `Videos/Video_N/Feedbackschleife_K` (Konflikt = umbenennen), dann `upsert` als `video` oder `still` (aus der Endung, wie `dateiTyp`) und die `roh`-Zeile entfernen. Titel und `uploaded_by` bleiben erhalten.
  - ZIP und andere Endungen werden abgelehnt (`dateityp`), sonst zöge der Abgleich sie zurück ins Rohmaterial.
  - Teilfehler brechen nicht ab, jede Datei bekommt ihr Ergebnis.
  - Der Abgleich sieht denselben Move und macht denselben Typwechsel (`umziehen`). `upsert` und `entfernenNachItem` sind idempotent, die Reihenfolge ist egal.
- **Verschieben innerhalb des Rohmaterials:** `ablage-datei` Aktion `roh_umordnen` (`ids`, `kooperation_id`, optional `ordner_item_id`, ohne = Wurzel; gleiche Grenzen wie oben).
  - Das Ziel muss ein registrierter Rohmaterial-Ordner dieser Kooperation sein, sonst 404. Alle Dateitypen sind erlaubt, auch ZIP, weil der Typ `roh` bleibt.
  - Je Datei: Graph-Move (Konflikt = umbenennen, Name nur gekürzt, wenn der Pfad sonst zu lang wird), dann `file_name`, `file_path` und `etag` der `roh`-Zeile nachziehen. Liegt die Datei schon dort, gibt es keinen Move.
  - Nur Dateien in SharePoint (`nicht_sharepoint` sonst). Ist der Dropbox-Schalter an, fehlen die Ablage-Spalten im Client, dann gibt es weder Checkbox noch Drag & Drop.
- **Videos-Tab (Team):**
  - Rohmaterial ist nach Unterordnern gruppiert: einklappbare Köpfe mit Anzahl (auch leere Ordner aus dem Register), darunter die Dateien der Wurzel. Den Unterordner leitet der Client aus `file_path` relativ zum Rohmaterial-Ordner ab.
  - „Neuer Ordner“ in der Leiste und „Unterordner anlegen“ am Ordnerkopf öffnen ein Eingabefeld in der Liste.
  - Upload in einen Ordner: über den Knopf am Ordnerkopf oder per Drop auf den Kopf.
  - Verschieben: Datei auf einen Ordnerkopf, in die Wurzel (Spalte 3 außerhalb der Ordner oder „Rohmaterial“ in Spalte 2) oder auf eine Feedbackschleife in Spalte 2 ziehen (eine markierte Zeile nimmt alle markierten mit). Ein Ordner, in dem schon alle gezogenen Dateien liegen, ist kein Ziel. Alternativ Checkboxen und „Verschieben“: oben „In Ordner“ (Wurzel und registrierte Unterordner, der gemeinsame Ordner gesperrt), darunter alle Schleifen aller Videos, das gewählte Video zuerst. Für eine einzelne Datei gibt es den Knopf im Detail. Die Ansicht wechselt sofort und lädt danach den echten Stand. Schlägt alles fehl, kommt der alte Stand zurück.
- **Weitere Ordner:** Rohmaterial-Unterordner erscheinen nicht mehr unter „Weitere Ordner“ (`lesen.frei`).

## Verworfen

- **Nur spiegeln, keine Ordner im CRM.** Wer nicht im Finder arbeitet, könnte dann keine Ordner für den Cutter vorbereiten.
- **Eigene `art` für Rohmaterial-Unterordner.** `frei` mit `typ = 'rohmaterial'` reicht für die Klassifizierung. Eine neue Art bräuchte Migration, Rechte und Umsortieren, ohne etwas zu gewinnen.
- **Rohmaterial in der Schleife kopieren statt verschieben.** Dann gibt es zwei Dateien mit getrennten Versionen und doppelten Speicher. Der Cutter erwartet, dass die Datei weg ist.
- **Popover-Menü für das Ziel.** Die Spalten schneiden es per `overflow` ab. Das Menü klappt deshalb in der Spalte auf.

## Folgen

- Deploy-Reihenfolge:
  1. Functions (Klassifizierung zuerst, sonst ignoriert der Abgleich die wieder geöffneten Eingänge erneut).
  2. Migration `20261212_ablage_rohmaterial_ordner.sql`.
  3. Client.
- Verschobene Dateien bekommen eine neue Asset-ID im Ziel-Typ. Kommentare hängen an Video-Assets, Rohmaterial hat keine, also geht nichts verloren.
- Dropbox-Rohmaterial (eingefroren, ADR 0065) lässt sich nicht verschieben und bekommt keine Checkbox.
- Ein im Finder umbenannter Unterordner zieht die Pfade über den normalen Abgleich nach. Die Gruppierung im CRM folgt beim nächsten Laden.
