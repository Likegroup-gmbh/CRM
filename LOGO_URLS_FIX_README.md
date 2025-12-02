# Logo-URLs Fix - Implementierungsanleitung

## Problem
Die Logo-URLs für Marken, Unternehmen und Mitarbeiter-Profilbilder verwenden signierte URLs, die nach 7 Tagen ablaufen. Dadurch werden alte Logos nicht mehr angezeigt.

## Lösung
Den Storage Bucket `logos` öffentlich machen und das System auf permanente öffentliche URLs umstellen.

## Schritte zur Ausführung

### 1. Storage Bucket auf public setzen

**Option A: Über Supabase Dashboard (empfohlen)**
1. Gehe zu: https://supabase.com/dashboard/project/{YOUR_PROJECT}/storage/buckets/logos
2. Klicke auf "Settings" (Zahnrad-Icon)
3. Aktiviere "Public bucket"
4. Speichern

**Option B: Über SQL (falls verfügbar)**
```sql
-- Ausführen in SQL Editor mit service_role Berechtigung
UPDATE storage.buckets SET public = true WHERE name = 'logos';
```

### 2. Bestehende URLs migrieren

Führe die Migration aus: `migrate_logos_to_public_urls.sql`

```bash
# In Supabase SQL Editor
\i migrate_logos_to_public_urls.sql
```

Diese Migration:
- Konvertiert alle `logo_url` Felder von signierten URLs zu öffentlichen URLs
- Verwendet `logo_path` um die neue URL zu generieren
- Format: `https://yktycclozgsgaasduyol.supabase.co/storage/v1/object/public/logos/{logo_path}`

### 3. Code-Änderungen (bereits durchgeführt)

Folgende Dateien wurden bereits angepasst, um öffentliche URLs zu verwenden:
- ✅ `src/core/LogoUploadHelper.js`
- ✅ `src/core/form/FormSystem.js`
- ✅ `src/modules/marke/MarkeCreate.js`
- ✅ `src/modules/marke/MarkeDetail.js`
- ✅ `src/modules/unternehmen/UnternehmenCreate.js`
- ✅ `src/modules/unternehmen/UnternehmenDetail.js`

Geändert von:
```javascript
const { data: signed, error: signErr } = await window.supabase.storage
  .from(bucket)
  .createSignedUrl(path, 60 * 60 * 24 * 7);
const logo_url = signed?.signedUrl || '';
```

Zu:
```javascript
const { data: publicUrlData } = window.supabase.storage
  .from(bucket)
  .getPublicUrl(path);
const logo_url = publicUrlData?.publicUrl || '';
```

### 4. Testing

Nach der Migration prüfen:

**A) Alte Logos anzeigen:**
1. Öffne Ansprechpartner-Liste
2. Prüfe ob Marken- und Unternehmen-Logos angezeigt werden
3. Prüfe Unternehmen-Liste
4. Prüfe Marken-Liste

**B) Neue Logos hochladen:**
1. Erstelle ein neues Unternehmen mit Logo
2. Prüfe ob Logo sofort angezeigt wird
3. Erstelle eine neue Marke mit Logo
4. Prüfe ob Logo sofort angezeigt wird

**C) URL-Format prüfen:**
```sql
-- Sollte nur noch öffentliche URLs zeigen
SELECT markenname, logo_url 
FROM marke 
WHERE logo_url LIKE '%/public/logos/%' 
LIMIT 5;

SELECT firmenname, logo_url 
FROM unternehmen 
WHERE logo_url LIKE '%/public/logos/%' 
LIMIT 5;
```

## Rollback (falls nötig)

Falls Probleme auftreten:

1. Bucket wieder auf private setzen:
```sql
UPDATE storage.buckets SET public = false WHERE name = 'logos';
```

2. Code-Änderungen rückgängig machen (git revert)

3. URLs wieder zu signierten URLs konvertieren (komplexer, besser vermeiden)

## Sicherheit

- ✅ Bucket ist öffentlich **lesbar** (GET)
- ✅ Schreibrechte (Upload/Delete) bleiben durch RLS Policies geschützt
- ✅ Nur authentifizierte User mit entsprechenden Rechten können Logos hochladen
- ✅ Sensible Dokumente (Briefings, Belege) bleiben in privaten Buckets

## Hinweise

- `profile-images` Bucket ist bereits öffentlich und verwendet `getPublicUrl` (keine Änderung nötig)
- Andere Buckets (`briefing-documents`, `rechnung-belege`, etc.) bleiben privat mit signierten URLs
- Die Änderung betrifft nur den `logos` Bucket










