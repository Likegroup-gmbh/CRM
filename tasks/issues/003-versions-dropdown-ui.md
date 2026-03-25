# Versions-Dropdown UI + Verfügbarkeits-Logik

## Parent PRD

[tasks/prd-video-upload-versionierung.md](../prd-video-upload-versionierung.md)

## What to build

Der `VideoUploadDrawer` bekommt ein Dropdown zur manuellen Versionsauswahl (V1, V2, V3). Nur Versionen, die für dieses `kooperation_video` noch nicht hochgeladen wurden, werden angeboten.

Konkret in `src/modules/kampagne/VideoUploadDrawer.js`:

1. **Konstante** `MAX_VERSIONS = 3` definieren (zentral, leicht anpassbar).

2. **Bestehende Versionen laden**: Beim `open()` eine Supabase-Abfrage auf `kooperation_video_asset` für die `video_id` machen, um existierende `version_number`-Werte zu ermitteln.

3. **Dropdown im Formular** (`renderForm()`): Zwischen der Dateivorschau und dem Video-Name-Feld ein `<select>` mit den verfügbaren Versionen einfügen. Label: "Version (Runde)". Optionen: nur die noch nicht belegten Versionsnummern (1-3).

4. **Max-Versionen-Hinweis**: Wenn alle 3 Versionen existieren, statt Dropdown einen Hinweistext anzeigen ("Alle 3 Versionen wurden bereits hochgeladen") und den Upload-Button deaktivieren.

5. **Submit-Button-State** (`_updateSubmitButtonState()`): Berücksichtigt, dass eine Version ausgewählt sein muss.

## Acceptance criteria

- [ ] Dropdown mit Label "Version (Runde)" ist im Formular sichtbar
- [ ] Beim Öffnen werden bestehende Assets für diese video_id aus der DB geladen
- [ ] Nur noch nicht existierende Versionen (1-3) werden als Optionen angeboten
- [ ] Wenn alle 3 Versionen existieren: Hinweistext statt Dropdown, Upload-Button deaktiviert
- [ ] Die erste verfügbare Version ist vorausgewählt
- [ ] MAX_VERSIONS ist als Konstante definiert (nicht hardcoded in Logik verstreut)
- [ ] Upload-Button ist nur aktiv wenn Datei + Video-Name + Version vorhanden

## Blocked by

None - kann sofort gestartet werden.

## User stories addressed

- User Story 1: Version beim Upload auswählen
- User Story 2: Nur verfügbare Versionen anbieten
- User Story 3: Meldung bei Erreichen des Maximums
- User Story 14: Versions-Limit später anpassbar
