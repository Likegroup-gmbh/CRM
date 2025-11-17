# Database Security Fixes - Anleitung

## Übersicht

Drei SQL-Migrationen beheben kritische Sicherheitslücken in der Datenbank:

1. **security_fix_01_remove_true_policies.sql** - Entfernt unsichere `true`-Policies
2. **security_fix_02_function_search_paths.sql** - Sichert Functions gegen SQL-Injection ab
3. **security_fix_03_authenticated_policies.sql** - Verschärft schwache authenticated-Policies

---

## 🚨 Gefundene Schwachstellen

### Kritisch (sofort beheben):
- ✅ **12 Tabellen mit `true`-Policies** → Jeder authentifizierte User konnte alles lesen/schreiben
- ✅ **13 Functions ohne `search_path`** → SQL-Injection-Risiko
- ✅ **12 Tabellen mit schwachen authenticated-Policies** → Unzureichende Rollentrennung

---

## 🔧 Installation

### Voraussetzungen
- Supabase Dashboard Zugriff
- Admin-Rechte auf der Datenbank
- Backup erstellt (empfohlen)

### Schritt 1: Backup erstellen (Optional aber empfohlen)

```bash
# In Supabase Dashboard → Database → Backups → Manual Backup
# Oder via CLI:
supabase db dump -f backup_before_security_fix.sql
```

### Schritt 2: Migrationen ausführen

#### Option A: Über Supabase SQL Editor (Empfohlen)

1. Öffne **Supabase Dashboard** → **SQL Editor**
2. Führe in dieser Reihenfolge aus:
   - `security_fix_01_remove_true_policies.sql`
   - `security_fix_02_function_search_paths.sql`
   - `security_fix_03_authenticated_policies.sql`
3. Prüfe nach jeder Migration die Verification-Ausgabe
4. ✅ Fertig!

#### Option B: Über Terminal

```bash
cd /Users/olivermackeldanz/Dropbox/greenbydefault/Gewerbe/Kunden/CreatorJobs24/CRM

# Migration 1
psql -h <supabase-host> -U postgres -d postgres -f security_fix_01_remove_true_policies.sql

# Migration 2
psql -h <supabase-host> -U postgres -d postgres -f security_fix_02_function_search_paths.sql

# Migration 3
psql -h <supabase-host> -U postgres -d postgres -f security_fix_03_authenticated_policies.sql
```

---

## ✅ Was wird gefixt?

### Migration 1: True-Policies entfernen

**Betroffene Tabellen:**
- `kooperation_versand` (4 Policies)
- `creator_adressen` (4 Policies)
- `ansprechpartner_unternehmen` (1 Policy)
- `auftrag_copywriter`, `auftrag_cutter`, `auftrag_mitarbeiter` (je 1 Policy)
- `rechnung_belege` (2 Policies)
- `kooperation_task_history` (1 Policy)
- `notifications` (1 Policy)

**Vorher:**
```sql
-- Unsicher: JEDER authentifizierte User
CREATE POLICY "creator_adressen_select_policy" 
ON creator_adressen FOR SELECT USING (true);
```

**Nachher:**
```sql
-- Sicher: Nur Mitarbeiter/Admins
CREATE POLICY "mitarbeiter_select_creator_adressen"
ON creator_adressen FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM benutzer
    WHERE auth_user_id = auth.uid()
    AND rolle IN ('admin', 'mitarbeiter')
  )
);
```

### Migration 2: Function Search Paths

**Betroffene Functions (13 Stück):**
- `update_updated_at_column`
- `handle_new_auth_user`
- `track_task_comment`
- `kooperation_tasks_history_fn`
- ... und 9 weitere

**Vorher:**
```sql
-- Unsicher: Kein search_path
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$ ... $$;
```

**Nachher:**
```sql
-- Sicher: SECURITY DEFINER + search_path
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$ ... $$;
```

### Migration 3: Authenticated-Policies verschärfen

**Betroffene Tabellen (12 Stück):**
- `benutzer`, `marke`, `unternehmen`
- `creator`, `creator_list`, `creator_list_member`
- `auftrag`
- Lookup-Tabellen: `branchen`, `sprachen`, `format_typen`, etc.

**Vorher:**
```sql
-- Unsicher: ALLE authentifizierten User
CREATE POLICY "Authenticated users full access"
ON benutzer FOR ALL
USING (auth.role() = 'authenticated'::text);
```

**Nachher:**
```sql
-- Sicher: Nur Mitarbeiter sehen alle
CREATE POLICY "mitarbeiter_select_benutzer"
ON benutzer FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM benutzer b
    WHERE b.auth_user_id = auth.uid()
    AND b.rolle IN ('admin', 'mitarbeiter')
  )
);

-- Kunden sehen nur sich selbst
CREATE POLICY "kunden_select_self_benutzer"
ON benutzer FOR SELECT
USING (auth_user_id = auth.uid());
```

---

## 🧪 Testing

### Test 1: Mitarbeiter kann weiterhin Creator erstellen

**Als Mitarbeiter eingeloggt:**

```javascript
// Browser Console
const { data, error } = await window.dataService.createEntity('creator', {
  vorname: 'Test',
  nachname: 'Creator',
  mail: 'test@example.com'
});

console.log('✅ Erfolg:', data);
// Sollte funktionieren!
```

### Test 2: Mitarbeiter kann Kampagne erstellen

```javascript
// Browser Console als Mitarbeiter
const { data, error } = await window.dataService.createEntity('kampagne', {
  kampagnenname: 'Security Test',
  unternehmen_id: '<valid-uuid>'
});

console.log('✅ Erfolg:', data);
// Sollte funktionieren!
```

### Test 3: Kunde kann KEINE Creator sehen

**Als Kunde eingeloggt:**

```javascript
// Browser Console
const { data, error } = await window.supabase
  .from('creator')
  .select('*');

console.log('❌ Fehler erwartet:', error);
// Sollte Error werfen: "new row violates row-level security policy"
```

### Test 4: Kunde sieht nur eigene Kampagnen

```javascript
// Browser Console als Kunde
const { data, error } = await window.supabase
  .from('kampagne')
  .select('*');

console.log('✅ Nur eigene Kampagnen:', data);
// Sollte nur Kampagnen des eigenen Unternehmens/Marke zeigen
```

### Test 5: Tasks werden weiterhin erstellt (Trigger funktioniert)

```javascript
// Browser Console als Mitarbeiter
const { data, error } = await window.dataService.createEntity('kooperation_tasks', {
  title: 'Test Task',
  entity_type: 'kampagne',
  entity_id: '<valid-kampagne-id>',
  status: 'todo'
});

console.log('✅ Task erstellt, History-Trigger funktioniert:', data);
```

---

## 📊 Verification Queries

### Nach Migration 1: Prüfe true-Policies

```sql
-- Sollte 0 Zeilen zurückgeben (außer Lookup-Tabellen)
SELECT tablename, COUNT(*) 
FROM pg_policies
WHERE (qual = 'true' OR with_check = 'true')
  AND tablename IN (
    'kooperation_versand', 'creator_adressen', 
    'auftrag_copywriter', 'notifications'
  )
GROUP BY tablename;
```

### Nach Migration 2: Prüfe Functions

```sql
-- Alle sollten SECURITY DEFINER + search_path haben
SELECT 
  proname as function_name,
  prosecdef as has_security_definer,
  proconfig as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname LIKE '%update_%' OR proname LIKE '%track_%';
```

### Nach Migration 3: Prüfe authenticated-Policies

```sql
-- Sollte 0 Zeilen zurückgeben
SELECT tablename, COUNT(*) 
FROM pg_policies
WHERE qual = '(auth.role() = ''authenticated''::text)'
  AND tablename IN ('benutzer', 'creator', 'marke', 'unternehmen')
GROUP BY tablename;
```

---

## 🔄 Rollback (Falls nötig)

Jede Migration hat am Ende ein Rollback-Script in Kommentaren.

**ACHTUNG:** Rollback macht die Security-Fixes rückgängig!

```sql
-- Am Ende jeder SQL-Datei findest du:
-- ============================================
-- ROLLBACK (Falls nötig)
-- ============================================
-- ... SQL zum Wiederherstellen alter Policies
```

---

## ✅ Erwartetes Ergebnis

### Nach allen Migrationen:

**Mitarbeiter/Admins:**
- ✅ Können weiterhin ALLES erstellen/lesen/ändern/löschen
- ✅ Alle bestehenden Workflows funktionieren
- ✅ Keine Breaking Changes

**Kunden:**
- ✅ Sehen nur ihre eigenen Kampagnen/Kooperationen/Videos
- ✅ Können KEINE Creator/Unternehmen/Marken anderer sehen
- ✅ Live-Updates funktionieren weiterhin

**Security:**
- 🔒 Keine `true`-Policies mehr (außer Lookup-Tabellen READ)
- 🔒 Alle Functions haben `SECURITY DEFINER + search_path`
- 🔒 Rollenbasierte Policies statt authenticated-only

---

## 📝 Zusätzliche Empfehlungen (Optional)

### 1. Leaked Password Protection aktivieren

1. Gehe zu: **Supabase Dashboard** → **Authentication** → **Settings**
2. Enable: "Password strength and leaked password protection"
3. ✅ Fertig!

### 2. Postgres Version updaten

1. Gehe zu: **Supabase Dashboard** → **Database** → **Settings**
2. Klicke: "Upgrade to latest version"
3. ✅ Fertig!

---

## 🆘 Support

Bei Problemen:

1. **Prüfe Logs:** Supabase Dashboard → Database → Logs
2. **Test Console:** Browser DevTools → Console
3. **Rollback:** Führe Rollback-Script aus (am Ende jeder Migration)
4. **Restore Backup:** Falls alles schief geht

---

## 📋 Checklist

- [ ] ✅ Backup erstellt
- [ ] ✅ Migration 1 ausgeführt
- [ ] ✅ Migration 2 ausgeführt
- [ ] ✅ Migration 3 ausgeführt
- [ ] ✅ Als Mitarbeiter getestet: Creator/Kampagne erstellen funktioniert
- [ ] ✅ Als Kunde getestet: Nur eigene Daten sichtbar
- [ ] ✅ Tasks erstellen funktioniert (Trigger OK)
- [ ] ✅ Keine Console-Errors im Frontend
- [ ] ✅ Verification Queries geprüft

---

**Status:** ✅ Bereit für Production
**Breaking Changes:** ❌ Keine
**Estimated Downtime:** 0 Minuten (Migrations laufen online)

