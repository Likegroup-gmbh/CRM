# Debug: Logo Upload bei Unternehmen-Erstellung

## Problem
Beim Erstellen eines Unternehmens wird das Logo nicht gespeichert.

## Checkliste für Debugging

### 1. Storage Bucket prüfen
```sql
SELECT name, id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'logos';
```
✅ Bucket existiert: `logos` (limit: 204800 bytes = 200KB)

### 2. Storage Policies prüfen
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%Logo%'
ORDER BY policyname;
```

**Gefundene Policies:**
- ✅ `Logo Ansicht für alle authentifizierten User` (SELECT)
- ✅ `Logo Delete für Mitarbeiter` (DELETE)
- ✅ `Logo Update für Mitarbeiter` (UPDATE)
- ✅ `Logo Upload für Mitarbeiter` (INSERT)

**INSERT Policy Details:**
```
with_check: 
  bucket_id = 'logos'::text 
  AND (storage.foldername(name))[1] = ANY (ARRAY['unternehmen'::text, 'marke'::text])
  AND EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.auth_user_id = auth.uid()
    AND benutzer.rolle = ANY (ARRAY['admin'::text, 'mitarbeiter'::text])
  )
```

### 3. Code Flow prüfen

**UnternehmenCreate.js:**
1. Line 639: `createEntity('unternehmen', data)` - Unternehmen wird erstellt
2. Line 650: `uploadLogo(result.id, form)` - Logo-Upload wird aufgerufen
3. Line 707-811: `uploadLogo()` Methode

**Potenzielle Fehlerquellen:**
- Line 710-713: Kein Logo ausgewählt → wird übersprungen (nur console.log)
- Line 729-732: Datei zu groß → alert + return
- Line 736-739: Falscher Dateityp → alert + return
- Line 775-777: Upload-Fehler → console.error + throw
- Line 800-803: DB-Update-Fehler → console.error + throw

### 4. Browser Console Tests

**Test 1: Prüfe ob Uploader-Instanz existiert**
```javascript
// In Browser Console auf Unternehmen-Erstellen-Seite:
const uploaderRoot = document.querySelector('.uploader[data-name="logo_file"]');
console.log('Uploader Root:', uploaderRoot);
console.log('Uploader Instance:', uploaderRoot?.__uploaderInstance);
console.log('Files:', uploaderRoot?.__uploaderInstance?.files);
```

**Test 2: Prüfe Benutzer-Rolle**
```javascript
// In Browser Console:
console.log('Current User:', window.currentUser);
console.log('Rolle:', window.currentUser?.rolle);

// Sollte 'admin' oder 'mitarbeiter' sein für Upload
```

**Test 3: Manueller Upload-Test**
```javascript
// In Browser Console nach Upload-Versuch:
const bucket = 'logos';
const testPath = 'unternehmen/test-id/logo.png';

// Test ob Bucket zugreifbar ist
const { data: files, error: listError } = await window.supabase.storage
  .from(bucket)
  .list('');

console.log('Files:', files);
console.log('List Error:', listError);
```

**Test 4: Policy-Test (als Mitarbeiter)**
```javascript
// In Browser Console:
const { data: benutzer } = await window.supabase
  .from('benutzer')
  .select('*')
  .eq('auth_user_id', window.supabase.auth.user().id)
  .single();

console.log('Benutzer:', benutzer);
console.log('Rolle:', benutzer?.rolle);

// Sollte 'admin' oder 'mitarbeiter' sein
```

### 5. Mögliche Lösungen

#### Lösung A: Logo-Upload wird nicht aufgerufen
**Symptom:** Keine Logs in Console
**Fix:** Prüfe ob Form richtig übergeben wird

#### Lösung B: Uploader-Instanz nicht verfügbar
**Symptom:** `uploaderRoot.__uploaderInstance` ist `undefined`
**Fix:** Warte bis Uploader gemountet ist:
```javascript
// In uploadLogo() vor Zeile 709:
await new Promise(resolve => setTimeout(resolve, 100));
```

#### Lösung C: Storage Policy blockiert
**Symptom:** Error: "new row violates row-level security policy"
**Fix:** Prüfe ob Benutzer Mitarbeiter/Admin ist

#### Lösung D: Stille Fehler
**Symptom:** Kein Error, aber Logo nicht gespeichert
**Fix:** Mehr Logging hinzufügen:

```javascript
// In UnternehmenCreate.js Zeile 650 ersetzen:
try {
  console.log('🔵 START: Logo-Upload für Unternehmen', result.id);
  await this.uploadLogo(result.id, form);
  console.log('✅ Logo-Upload erfolgreich');
} catch (logoErr) {
  console.error('❌ Logo-Upload fehlgeschlagen:', logoErr);
  alert('Logo konnte nicht hochgeladen werden: ' + logoErr.message);
}
```

### 6. Quick Fix (Workaround)

Falls Logo-Upload weiterhin fehlschlägt, kann das Logo auch nachträglich im Edit-Modus hochgeladen werden:
1. Unternehmen erstellen (ohne Logo)
2. Unternehmen öffnen
3. Edit-Modus aktivieren
4. Logo hochladen
5. Speichern

---

## Nächste Schritte

1. **Console Logs prüfen:** Öffne Browser DevTools → Console
2. **Unternehmen erstellen mit Logo:** Wähle ein Logo aus und erstelle Unternehmen
3. **Schaue welcher Log-Eintrag erscheint:**
   - `ℹ️ Kein Logo zum Hochladen` → Uploader-Instanz Problem
   - `⚠️ Logo zu groß` → Datei > 200KB
   - `⚠️ Nicht erlaubter Dateityp` → Nur PNG/JPG erlaubt
   - `❌ Logo-Upload-Fehler` → Storage/Policy Problem
   - `❌ DB-Fehler` → Datenbank-Update fehlgeschlagen
   - Kein Log → uploadLogo() wird nicht aufgerufen




