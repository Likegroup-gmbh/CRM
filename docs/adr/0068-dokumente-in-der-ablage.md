# 0068 Dokumente in der Ablage

Verträge, Rechnungs-PDFs, Belege und Auftragsdokumente lagen in Dropbox, ältere noch in Supabase-Storage. Jede Stelle im Client hatte ihren eigenen Upload und erkannte Dropbox an einem führenden `/` im Pfad. Diese Dokumente gehören in den Ordner des Kunden, neben die Medien (ADR 0067). Bilder, Poster, der `documents`-Bucket, Staging und Einreichungen bleiben, wo sie sind.

## Entscheidung

- **Registry statt Einzelfälle.**
  - Je Dokument-Typ gibt es einen Eintrag mit Tabelle, Spaltensatz, Bezug und Bereich.
  - Server: `_shared/ablage/dokument.js`. Client-Spiegel: `src/core/ablage/dokumentAblage.js`. `DokumentRegistry.test.js` prüft, dass beide gleich sind.
  - `feld`-Typen: `vertrag` (`datei_*`) und `vertrag_unterschrieben` (`dropbox_file_*`, Altbestand `unterschriebener_vertrag_*`). Der Dateisatz hängt an der Zeile in `vertraege`.
  - `zeile`-Typen: `rechnung` (`rechnung_pdfs`), `beleg` (`rechnung_belege`) und `auftragsdokument` (`auftrag_dokumente`). Jede Datei ist eine eigene Zeile.
  - Neu sind die Spalten `ablage`, `drive_id`, `item_id` und bei Zeilen `etag` und `ctag`.
  - URL und Pfad bleiben gefüllt, bei SharePoint mit webUrl und Pfad. Status-Ableitungen wie `sync_vertrag_status` lesen sie weiter.
- **Ordner** (Name des Dokuments ist der Dateiname):
  - `Daten/<Firma>/Verträge/[<Marke>/]<Kampagne>/[<Produktion>/]` (Produktion seit ADR 0069), bei Contracting `…/Contracting/<Auftrag>/`
  - `Daten/<Firma>/Rechnungen/[<Marke>/]<Kampagne>|Contracting/<Auftrag>/<Rechnungs-Nr>/`, Belege in `Belege/` darunter
  - `Daten/<Firma>/Aufträge/[<Marke>/]<Auftrag>/`, Rechnungen zum Auftrag in `Rechnungen/` darunter
  - Testunternehmen liegen unter `_Test/`.
  - Register: `ablage_ordner.art = 'dokument'` mit `dok_schluessel = bereich:unternehmen:ebene:ref`. Der Rechnungsordner hängt an `rechnung_id`, nicht am Namen. Teilrechnungen mit gleicher Nummer überschreiben sich deshalb nicht mehr, anders als bisher bei Dropbox (`overwrite`).
  - Die Pflege zieht Ordnernamen nach, wenn sich Marke, Kampagne, Auftrag oder Rechnungs-Nr ändern.
- **Eigene Weiche, eigener Notschalter.**
  - `unternehmen.dokument_ablage_ziel` und `ablage_einstellung.notschalter_dokumente` sind unabhängig von den Medien.
  - Der Medien-Notschalter, `ABLAGE_ZIEL=dropbox` und `schalter.json` (`dropboxUpload`) halten auch die Dokumente an.
  - Admin-Seite Medienablage, Sektion „Dokumente“: Notschalter, Weiche je Unternehmen, Zähler SharePoint/Dropbox/Supabase und „Bestand umziehen“.
- **Ein Upload-Weg.** `dokumentHochladen` ruft `ablage-upload-ziel` mit `typ`, `bezug_id` und optional `dokument_typ`/`ersetzen_id` auf.
  - `{ ziel: 'dropbox' }`: bisheriger Dropbox-Weg.
  - Sonst: Session, Chunks, Commit, dann schreibt der Client die Zeile (`speichern`).
  - Scheitert `speichern`, wird der Upload verworfen. Schreibt der Client gar nicht, legt der Abgleich die Zeile nach 10 Minuten aus dem Upload-Kontext an.
  - Ersetzen einer SharePoint-Datei ist eine neue Version desselben Items. Bei Weiche Dropbox gibt es 503, sonst stünde `ablage = sharepoint` mit Dropbox-Pfad in der Zeile.
- **Rechnung zuerst anlegen, dann hochladen.** Der Ordner braucht `rechnung_id`. Gilt für RechnungDetail, Contracting-Rechnung und das Formular.
- **Lesen über `ablage-link`.**
  - Dokument-Schlüssel ist `typ:id`, für Renderer, die nur die URL kennen, gibt es `dokument_urls`.
  - Der Klick-Interceptor im `DocumentUrlHelper` erkennt SharePoint-Dokumente an der webUrl: Bereichsordner im Pfad plus Dateiendung. Ordner- und Medienlinks bleiben unberührt.
  - Sichtbarkeit: Staff über die RLS der Fach-Zeile ohne Kooperationsfilter. Kunden nur Auftragsdokumente und Contracting des eigenen Unternehmens.
- **Löschen.**
  - SharePoint-Dateien gehen in den Papierkorb, und nur wenn keine andere Zeile auf das Item zeigt.
  - Rechnung und Auftrag (`EntityMutator`) entfernen vorher die Dateien der Zeilen, die per FK-Cascade wegfallen.
  - Beim Löschen eines Unternehmens gehen die Dokument-Bereiche in den Papierkorb, nicht endgültig weg. Grund ist die Aufbewahrungspflicht.
- **Bestandsumzug je Unternehmen** (`ablage_dokument_umzug_anlegen`, Läufer in `umzug.js`):
  - Quelle ist ein Dropbox-Temp-Link oder ein Storage-Download. Die Datei kommt ganz in den Speicher (max. 200 MB), dann in eine Session mit `deferCommit`.
  - Die `ablage_upload`-Zeile steht vor dem Commit. Stirbt der Läufer, hängt der Abgleich die Datei an die Bestandszeile (`umzug_dokument_id`).
  - `rechnung.pdf_url` ohne passende `rechnung_pdfs`-Zeile (`rechnung_alt`) wird zu einer solchen Zeile; `pdf_url` bleibt stehen.
  - Medien-Zeilen haben Vorrang im Läufer. Der Dokument-Notschalter pausiert nur die Dokument-Zeilen.

## Verworfen

- **Ordner je Kooperation** (`…/<Kooperation>/Verträge`). Rahmenverträge decken mehrere Kooperationen ab, Rechnungen gibt es auch für Contracting ohne Kooperation.
- **Eine gemeinsame Weiche für Medien und Dokumente.** Dann gäbe es keinen schrittweisen Test mit dem Testunternehmen, ohne die Medien mitzuziehen.
- **Dokumente in einer zweiten Bibliothek oder Site.** Das bedeutete eine zweite Drive-ID, ein zweites Abo und einen zweiten Abgleich bei denselben Rechten (ADR 0067).
- **Dropbox-Pfad am führenden `/` erkennen.** SharePoint-Pfade beginnen ebenfalls mit `/`, Löschen ginge an die falsche Ablage. Die Quelle kommt jetzt aus `dokumentQuelle(typ, row)`.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261210_ablage_dokumente.sql`. Sie setzt `20261209` voraus, der Rollback steht im Kopf.
  2. Functions.
  3. Client.
- Der Client liest die neuen Spalten nur ohne `dropboxUpload`. Solange der globale Schalter an ist, funktioniert der Client auch vor der Migration.
- Rollout: Weiche Dokumente zuerst für das Testunternehmen auf SharePoint stellen, Uploads prüfen und erst dann „Bestand umziehen“.
- Dateinamen bekommen bei Konflikt ` 1`, ` 2` (`conflict: rename`). Den Dropbox-Weg mit `overwrite` gibt es für SharePoint-Unternehmen nicht mehr.
- Die Originale in Dropbox und Storage bleiben nach dem Umzug liegen, `ablage_umzug.quelle_ref` merkt sich die Quelle.
- Löschen von Kampagne oder Kooperation lässt Dokumente in SharePoint stehen. Sie erscheinen im Abgleich als „Dokument ohne CRM-Zeile“, falls die Zeilen per Cascade wegfallen.
