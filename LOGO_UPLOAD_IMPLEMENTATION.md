# Logo-Upload Feature - Implementierungs-Dokumentation

## ✅ Implementiert

Das Logo-Upload-Feature für Unternehmen und Marken wurde vollständig implementiert.

## 📋 Überblick

- **Dateiformate**: PNG, JPG
- **Maximale Dateigröße**: 200 KB
- **Upload-Möglichkeit**: Beim Erstellen UND Bearbeiten
- **Logo-Anzeige**: 
  - In Detailansichten (Header-Bereich)
  - In Listen-Bubbles (falls vorhanden, sonst Initialen)
- **Verhalten**: Altes Logo wird überschrieben (ein Logo pro Entität)

## 🗂️ Geänderte/Neue Dateien

### Neue Dateien

1. **`add_logo_fields_unternehmen_marke.sql`**
   - Datenbank-Migration
   - Fügt `logo_url` und `logo_path` zu `unternehmen` und `marke` Tabellen hinzu
   - Storage Policy Templates (als Kommentare)

2. **`src/core/LogoUploadHelper.js`**
   - Wiederverwendbare Logo-Upload-Logik
   - Security-Validierung (Dateigröße, Format)
   - Signierte URL-Generierung

3. **`LOGO_UPLOAD_IMPLEMENTATION.md`** (diese Datei)
   - Vollständige Dokumentation

### Geänderte Dateien

#### 1. **`src/core/form/FormConfig.js`**
- Logo-Upload-Feld für `unternehmen` hinzugefügt (Zeile 73)
- Logo-Upload-Feld für `marke` hinzugefügt (Zeile 220)
```javascript
{ name: 'logo_file', label: 'Logo', type: 'custom', customType: 'uploader', 
  accept: 'image/png,image/jpeg', multiple: false, required: false }
```

#### 2. **`src/core/components/AvatarBubbles.js`**
- Logo-Support in `renderBubbles()` Methode
- Wenn `logo_url` vorhanden: `<img>` Tag statt Initialen
- Neue Klassen: `avatar-bubble--with-logo`, `avatar-bubble-logo`

#### 3. **`src/modules/unternehmen/UnternehmenCreate.js`**
- Neue Methode: `uploadLogo(unternehmenId, form)`
- Logo-Upload nach Entity-Erstellung (Zeile 660)
- Security-Validierung (200 KB, PNG/JPG)

#### 4. **`src/modules/unternehmen/UnternehmenDetail.js`**
- Neue Methoden:
  - `uploadLogo(unternehmenId, form)` - Logo-Upload im Edit-Mode
  - `handleEditFormSubmit(form)` - Custom Submit Handler
- Logo-Anzeige in `renderInformationen()` (Zeilen 429-433)
- Custom Submit Handler bindet Logo-Upload (Zeilen 1136-1142)

#### 5. **`assets/styles/dashboard.css`**
- Avatar-Bubble Logo-Styles (Zeilen 4045-4057):
  - `.avatar-bubble--with-logo`
  - `.avatar-bubble-logo`
- Detail-Logo-Styles (Zeilen 4062-4088):
  - `.detail-logo`
  - `.logo-image`
  - Responsive Anpassungen

## ⚙️ WICHTIG: Manuelle Schritte in Supabase Dashboard

### 1. SQL-Migration ausführen

Führe die Datei `add_logo_fields_unternehmen_marke.sql` im Supabase SQL Editor aus:

```sql
-- Fügt logo_url und logo_path Spalten zu unternehmen und marke Tabellen hinzu
ALTER TABLE unternehmen
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_path TEXT;

ALTER TABLE marke
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_path TEXT;
```

### 2. Storage Bucket erstellen

**Supabase Dashboard → Storage → New Bucket**

- **Name**: `logos`
- **Public**: ❌ NEIN (privat!)
- **File size limit**: `204800` (200 KB)
- **Allowed MIME types**: `image/png,image/jpeg,image/jpg`

### 3. Storage Policies erstellen

**Supabase Dashboard → Storage → logos → Policies**

#### Policy 1: Upload Permission (INSERT)
```sql
CREATE POLICY "Mitarbeiter können Logos hochladen"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos' 
  AND (storage.foldername(name))[1] IN ('unternehmen', 'marke')
  AND EXISTS (
    SELECT 1 FROM benutzer 
    WHERE id = auth.uid() 
    AND rolle IN ('admin', 'mitarbeiter')
  )
);
```

#### Policy 2: View Permission (SELECT)
```sql
CREATE POLICY "Authentifizierte Benutzer können Logos sehen"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN ('unternehmen', 'marke')
);
```

#### Policy 3: Update Permission
```sql
CREATE POLICY "Mitarbeiter können Logos aktualisieren"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN ('unternehmen', 'marke')
  AND EXISTS (
    SELECT 1 FROM benutzer 
    WHERE id = auth.uid() 
    AND rolle IN ('admin', 'mitarbeiter')
  )
);
```

#### Policy 4: Delete Permission
```sql
CREATE POLICY "Mitarbeiter können Logos löschen"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN ('unternehmen', 'marke')
  AND EXISTS (
    SELECT 1 FROM benutzer 
    WHERE id = auth.uid() 
    AND rolle IN ('admin', 'mitarbeiter')
  )
);
```

## 🔒 Security-Features

### Client-seitige Validierung
- **Dateigröße**: Max. 200 KB (Pre-Check vor Upload)
- **Content-Type Whitelist**: Nur `image/png` und `image/jpeg`
- **Filename Sanitization**: Sichere Dateinamen durch Verwendung von `logo.{ext}`

### Storage-Struktur
```
logos/
  ├── unternehmen/
  │   └── {unternehmen_id}/
  │       └── logo.{ext}  (überschreibt altes Logo)
  └── marke/
      └── {marke_id}/
          └── logo.{ext}  (überschreibt altes Logo)
```

### Best Practices
- ✅ Signierte URLs (7 Tage Gültigkeit)
- ✅ Altes Logo wird automatisch gelöscht
- ✅ RLS Policies schützen Upload/Download
- ✅ Nur Mitarbeiter/Admin können hochladen
- ✅ Alle authentifizierten Benutzer können sehen

## 📊 Technische Details

### Upload-Flow
1. User wählt Logo im Formular (max. 200 KB, PNG/JPG)
2. Formular wird abgesendet
3. Entity wird erstellt/aktualisiert
4. Logo-Upload wird ausgeführt:
   - Alte Logos werden gelöscht
   - Neues Logo wird hochgeladen
   - Signierte URL wird erstellt (7 Tage)
   - URL wird in Datenbank gespeichert

### Display-Flow
- **Detailansicht**: Logo wird oben in der Detailansicht angezeigt (`.detail-logo`)
- **Listen-Bubbles**: Logo wird in Avatar-Bubbles angezeigt (falls vorhanden)
- **Fallback**: Wenn kein Logo vorhanden, werden Initialen angezeigt

## ✅ Testing Checklist

- [ ] SQL-Migration ausgeführt
- [ ] Storage Bucket `logos` erstellt (privat!)
- [ ] Alle 4 Storage Policies aktiv
- [ ] Logo-Upload beim Erstellen (Unternehmen)
- [ ] Logo-Upload beim Erstellen (Marke)
- [ ] Logo-Upload beim Bearbeiten (Unternehmen)
- [ ] Logo-Upload beim Bearbeiten (Marke)
- [ ] Altes Logo wird überschrieben
- [ ] Logo wird in Detailansicht angezeigt
- [ ] Logo wird in Listen-Bubbles angezeigt (falls vorhanden)
- [ ] Initialen werden angezeigt, wenn kein Logo vorhanden
- [ ] Dateigröße-Validierung funktioniert (200 KB)
- [ ] Dateiformat-Validierung funktioniert (PNG, JPG)
- [ ] Signierte URLs funktionieren
- [ ] Storage Policies funktionieren korrekt

## 🐛 Troubleshooting

### Problem: Logo wird nicht hochgeladen

**Lösung:**
1. Prüfen, dass Storage Bucket `logos` existiert und privat ist
2. Prüfen, dass alle 4 Storage Policies aktiv sind
3. Console-Logs prüfen (Browser Developer Tools)
4. Supabase Storage Logs prüfen

### Problem: Logo wird nicht angezeigt

**Lösung:**
1. Prüfen, dass `logo_url` in Datenbank gespeichert wurde
2. Prüfen, dass signierte URL nicht abgelaufen ist (7 Tage)
3. Prüfen, dass SELECT Policy für Storage aktiv ist
4. Browser Console auf Fehler prüfen

### Problem: "Access Denied" beim Upload

**Lösung:**
1. Prüfen, dass User als `admin` oder `mitarbeiter` eingeloggt ist
2. Prüfen, dass INSERT Policy korrekt konfiguriert ist
3. Prüfen, dass `benutzer.rolle` korrekt gesetzt ist

## 📚 Referenzen

- Briefing-Upload Implementation: `BRIEFING_UPLOAD_IMPLEMENTATION.md`
- Briefing-Upload Security: `BRIEFING_UPLOAD_SECURITY.md`
- Supabase Storage Docs: https://supabase.com/docs/guides/storage

## 🎉 Fertig!

Das Logo-Upload-Feature ist vollständig implementiert und einsatzbereit. Nach Ausführung der manuellen Schritte in Supabase Dashboard können Logos hochgeladen und angezeigt werden.








