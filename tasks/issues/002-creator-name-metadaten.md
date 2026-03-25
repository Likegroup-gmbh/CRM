# Creator-Name in Upload-Metadaten durchreichen

## Parent PRD

[tasks/prd-video-upload-versionierung.md](../prd-video-upload-versionierung.md)

## What to build

Der `VideoUploadDrawer` braucht den Creator-Namen für die automatische Datei-Umbenennung. Aktuell wird der Creator-Name nicht in den `metadaten` mitgegeben, die `KampagneKooperationenVideoTable._openUploadDrawer()` an den Drawer übergibt.

Konkret in `src/modules/kampagne/KampagneKooperationenVideoTable.js`:

1. **Prüfen** ob der Creator-Name bereits im Select der Kooperationen geladen wird (z.B. `creator:creator_id(name, vorname)` o.ä.). Falls nicht: Select erweitern.

2. **`_openUploadDrawer()`** erweitern: `creatorName` aus der Kooperation extrahieren und als neues Feld in das `metadaten`-Objekt aufnehmen, das an `VideoUploadDrawer.open()` übergeben wird.

## Acceptance criteria

- [ ] Creator-Name ist im Select der Kooperationen enthalten (ggf. Join auf `creator` Tabelle erweitert)
- [ ] `metadaten`-Objekt enthält `creatorName` mit dem Namen des Creators der Kooperation
- [ ] Bei fehlendem Creator (Edge Case) wird ein leerer String als Fallback gesetzt

## Blocked by

None - kann sofort gestartet werden.

## User stories addressed

- User Story 4: Automatische Datei-Umbenennung (Voraussetzung: Creator-Name verfügbar)
- User Story 12: Verständlicher Dateiname in Dropbox
