# Profilbild-Upload-Implementierung

## Überblick
Implementierung eines Profilbild-Uploads für Benutzer, analog zur Logo-Upload-Funktionalität bei Unternehmen und Marken.

## Features
- ✅ Click-to-Upload auf Avatar in der Profilseite
- ✅ Hover-Effekt mit Kamera-Icon
- ✅ Drawer-Modal mit Drag&Drop-Uploader
- ✅ Validierung: max. 200 KB, nur PNG/JPG
- ✅ Automatisches Löschen alter Bilder
- ✅ Public URL in `benutzer.profile_image_url`
- ✅ Auto-Refresh nach Upload

## Komponenten

### 1. ProfileImageUpload.js
**Pfad:** `src/modules/admin/ProfileImageUpload.js`

**Hauptfunktionen:**
- `open(userId, onComplete)` - Öffnet Upload-Drawer
- `handleUpload()` - Validiert und lädt Bild hoch
- `uploadToSupabase(file)` - Supabase Storage Upload
- `close()` - Schließt Drawer

**Wiederverwendete Komponenten:**
- `UploaderField` - Drag&Drop-Upload-Komponente
- Drawer-System - Wie bei anderen Modulen

### 2. ProfileDetailV2.js (erweitert)
**Änderungen:**
- Import von `ProfileImageUpload`
- Avatar mit `profile-avatar-clickable` Klasse
- Overlay mit Kamera-Icon
- Event Listener für Upload-Click
- Auto-Reload nach Upload

### 3. CSS (components.css)
**Neue Styles:**
- `.profile-avatar-clickable` - Cursor & Transition
- `.profile-avatar-overlay` - Hover-Overlay mit Icon
- Hover-Effekte (scale, shadow, opacity)

## Storage & Security

### Bucket: `profile-images`
- **Public:** Ja (für Anzeige)
- **Limit:** 200 KB (wie Logos)

### RLS Policies:
```sql
-- SELECT: Public
bucket_id = 'profile-images'

-- INSERT: Nur eigene Bilder
(bucket_id = 'profile-images') AND (foldername[1] = auth.uid())

-- UPDATE/DELETE: Nur eigene Bilder
(bucket_id = 'profile-images') AND (foldername[1] = auth.uid())
```

**Ordnerstruktur:**
```
profile-images/
  {auth_user_id}/
    profile.jpg
    profile.png
```

## Datenbankfeld

### benutzer.profile_image_url
- **Typ:** `text`
- **Nullable:** Ja
- **Inhalt:** Public URL zu Storage-File

## Ablauf

1. **User klickt auf Avatar**
   ```javascript
   profileImageUpload.open(userId, onComplete)
   ```

2. **Drawer öffnet sich**
   - UploaderField wird initialisiert
   - User wählt Bild (Drag&Drop oder Browse)

3. **Validierung**
   - Dateigröße ≤ 200 KB
   - Typ: PNG oder JPG

4. **Upload zu Supabase**
   - Alte Bilder werden gelöscht
   - Neues Bild wird hochgeladen: `{auth_user_id}/profile.{ext}`
   - Public URL generiert

5. **DB Update**
   ```javascript
   UPDATE benutzer 
   SET profile_image_url = '{public_url}',
       updated_at = NOW()
   WHERE id = '{user_id}'
   ```

6. **UI Refresh**
   - `currentUser.profile_image_url` aktualisiert
   - Header-Avatar aktualisiert
   - Profilseite neu geladen

## Testing

### Als Kunde:
1. Auf "Mein Profil" navigieren
2. Auf Avatar klicken
3. Bild hochladen (< 200 KB, PNG/JPG)
4. ✅ Avatar sollte sich aktualisieren
5. ✅ Header-Avatar sollte sich aktualisieren

### Als Mitarbeiter:
- Gleicher Ablauf

### Edge Cases:
- ❌ Datei > 200 KB → Fehler-Toast
- ❌ Falscher Typ (PDF, etc.) → Fehler-Toast
- ❌ Keine Datei ausgewählt → "Bitte wähle ein Bild aus"

## Code-Wiederverwendung

**Von Unternehmen/Marken übernommen:**
1. ✅ `UploaderField` - Drag&Drop-Komponente
2. ✅ Drawer-Struktur & CSS
3. ✅ Validierungs-Logik (200 KB, PNG/JPG)
4. ✅ Supabase Storage Upload-Flow
5. ✅ Altes Bild löschen vor neuem Upload

**Unterschiede:**
- 🔄 Storage-Path: `{auth_user_id}/profile.{ext}` statt `{entity}/{id}/logo.{ext}`
- 🔄 DB-Tabelle: `benutzer` statt `unternehmen`/`marke`
- 🔄 Bucket: `profile-images` statt `logos`

## Nächste Schritte (Optional)

- [ ] Bildkomprimierung vor Upload (Browser-seitig)
- [ ] Cropping-Tool (z.B. Cropper.js)
- [ ] Thumbnail-Generierung
- [ ] Lazy Loading für Profilbilder
- [ ] CDN-Integration

## Troubleshooting

### Upload schlägt fehl
1. Check Storage Policies: `SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'`
2. Check Bucket-Konfiguration
3. Check Browser Console für Fehler

### Bild wird nicht angezeigt
1. Check `profile_image_url` in DB
2. Check Public Access auf Bucket
3. Check CORS-Konfiguration

### Header aktualisiert nicht
1. Check `window.currentUser` Objekt
2. Check `setupHeaderUI()` Funktion
3. Seite neu laden

