# 0082 Ablage ist immer SharePoint

Seit ADR 0065 und 0068 entschied eine Weiche je Unternehmen (`ablage_ziel`, `dokument_ablage_ziel`), ob Medien und Dokumente nach SharePoint oder Dropbox gingen. Dazu kamen zwei Notschalter, der globale Schalter `ABLAGE_ZIEL` bzw. `schalter.json` (`dropboxUpload`), der Bestandsumzug und der Link-Modus (externe Links statt Upload, `kein_dropbox`). Die Upload-Spalten der Kampagne (`custom_columns`, `field_type = 'upload'`) luden an allen vorbei direkt nach Dropbox. Jeder Schreib-, Lese-, Lösch- und Verschiebeweg existierte doppelt, und Dropbox kommt als Ablage nicht mehr in Frage.

## Entscheidung

- **Ein Ziel.** Jeder Upload geht nach SharePoint: Medien, Creator-Abgaben, Dokumente und Upload-Spalten.
  - Weiche, Notschalter, `ABLAGE_ZIEL`, `schalter.json`/`VITE_DROPBOX_UPLOAD` und `kein_dropbox` sind weg.
  - Ohne SharePoint-Konfiguration antwortet `ablage-upload-ziel` mit 503 `nicht_konfiguriert`. Einen Rückfall gibt es nicht. Der Client nimmt nur `ziel = 'sharepoint'` mit `upload_id` und `upload_url` an.
- **Kein Dropbox-Code mehr**, auch nicht lesend: kein Temp-Link, kein Proxy, kein Löschen, Verschieben, Umbenennen und keine Thumbnails.
  - Gelöscht sind die Functions `dropbox-*`, `_shared/dropbox*`, der Creator-Weg über den Staging-Bucket (`creator-upload-abort` eingeschlossen), der Bestandsumzug und die Einmal-Skripte mit Dropbox-API.
  - Creator laden direkt in eine SharePoint-Session. `creator-upload-cleanup` räumt liegengebliebene Jobs.
- **Altbestand.** `ablage = 'dropbox'` an den Asset- und Dokument-Zeilen bleibt und heißt jetzt „nicht in SharePoint“.
  - `file_url` ist ein externer Link, Download und Klick öffnen ihn in einem neuen Tab. Ohne URL gibt es nichts zu öffnen.
  - Löschen entfernt nur die Zeile, eine Datei wird nicht angefasst.
  - Kein Poster: Der Generator meldet `altbestand:keine_quelle` als dauerhaften Fehler.
  - Der Player spielt Altbestand nicht mehr ab (Dropbox steht nicht mehr in der CSP).
  - Dokumente: Ein Pfad mit `/` plus URL ist ein Link (`dokumentQuelle` → `{ quelle: 'link' }`), ohne URL ist keine Quelle da.
- **Upload-Spalten** sind Typ `spalte` in `ablage-upload-ziel` (`custom_column_id`, `entity_id`).
  - Ordner: `<Kooperation>/<Spaltenname>/` (`art = 'spalte'`). Bei Spalten auf Videoebene `<Kooperation>/<Spaltenname>/Video_<N>_<Thema>/` (`spalte_videos`, je Video `spalte_video`).
  - Geprüft wird: Spalte sichtbar, `field_type = 'upload'`, Kooperation bzw. Video sichtbar und in derselben Kampagne wie die Spalte.
  - Je Datei eine Zeile in `custom_column_assets` mit den Ablage-Spalten und `kooperation_id`. Die Zelle (`custom_column_values`) hält den Ordner-Link.
  - Ersetzen einer SharePoint-Datei ist eine neue Version desselben Items. Bei Altbestand kommt die neue Datei in den Spalten-Ordner, und die Zeile zeigt danach auf sie.
  - Der Abgleich ordnet Dateien im Spalten-Ordner als Spalten-Asset ein. Direkt im Ordner einer Video-Spalte ist eine Datei frei.
  - Löschen der Spalte (`ablage-loeschen`, `entity = 'spalte'`) entfernt den Ordner endgültig.
  - Kunden-Leselink auf den Spalten-Ordner wie in ADR 0071, Kunden nur bei sichtbarer Spalte.
- **Listen ohne Upload-Typ.** Konzept- und Casting-Listen bieten `upload` nicht mehr an. Die eine bestehende Listen-Spalte zeigt ihren Dropbox-Link als externen Link.
- **Kein Link-Modus.** Der Upload-Drawer ist immer eine Dropzone, es gibt keine externen Links und kein „Ordner teilen“ mehr. Das Video-Detail der Kooperation nutzt denselben Drawer.
- Den Ad-Manager-Namen setzt das Umbenennen nur noch bei SharePoint-Dateien.

## Verworfen

- **Dropbox lesend behalten** (Temp-Links, Proxy, Thumbnails). Das hieße weiter Token-Pflege, ein Konto als Pflicht und zwei Lesewege in Player, Download und Poster, nur damit der Altbestand im CRM abspielt. Altbestand als Link reicht, bis Dropbox gekündigt wird.
- **Bestand der Upload-Spalten umziehen** (671 Dateien). Die Dateien werden kaum noch geöffnet, ein Umzug bräuchte den gerade entfernten Läufer. Sie bleiben Links.
- **Eigene Kette für Listen-Uploads** (`listenspalte`, `Masterlisten/<Liste>/<Spalte>/<Eintrag>/`). Etwa ein Drittel des Aufwands von `spalte` für bisher 2 Dateien. Die eigenen Spalten der Listen bleiben, nur der Upload-Typ fällt weg.
- **Weiche als Rückfall stehen lassen.** Ein Schalter, den niemand mehr umlegt, hält trotzdem jeden Dropbox-Zweig am Leben.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261228_ablage_spalte.sql` (nur additiv, Rollback im Kopf).
  2. Functions und Client in einem Deploy.
  3. Migration `20261229_dropbox_raus.sql`. Sie droppt Weiche, `kein_dropbox`, Notschalter-Zeilen, `ablage_umzug` mit ihren RPCs und die Dropbox-Spalten der Creator-Jobs und schreibt `ablage_geruest_offen` ohne Weichenfilter neu.
- Von Hand:
  - Netlify-Env `DROPBOX_REFRESH_TOKEN`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `VITE_DROPBOX_UPLOAD` und `ABLAGE_ZIEL` löschen.
  - Bucket `creator-upload-staging` leeren.
  - Dropbox erst kündigen, wenn die alten Links nicht mehr gebraucht werden. Danach sind sie tot, die Zeilen bleiben stehen.
- Abgelöst: in ADR 0068 die Abschnitte zu Weiche, Notschalter, Bestandsumzug und dem Dropbox-Weg beim Upload, in ADR 0064 die Dropbox-Quelle der Poster (Quelle sind die Graph-Thumbnails), in ADR 0065, 0067, 0069 und 0070 die „eingefrorene Dropbox-Ablage“.
- Alte Freigabe-Links mit `dl=0` werden beim Laden eines PDF-Anhangs (Anschreiben, `dokument.js`) weiter auf `raw=1` umgeschrieben, sonst käme eine Vorschauseite statt der Datei.
