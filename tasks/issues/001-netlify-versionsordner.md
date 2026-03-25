# Netlify Function: Pfad mit Versions-Ordner + explizite Ordner-Erstellung

## Parent PRD

[tasks/prd-video-upload-versionierung.md](../prd-video-upload-versionierung.md)

## What to build

Die Netlify Function `dropbox-upload` so erweitern, dass der berechnete Dropbox-Pfad einen Versions-Unterordner enthält (`Version_1/`, `Version_2/`, etc.) und der Ordner explizit per Dropbox API angelegt wird, bevor der Client die Datei hochlädt.

Konkret in `netlify/functions/dropbox-upload.js`:

1. **`buildDropboxPath()`** bekommt ein neues Pfad-Segment `Version_{versionNumber}` zwischen dem Kooperations-Ordner und dem Dateinamen. Ergebnis: `/Videos/Unternehmen/Marke/Kampagne/Kooperation/Version_1/dateiname.mp4`

2. **Ordner explizit anlegen**: Nach Token-Refresh und Pfad-Berechnung, VOR dem Response, den Versions-Ordner mit `POST https://api.dropboxapi.com/2/files/create_folder_v2` anlegen. HTTP 409 (Ordner existiert) wird als Erfolg behandelt.

3. **Response erweitern**: Neben `token` und `dropboxPath` auch `folderPath` (Pfad des Versions-Ordners) zurückgeben, damit der Client daraus den Shared Link erstellen kann.

## Acceptance criteria

- [ ] `buildDropboxPath()` fügt `Version_{N}` als Ordner-Segment ein, wobei `N` aus dem Request-Parameter `versionNumber` kommt
- [ ] Der Versions-Ordner wird per `create_folder_v2` explizit angelegt bevor der Response zurückgeht
- [ ] Bei bereits existierendem Ordner (409) wird kein Fehler geworfen
- [ ] Response-JSON enthält `folderPath` zusätzlich zu `token` und `dropboxPath`
- [ ] Bestehende Aufrufe ohne `versionNumber` fallen auf `Version_1` zurück (Abwärtskompatibilität)

## Blocked by

None - kann sofort gestartet werden.

## User stories addressed

- User Story 6: Automatischer Unterordner pro Version in Dropbox
- User Story 7: Explizite Ordner-Erstellung per API
