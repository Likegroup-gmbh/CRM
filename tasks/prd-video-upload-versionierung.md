# PRD: Video-Upload Versionierung mit Dropbox-Ordnerstruktur

## Problem Statement

Wenn ein Mitarbeiter ein Video zu einer Kooperation hochlädt und der Kunde Änderungswünsche hat, muss eine neue Version des Videos hochgeladen werden. Aktuell überschreibt ein erneuter Upload die vorherige Datei in Dropbox, weil der `VideoUploadDrawer` immer `version_number: 1` setzt und die Datei unter dem Originalnamen im selben Ordner landet (`mode: 'overwrite'`).

Der Kunde navigiert in Dropbox durch die Ordnerstruktur, um sich Videos anzuschauen. Ohne Versions-Ordner sieht er nur die letzte Datei und hat keinen Überblick über den Verlauf der Revisionen.

Außerdem sind die Dateinamen in Dropbox aktuell die Originalnamen der hochgeladenen Dateien (z.B. `final_v3_export_komprimiert.mp4`), was für den Kunden unübersichtlich ist.

## Solution

Der `VideoUploadDrawer` (Kampagne-Übersichtstabelle) wird um eine manuelle Versionsauswahl (V1, V2, V3) erweitert. Pro Version wird ein eigener Unterordner in Dropbox angelegt. Die hochgeladene Datei wird automatisch in ein einheitliches Format umbenannt: `creator_unternehmen_kampagne_v{n}.{ext}`.

Der Kunde öffnet den Dropbox-Ordner-Link der Kooperation und sieht sofort die Ordner `Version_1/`, `Version_2/`, `Version_3/` mit den jeweiligen Dateien.

## User Stories

1. Als Mitarbeiter möchte ich beim Video-Upload eine Version (V1, V2 oder V3) auswählen können, damit jede Feedback-Runde sauber getrennt gespeichert wird.
2. Als Mitarbeiter möchte ich nur Versionen zur Auswahl sehen, die noch nicht hochgeladen wurden, damit ich nicht versehentlich eine bestehende Version überschreibe.
3. Als Mitarbeiter möchte ich eine Meldung sehen, wenn bereits alle 3 Versionen hochgeladen wurden, damit ich weiß dass das Maximum erreicht ist.
4. Als Mitarbeiter möchte ich, dass die hochgeladene Datei automatisch in `creator_unternehmen_kampagne_v{n}.{ext}` umbenannt wird, damit die Dateinamen in Dropbox einheitlich und verständlich sind.
5. Als Mitarbeiter möchte ich, dass die Original-Dateiendung (.mp4, .mov, etc.) beibehalten wird, damit keine Inkompatibilitäten entstehen.
6. Als Mitarbeiter möchte ich, dass pro Version automatisch ein eigener Unterordner in Dropbox angelegt wird (`Version_1/`, `Version_2/`, etc.), damit die Ordnerstruktur übersichtlich bleibt.
7. Als Mitarbeiter möchte ich, dass der Dropbox-Ordner explizit per API angelegt wird (nicht nur implizit beim Upload), damit der Ordner zuverlässig existiert und ein Shared Link darauf erstellt werden kann.
8. Als Mitarbeiter möchte ich, dass der `folder_url` auf `kooperation_videos` immer auf den übergeordneten Kooperations-Ordner zeigt (nicht auf den Versions-Unterordner), damit der Kunde beim Klick auf "Ordner öffnen" alle Versionen sieht.
9. Als Mitarbeiter möchte ich, dass jede hochgeladene Version als eigener Eintrag in `kooperation_video_asset` gespeichert wird (mit korrekter `version_number`), damit die Versionshistorie in der Datenbank erhalten bleibt.
10. Als Mitarbeiter möchte ich, dass bisherige Asset-Einträge auf `is_current: false` gesetzt werden und nur die zuletzt hochgeladene Version `is_current: true` hat, damit das System immer weiß welche die aktuelle Datei ist.
11. Als Kunde möchte ich den Dropbox-Ordner-Link öffnen und sofort die Ordner `Version_1/`, `Version_2/`, `Version_3/` sehen, damit ich den Revisionsverlauf nachvollziehen kann.
12. Als Kunde möchte ich in jedem Versions-Ordner eine Datei mit einem verständlichen Namen finden (z.B. `maxmustermann_firmax_sommerkampagne_v2.mp4`), damit ich sofort weiß was ich mir anschaue.
13. Als Mitarbeiter möchte ich, dass bereits hochgeladene Videos (vor diesem Feature) unverändert bleiben und nicht migriert werden, damit keine bestehenden Links brechen.
14. Als Mitarbeiter möchte ich, dass das Versions-Limit (aktuell 3) später anpassbar ist, falls sich der Workflow ändert.

## Implementation Decisions

### Scope

- Nur der `VideoUploadDrawer` (Upload aus der Kampagne-Kooperationen-Video-Tabelle) wird angepasst.
- `KooperationVideoDetail` (Video-Detailseite) wird NICHT angefasst und läuft weiter wie bisher.
- Keine Migration bestehender Dateien in Dropbox.

### Versions-Dropdown UI

- Manuelles Dropdown mit V1, V2, V3 im `VideoUploadDrawer` Formular.
- Beim Öffnen des Drawers werden bestehende Assets aus `kooperation_video_asset` für diese `video_id` geladen.
- Bereits existierende Versionen werden aus dem Dropdown ausgeblendet.
- Wenn alle 3 Versionen existieren: Hinweistext, Upload-Button deaktiviert.
- Das Versions-Limit (3) wird als Konstante definiert, um spätere Anpassungen zu ermöglichen.

### Datei-Umbenennung

- Geschieht client-seitig vor dem API-Call an die Netlify Function.
- Format: `{creatorName}_{unternehmen}_{kampagne}_v{version}.{ext}`
- Alle Teile werden sanitized (Sonderzeichen → Unterstriche, Leerzeichen → Unterstriche, keine Doppel-Unterstriche).
- Die Original-Dateiendung wird beibehalten.
- Der Creator-Name muss als neues Feld in den `metadaten` mitgegeben werden (wird aus `KampagneKooperationenVideoTable._openUploadDrawer()` befüllt).

### Dropbox-Ordnerstruktur

Neue Struktur mit Versions-Unterordnern:

```
/Videos/{Unternehmen}/{Marke}/{Kampagne}/{Kooperation}/
  Version_1/
    creator_unternehmen_kampagne_v1.mp4
  Version_2/
    creator_unternehmen_kampagne_v2.mov
  Version_3/
    creator_unternehmen_kampagne_v3.mp4
```

### Ordner-Erstellung

- Der Versions-Ordner wird **explizit** per Dropbox API `files/create_folder_v2` angelegt.
- Dies passiert in der Netlify Function `dropbox-upload`, nachdem der Token geholt und der Pfad berechnet wurde.
- 409 (Ordner existiert bereits) wird als Erfolg behandelt.
- Der Ordnerpfad wird im Response an den Client zurückgegeben.

### Netlify Function Anpassungen

- `buildDropboxPath()` bekommt ein neues Pfad-Segment `Version_{N}` zwischen Kooperation und Dateiname.
- Der `fileName` Parameter wird jetzt vom Client als bereits umbenannter Name gesendet (nicht mehr der Originaldateiname).
- Response enthält zusätzlich `folderPath` für die Ordner-Link-Erstellung.

### Datenbank / Asset-Speicherung

- Keine neue Migration nötig — `kooperation_video_asset.version_number` existiert bereits.
- `saveAssetVersion()` im Drawer setzt `version_number` auf den gewählten Wert statt hardcoded `1`.
- Alle bestehenden Assets für diese `video_id` werden auf `is_current: false` gesetzt, das neue auf `is_current: true`.
- `kooperation_videos.folder_url` zeigt auf den Kooperations-Ordner (eine Ebene über den Versions-Ordnern), wird bei jedem Upload aktualisiert (nicht nur wenn leer).

### Metadaten-Erweiterung

- `KampagneKooperationenVideoTable._openUploadDrawer()` muss den Creator-Namen aus der Kooperation extrahieren und in `metadaten.creatorName` mitgeben.
- Dafür muss geprüft werden ob der Creator-Name bereits im Select der Kooperationen geladen wird (falls nicht: Select erweitern).

## Testing Decisions

Gute Tests prüfen **externes Verhalten** (Input → Output), nicht Implementierungsdetails.

### Zu testende Module

1. **Dateinamen-Generierung**: Sanitizing-Logik und Format-Zusammenbau. Input: Creator, Unternehmen, Kampagne, Version, Original-Extension → Output: korrekter Dateiname. Edge Cases: Sonderzeichen, Umlaute, leere Felder.

2. **Pfad-Berechnung** (`buildDropboxPath`): Prüfen dass der Versions-Ordner korrekt eingefügt wird. Input: alle Felder inkl. versionNumber → Output: korrekter Dropbox-Pfad mit `/Version_N/`.

3. **Versions-Verfügbarkeit**: Logik die aus bestehenden Assets die verfügbaren Versionen berechnet. Input: Liste existierender `version_number` → Output: Liste verfügbarer Versionen.

### Vorhandene Test-Patterns

Im Repo unter `src/__tests__/` existieren bereits Tests (z.B. für Dropbox-relevante Utilities). Neue Tests sollten diesem Pattern folgen.

## Out of Scope

- Anpassung von `KooperationVideoDetail` (zweiter Upload-Pfad) — bleibt unverändert.
- Migration bestehender Dateien/Ordner in Dropbox in die neue Struktur.
- Automatische Verknüpfung zwischen Kunden-Feedback (Comments) und einer spezifischen Version.
- Kundenportal-spezifische Ansicht der Versionen (Kunde navigiert direkt in Dropbox).
- Drag & Drop Reihenfolge der Versionen.
- Video-Konvertierung oder Transkodierung.
- Änderungen am Lösch-Flow (`VideoDeleteHelper`) — bestehende Löschlogik funktioniert weiterhin über `file_path`.

## Further Notes

- Die Dropbox API `files/upload` im `overwrite`-Modus erstellt fehlende Elternordner implizit, aber wir verwenden trotzdem `create_folder_v2` explizit, weil wir den Ordnerpfad zuverlässig für den Shared Link brauchen.
- `autorename: true` bleibt als Fallback im Upload-Call bestehen, falls es trotzdem zu Namenskonflikten kommt.
- Das Versions-Limit von 3 entspricht dem aktuellen Business-Prozess (max. 3 Feedback-Runden). Die Konstante sollte zentral definiert werden, damit sie bei Bedarf einfach angepasst werden kann.
- Der `folder_url` auf `kooperation_videos` zeigt bewusst auf den Kooperations-Ordner (nicht den Versions-Ordner), damit der Kunde beim Klick sofort die Übersicht aller Runden sieht.
