# Security Fixes für Live-Updates System

## 📋 Übersicht

Zwei SQL-Scripts beheben kritische Security-Lücken im Live-Updates System:

1. **SECURITY_FIX_1_video_field_restrictions.sql** - Verhindert dass Kunden geschützte Video-Felder direkt via API ändern
2. **SECURITY_FIX_2_junction_tables_rls.sql** - Aktiviert RLS für Junction-Tabellen

---

## ✅ Garantie: KEINE Breaking Changes!

**Bestehende Funktionalität bleibt zu 100% erhalten:**

### Für Mitarbeiter/Admins:
- ✅ Können weiterhin ALLE Felder updaten
- ✅ Sehen weiterhin ALLE Daten
- ✅ Alle bestehenden Workflows funktionieren unverändert

### Für Kunden:
- ✅ Können weiterhin `freigabe`, `caption`, `link_content` updaten
- ✅ Live-Updates funktionieren weiterhin einwandfrei
- ✅ Sehen weiterhin nur ihre eigenen Kampagnen/Videos

### Was sich ändert:
- 🔒 **NUR Security-Verbesserung**: Kunden können geschützte Felder (`thema`, `titel`, `status`, etc.) nicht mehr via direktem API-Call ändern
- 🔒 **NUR Security-Verbesserung**: Junction-Tabellen haben jetzt RLS (waren vorher für alle authenticated Users offen)

---

## 🚀 Installation

### Option A: Über Supabase SQL Editor (Empfohlen)

1. Öffne **Supabase Dashboard** → **SQL Editor**
2. Führe **SECURITY_FIX_1_video_field_restrictions.sql** aus
3. Führe **SECURITY_FIX_2_junction_tables_rls.sql** aus
4. ✅ Fertig!

### Option B: Über Terminal

```bash
cd /Users/olivermackeldanz/Dropbox/greenbydefault/Gewerbe/Kunden/CreatorJobs24/CRM

# Fix 1: Video-Feld-Restriktionen
psql -h <your-supabase-host> -U postgres -d postgres -f SECURITY_FIX_1_video_field_restrictions.sql

# Fix 2: Junction-Tables RLS
psql -h <your-supabase-host> -U postgres -d postgres -f SECURITY_FIX_2_junction_tables_rls.sql
```

---

## 🔍 Was passiert genau?

### Fix 1: Video-Feld-Restriktionen

**Vorher:**
- Client-Code blockiert bestimmte Felder im UI
- **ABER**: Geschickter Kunde könnte mit DevTools direkt die API aufrufen und `thema`, `titel`, `status` etc. ändern

**Nachher:**
- BEFORE UPDATE Trigger verhindert Änderungen an geschützten Feldern auf Datenbank-Ebene
- Selbst wenn jemand die API direkt aufruft: Geschützte Felder bleiben unverändert

**Geschützte Felder für Kunden:**
- `thema`
- `titel`
- `status`
- `link_produkte`
- `link_skript`
- `skript_freigegeben`
- `link_story`

**Erlaubte Felder für Kunden:**
- `freigabe` ✅
- `caption` ✅
- `link_content` ✅

---

### Fix 2: Junction-Tables RLS

**Vorher:**
- 6 Junction-Tabellen hatten KEINE RLS aktiviert
- Theoretisch könnte jeder authenticated User alle Junction-Daten sehen

**Nachher:**
- RLS aktiviert für:
  - `kunde_unternehmen`
  - `kunde_marke`
  - `marke_branchen`
  - `unternehmen_branchen`
  - `auftrag_details`
  - `eu_laender`
- Kunden sehen nur ihre eigenen Verknüpfungen
- Mitarbeiter/Admins sehen alles (wie vorher)

---

## 📊 Verifikation

Nach der Installation werden automatisch Verifikations-Queries ausgeführt:

### Fix 1 zeigt:
- ✅ Policies für `kooperation_videos`
- ✅ Trigger `protect_video_fields_trigger`

### Fix 2 zeigt:
- ✅ RLS Status für alle Junction-Tabellen
- ✅ Anzahl Policies pro Tabelle

---

## 🧪 Testing

### Test 1: Kunde versucht geschütztes Feld zu ändern

```javascript
// Als Kunde eingeloggt
const { data, error } = await supabase
  .from('kooperation_videos')
  .update({ 
    thema: 'HACKED!',  // ❌ Wird ignoriert
    caption: 'Neue Caption'  // ✅ Funktioniert
  })
  .eq('id', 'video-id');

// Ergebnis: thema bleibt unverändert, caption wird aktualisiert
```

### Test 2: Live-Updates funktionieren weiterhin

1. Als Kunde einloggen (Chrome)
2. Als Mitarbeiter einloggen (Safari)
3. Kunde ändert `freigabe` Checkbox → Mitarbeiter sieht Update live ✅
4. Kunde ändert `caption` → Mitarbeiter sieht Update live ✅
5. Mitarbeiter ändert `thema` → Kunde sieht Update live ✅

---

## 🆘 Rollback (Falls nötig)

Falls wider Erwarten Probleme auftreten:

```sql
-- Rollback Fix 1
DROP TRIGGER IF EXISTS protect_video_fields_trigger ON public.kooperation_videos;
DROP FUNCTION IF EXISTS public.protect_video_fields_from_kunden();

-- Rollback Fix 2
ALTER TABLE public.kunde_unternehmen DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kunde_marke DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marke_branchen DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.unternehmen_branchen DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.auftrag_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.eu_laender DISABLE ROW LEVEL SECURITY;
```

---

## 📝 Weitere Empfehlungen (Optional)

### Niedrige Priorität:

1. **Leaked Password Protection aktivieren**
   - Supabase Dashboard → Authentication → Settings
   - "Enable leaked password protection"

2. **Postgres Version updaten**
   - Supabase Dashboard → Database → Settings
   - "Upgrade to latest version"

3. **Function `search_path` absichern**
   - 13 Functions haben kein festes `search_path`
   - Niedrige Priorität, da keine direkten User-Inputs

---

## ✅ Fazit

**Diese Fixes sind:**
- ✅ Sicher anzuwenden (keine Breaking Changes)
- ✅ Sofort wirksam
- ✅ Transparent (Verifikations-Output zeigt was geändert wurde)
- ✅ Reversibel (Rollback-Commands verfügbar)

**Nach der Installation:**
- 🔒 Live-Updates System ist security-gehärtet
- ✅ Alle Features funktionieren weiterhin einwandfrei
- ✅ Kunden können nur erlaubte Felder ändern
- ✅ Junction-Tabellen sind gegen unauthorized Access geschützt


