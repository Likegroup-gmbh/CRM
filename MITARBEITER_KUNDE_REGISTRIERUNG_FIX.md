# Fix: Mitarbeiter wurden als Kunden registriert

## Problem

Der Mitarbeiter "sefa" wurde mit der falschen Rolle in der Datenbank registriert:
- **IST**: `rolle: 'user'`, `unterrolle: 'can_view'`
- **SOLL**: `rolle: 'pending'`, `unterrolle: 'awaiting_approval'`

### Ursache

Das normale Mitarbeiter-Anmeldeformular (`AuthService.signUp()`) hat **keine Metadaten** an Supabase gesendet, um zwischen Mitarbeiter- und Kunden-Registrierung zu unterscheiden.

Der Datenbank-Trigger hat dann standardmäßig "kunde" verwendet, was zu falschen Rollen geführt hat.

## Was wurde gefixt

### 1. AuthService.js (✅ bereits gefixt)

```javascript
// VORHER:
const { data, error } = await window.supabase.auth.signUp({
  email,
  password
});

// NACHHER:
const { data, error } = await window.supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      role: 'mitarbeiter',  // ✅ Klare Kennzeichnung
      subrole: 'pending',
      name: name
    }
  }
});
```

### 2. Datenbank-Trigger (📝 muss noch ausgeführt werden)

Der Trigger in der Datenbank wurde aktualisiert, um zwischen Mitarbeiter und Kunden zu unterscheiden:

```sql
-- Wenn role='mitarbeiter' → setze 'pending' + 'awaiting_approval'
-- Wenn role='kunde' → setze 'kunde' + 'can_view'
```

## Anleitung zur Behebung

### Schritt 1: SQL-Migration ausführen

Führe die SQL-Datei `fix_mitarbeiter_kunde_registrierung.sql` in deiner Supabase-Datenbank aus:

1. Öffne Supabase Dashboard
2. Gehe zu **SQL Editor**
3. Füge den Inhalt von `fix_mitarbeiter_kunde_registrierung.sql` ein
4. Führe das Script aus

Das Script macht folgendes:
- ✅ Aktualisiert den `handle_new_auth_user()` Trigger
- ✅ Korrigiert den Benutzer "sefa" auf `rolle: 'pending'`
- ✅ Zeigt alle Benutzer mit falscher Rolle an

### Schritt 2: Benutzer "sefa" freischalten

Nach der Migration:

1. Gehe zur **Mitarbeiter-Verwaltung** im CRM
2. Finde "sefa" in der Liste
3. Ändere die Rolle von `pending` zu `mitarbeiter`
4. Wähle die passende Unterrolle (z.B. `admin`, `manager`, etc.)
5. Setze `freigeschaltet` auf `true`

Alternativ per SQL:

```sql
UPDATE benutzer 
SET 
  rolle = 'mitarbeiter',
  unterrolle = 'admin',  -- oder andere passende Rolle
  freigeschaltet = true,
  updated_at = now()
WHERE name = 'sefa';
```

### Schritt 3: Testen

1. Registriere einen **Test-Mitarbeiter** über das normale Anmeldeformular
2. Prüfe in der Datenbank: `rolle` sollte `'pending'` sein
3. Registriere einen **Test-Kunden** über `/src/auth/kunden-register.html`
4. Prüfe in der Datenbank: `rolle` sollte `'kunde'` sein

## Unterschied zwischen den Registrierungsformularen

| Formular | Pfad | Rolle | Unterrolle | Verwendung |
|----------|------|-------|------------|------------|
| **Mitarbeiter** | `/` (Hauptseite) | `pending` | `awaiting_approval` | Für neue Mitarbeiter, die vom Admin freigeschaltet werden müssen |
| **Kunden** | `/src/auth/kunden-register.html` | `kunde` | `can_view` | Für externe Kunden/Unternehmen mit eingeschränktem Zugriff |

## Zusätzliche Prüfungen

### Alle nicht freigeschalteten Benutzer anzeigen:

```sql
SELECT name, rolle, unterrolle, freigeschaltet, created_at 
FROM benutzer 
WHERE freigeschaltet = false 
ORDER BY created_at DESC;
```

### Alle Benutzer mit ungültiger Rolle:

```sql
SELECT name, rolle, unterrolle, freigeschaltet 
FROM benutzer 
WHERE rolle NOT IN ('admin', 'mitarbeiter', 'kunde', 'pending')
ORDER BY created_at DESC;
```

## Zusammenfassung

✅ **Frontend-Fix**: `AuthService.js` sendet jetzt korrekte Metadaten  
📝 **Backend-Fix**: SQL-Migration muss ausgeführt werden  
🔧 **Manuelle Korrektur**: Benutzer "sefa" muss freigeschaltet werden

Nach diesen Schritten werden:
- Neue Mitarbeiter korrekt als `pending` registriert
- Neue Kunden korrekt als `kunde` registriert
- Keine Verwechslungen mehr auftreten
