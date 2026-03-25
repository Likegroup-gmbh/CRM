# Upload-Flow mit Versionierung + Umbenennung (End-to-End)

## Parent PRD

[tasks/prd-video-upload-versionierung.md](../prd-video-upload-versionierung.md)

## What to build

Der Kern-Slice: `VideoUploadDrawer.handleUpload()` und `saveAssetVersion()` so anpassen, dass die gewählte Version den kompletten Flow durchläuft — vom Dateinamen über den Dropbox-Pfad bis zur DB-Speicherung.

Setzt voraus, dass Slice 001 (Netlify Function), 002 (Creator-Name) und 003 (Dropdown) bereits implementiert sind.

### handleUpload() anpassen

1. **Version aus Dropdown lesen**: `document.getElementById('video-upload-version').value`
2. **Dateinamen generieren**: Format `{creatorName}_{unternehmen}_{kampagne}_v{version}.{ext}`. Alle Teile sanitized (Sonderzeichen/Leerzeichen → Unterstriche, keine Doppel-Unterstriche). Originale Dateiendung (.mp4, .mov, etc.) beibehalten.
3. **Netlify Function aufrufen** mit dem generierten `fileName` (statt `this._selectedFile.name`) und `versionNumber` aus dem Dropdown.
4. **Ordner-Link**: `folder_url` soll auf den **Kooperations-Ordner** zeigen (eine Ebene über dem Versions-Ordner). Den `folderPath` aus der Netlify-Response nutzen, um den Kooperations-Ordner-Pfad zu berechnen (`folderPath` → parent), darauf den Shared Link erstellen.

### saveAssetVersion() anpassen

1. **version_number**: Gewählte Version aus dem Dropdown statt hardcoded `1`.
2. **folder_url**: Bei JEDEM Upload auf den Kooperations-Ordner-Link aktualisieren (nicht nur wenn leer), damit der Link immer auf die übergeordnete Ebene zeigt wo der Kunde alle Versions-Ordner sieht.
3. **is_current**: Wie bisher — alle alten Assets auf `false`, neues auf `true`.

### Sanitize-Funktion

Eine kleine Hilfsfunktion für die Dateinamen-Bereinigung:
- Sonderzeichen → Unterstrich
- Leerzeichen → Unterstrich
- Mehrfach-Unterstriche → einfacher Unterstrich
- Trimmen

## Acceptance criteria

- [ ] Version aus Dropdown wird korrekt an Netlify Function als `versionNumber` gesendet
- [ ] Dateiname wird im Format `creator_unternehmen_kampagne_v{n}.{ext}` generiert und als `fileName` gesendet
- [ ] Originale Dateiendung wird beibehalten (.mov bleibt .mov, .mp4 bleibt .mp4)
- [ ] Sonderzeichen/Umlaute/Leerzeichen im Dateinamen werden sauber sanitized
- [ ] Datei landet in Dropbox unter `/Videos/.../Kooperation/Version_{N}/dateiname.ext`
- [ ] `kooperation_video_asset` Eintrag hat korrekte `version_number` (nicht immer 1)
- [ ] `kooperation_videos.folder_url` zeigt auf den Kooperations-Ordner (Ebene über Version_N)
- [ ] Kunde sieht beim Öffnen des folder_url die Ordner Version_1/, Version_2/ etc.
- [ ] Bestehende (alte) Uploads ohne Versions-Ordner brechen nicht
- [ ] Alle bisherigen Assets werden auf `is_current: false` gesetzt, neues auf `true`

## Blocked by

- Blocked by Issue 001 (Netlify Function: Pfad + Ordner-Erstellung)
- Blocked by Issue 002 (Creator-Name in Metadaten)
- Blocked by Issue 003 (Versions-Dropdown UI)

## User stories addressed

- User Story 4: Automatische Datei-Umbenennung
- User Story 5: Originale Dateiendung beibehalten
- User Story 6: Versions-Unterordner in Dropbox
- User Story 8: folder_url zeigt auf Kooperations-Ordner
- User Story 9: Korrekte version_number in kooperation_video_asset
- User Story 10: is_current Logik
- User Story 11: Kunde sieht Versions-Ordner in Dropbox
- User Story 12: Verständlicher Dateiname
- User Story 13: Bestehende Uploads unverändert
