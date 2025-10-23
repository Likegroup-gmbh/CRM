# Briefing Upload - Security Dokumentation

## Übersicht

Das Briefing-Upload-Feature ermöglicht das sichere Hochladen und Verwalten von PDFs und Bildern für Briefings. Diese Dokumentation beschreibt die implementierten Security-Maßnahmen und notwendigen manuellen Schritte.

## ✅ Implementierte Security-Features

### 1. Client-seitige Validierung
- **Dateigröße**: Max 10 MB pro Datei (Pre-Check vor Upload)
- **Content-Type Whitelist**: Nur erlaubt:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/gif`
  - `image/webp`
- **Filename Sanitization**: 
  - Entfernung gefährlicher Zeichen (nur `a-zA-Z0-9._-`)
  - Path Traversal Prevention (`..` wird entfernt)
  - Max. 200 Zeichen
- **XSS Prevention**: Alle User-Inputs (Dateinamen, URLs) werden escaped

### 2. Storage-Struktur
```
documents/
  ├── briefings/
  │   └── {briefing_id}/
  │       └── {timestamp}_{random}_{sanitized_filename}
  └── kampagnen/
      └── {kampagne_id}/
          └── ...
```

### 3. Datenbank RLS Policies
✅ **briefing_documents** Tabelle hat vollständige Row Level Security:
- **SELECT**: Admin/Mitarbeiter sehen alles, Kunden nur ihre eigenen
- **INSERT**: Nur Admin/Mitarbeiter
- **UPDATE**: Nur Admin/Mitarbeiter
- **DELETE**: Nur Admin/Mitarbeiter

### 4. Error Handling
- Keine sensitiven Informationen in Error Messages
- Graceful Degradation: Briefing wird auch ohne Dokumente erstellt
- Detaillierte Logs für Debugging (nur Console)

### 5. Best Practices
- ✅ Signierte URLs (7 Tage Gültigkeit) statt öffentlicher URLs
- ✅ UNIQUE Constraint auf `file_path` (keine Duplikate)
- ✅ CASCADE DELETE bei Briefing-Löschung
- ✅ Timestamp + Random String im Dateinamen (Collision Prevention)
- ✅ Content-Type aus File Object (nicht aus User Input)

## ⚠️ WICHTIG: Manuelle Schritte in Supabase

### Schritt 1: SQL Migration ausführen

```bash
# In Supabase SQL Editor ausführen:
```
Datei: `create_briefing_documents_table.sql` im Projektverzeichnis

### Schritt 2: Storage Bucket erstellen

1. **Supabase Dashboard öffnen**: `Storage` → `New Bucket`
2. **Bucket Konfiguration**:
   - Name: `documents`
   - Public: **Nein** ❌ (wichtig für Security!)
   - File size limit: `10485760` (10 MB)
   - Allowed MIME types: `application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.*`

### Schritt 3: Storage Policies erstellen

Im Supabase Dashboard unter `Storage` → `documents` → `Policies`:

#### Policy 1: Upload Permission
```sql
CREATE POLICY "Mitarbeiter können Dokumente hochladen"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] IN ('briefings', 'kampagnen')
  AND EXISTS (
    SELECT 1 FROM benutzer 
    WHERE id = auth.uid() 
    AND rolle IN ('admin', 'mitarbeiter')
  )
);
```

#### Policy 2: Download Permission (KRITISCH!)
```sql
CREATE POLICY "Berechtigte können Dokumente herunterladen"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    -- Admin und Mitarbeiter sehen alles
    EXISTS (
      SELECT 1 FROM benutzer 
      WHERE id = auth.uid() 
      AND rolle IN ('admin', 'mitarbeiter')
    )
    OR
    -- Kunden sehen nur ihre eigenen Briefing-Dokumente
    (
      (storage.foldername(name))[1] = 'briefings'
      AND EXISTS (
        SELECT 1 FROM briefing_documents bd
        JOIN briefings b ON bd.briefing_id = b.id
        JOIN marke m ON b.marke_id = m.id
        JOIN kunden_marken km ON m.id = km.marke_id
        WHERE bd.file_path = name
        AND km.kunde_id = auth.uid()
      )
    )
  )
);
```

#### Policy 3: Delete Permission
```sql
CREATE POLICY "Mitarbeiter können Dokumente löschen"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM benutzer 
    WHERE id = auth.uid() 
    AND rolle IN ('admin', 'mitarbeiter')
  )
);
```

## 🔒 Security Checklist

Vor Produktiv-Deployment prüfen:

- [ ] SQL Migration erfolgreich ausgeführt
- [ ] Storage Bucket `documents` als **privat** erstellt
- [ ] Alle 3 Storage Policies aktiviert
- [ ] Download Policy testet Kunden-Zugriff korrekt
- [ ] RLS Policies für `briefing_documents` aktiviert
- [ ] Test: Admin kann hochladen und sehen
- [ ] Test: Mitarbeiter kann hochladen und sehen
- [ ] Test: Kunde sieht nur eigene Briefing-Dokumente
- [ ] Test: Nicht-authentifizierte User haben keinen Zugriff
- [ ] Test: Dateigrößen-Limit wird eingehalten
- [ ] Test: Ungültige Content-Types werden abgelehnt

## 🚨 Bekannte Einschränkungen

1. **Signierte URLs laufen ab**: Nach 7 Tagen müssen URLs erneuert werden
   - **Lösung**: Zukünftig On-Demand URL Refresh implementieren
   
2. **Client-seitige Validation kann umgangen werden**: 
   - **Mitigation**: Storage Bucket hat server-seitige Limits
   - **Wichtig**: Storage Policies sind die eigentliche Sicherheitsebene

3. **Content-Type Spoofing möglich**:
   - **Mitigation**: Browser validiert beim Download
   - **Empfehlung**: Zukünftig Magic Bytes Check auf Server

## 📊 Performance-Optimierungen

- **Lazy Loading**: Dokumente werden nur bei Bedarf geladen
- **Indexed Queries**: `briefing_id` hat Index
- **Sequential Upload**: Verhindert Überlastung
- **Cache-Control**: 3600s für Storage Objects

## 🔄 Zukünftige Verbesserungen

1. [ ] Automatisches URL Refresh vor Ablauf
2. [ ] Magic Bytes Validation (serverseitig)
3. [ ] Virus-Scanning Integration (z.B. ClamAV)
4. [ ] Thumbnail-Generierung für Bilder
5. [ ] Batch-Upload Fortschrittsanzeige
6. [ ] Dokument-Versionierung
7. [ ] Audit-Log für Dokument-Zugriffe

## 💡 Testing Guide

### Test 1: Upload als Mitarbeiter
```javascript
// Im Browser Console nach Login als Mitarbeiter:
// 1. Navigiere zu /briefing/new
// 2. Fülle Formular aus
// 3. Lade 2-3 PDFs hoch (< 10 MB)
// 4. Submit
// 5. Überprüfe: Dokumente erscheinen in Detail-View
```

### Test 2: Zugriff als Kunde
```javascript
// Im Browser Console nach Login als Kunde:
// 1. Navigiere zu einem Briefing des Kunden
// 2. Überprüfe: Dokumente sind sichtbar
// 3. Klicke auf Download-Link
// 4. Überprüfe: Download funktioniert

// 5. Navigiere zu einem FREMDEN Briefing (andere Marke)
// 6. Überprüfe: Keine Dokumente sichtbar ODER 403 Fehler
```

### Test 3: Ungültige Uploads
```javascript
// Test mit:
// - Datei > 10 MB → Sollte abgelehnt werden
// - .exe Datei → Sollte abgelehnt werden
// - Dateiname mit ../ → Sollte sanitized werden
```

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfe Supabase Logs: `Logs` → `Storage`
2. Prüfe Browser Console für Client-Fehler
3. Prüfe RLS Policy Rules in Supabase Dashboard

---

**Erstellt**: 2025-10-23  
**Version**: 1.0  
**Status**: Ready for Production (nach manuellen Schritten)

