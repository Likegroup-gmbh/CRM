# ⚠️ WICHTIG: Storage Bucket Setup

## Problem
Der Fehler **"new row violates row-level security policy"** tritt auf, wenn:
1. Der Storage Bucket `logos` nicht existiert
2. Die Storage Policies nicht korrekt konfiguriert sind
3. Der User nicht die richtigen Berechtigungen hat

## ✅ Lösung: Schritt-für-Schritt Anleitung

### Schritt 1: SQL-Migration ausführen
1. Öffne Supabase Dashboard → SQL Editor
2. Führe die Datei `add_logo_fields_unternehmen_marke.sql` aus
3. Bestätige, dass die Spalten hinzugefügt wurden:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('unternehmen', 'marke') 
AND column_name IN ('logo_url', 'logo_path');
```

### Schritt 2: Storage Bucket erstellen
1. **Supabase Dashboard → Storage → New Bucket**
2. Konfiguration:
   - **Name**: `logos`
   - **Public**: ❌ **NEIN (sehr wichtig!)**
   - **File size limit**: `204800` (200 KB in Bytes)
   - **Allowed MIME types**: `image/png,image/jpeg,image/jpg`

### Schritt 3: Storage Policies erstellen

**WICHTIG**: Die Policies müssen in dieser **exakten Reihenfolge** erstellt werden!

#### 1. INSERT Policy (Upload erlauben)
```sql
CREATE POLICY "Logo Upload für Mitarbeiter"
ON storage.objects 
FOR INSERT 
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

#### 2. SELECT Policy (Anzeigen erlauben)
```sql
CREATE POLICY "Logo Ansicht für alle authentifizierten User"
ON storage.objects 
FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN ('unternehmen', 'marke')
);
```

#### 3. UPDATE Policy (Aktualisieren erlauben)
```sql
CREATE POLICY "Logo Update für Mitarbeiter"
ON storage.objects 
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN ('unternehmen', 'marke')
  AND EXISTS (
    SELECT 1 FROM benutzer 
    WHERE id = auth.uid() 
    AND rolle IN ('admin', 'mitarbeiter')
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN ('unternehmen', 'marke')
);
```

#### 4. DELETE Policy (Löschen erlauben)
```sql
CREATE POLICY "Logo Delete für Mitarbeiter"
ON storage.objects 
FOR DELETE
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

### Schritt 4: Überprüfung

#### A) Prüfe ob Bucket existiert:
```sql
SELECT * FROM storage.buckets WHERE id = 'logos';
```
**Erwartetes Ergebnis**: Eine Zeile mit `id = 'logos'` und `public = false`

#### B) Prüfe ob Policies existieren:
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%ogo%';
```
**Erwartetes Ergebnis**: 4 Policies (INSERT, SELECT, UPDATE, DELETE)

#### C) Prüfe User-Rolle:
```sql
SELECT id, rolle FROM benutzer WHERE auth_user_id = auth.uid();
```
**Erwartetes Ergebnis**: Deine User-ID mit rolle = 'admin' oder 'mitarbeiter'

### Schritt 5: Test

Nach dem Setup:
1. Logout + Login (damit Policies neu geladen werden)
2. Öffne ein Unternehmen
3. Klicke "Bearbeiten"
4. Lade ein Logo hoch (max. 200 KB, PNG oder JPG)
5. Speichere

**Erwartetes Ergebnis**: 
- ✅ Logo wird hochgeladen
- ✅ Logo wird in der Detailansicht angezeigt
- ✅ Keine RLS-Fehler in der Console

## 🐛 Troubleshooting

### Fehler bleibt bestehen?

1. **Prüfe Browser Console**: Welche genaue Fehlermeldung?
2. **Prüfe Supabase Logs**: Dashboard → Logs → API
3. **Prüfe User-Rolle**: Ist der User als 'admin' oder 'mitarbeiter' eingeloggt?
4. **Cache leeren**: Logout → Browser-Cache leeren → Login
5. **Policies neu erstellen**: Lösche alle Logo-Policies und erstelle sie neu

### Häufige Fehler

**"bucket not found"**
→ Bucket `logos` wurde nicht erstellt oder hat falschen Namen

**"new row violates row-level security policy"**
→ INSERT Policy fehlt oder ist falsch konfiguriert

**"User rolle ist undefined"**
→ Benutzer hat keine Rolle in der `benutzer` Tabelle

## 📞 Support

Falls das Problem weiterhin besteht:
1. Führe alle Prüfungen aus Schritt 4 aus
2. Kopiere die Ergebnisse
3. Schicke mir die Ergebnisse + Browser Console Logs























