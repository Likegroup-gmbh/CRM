# 🔐 User-Berechtigungen Setup - Dokumentation

## ✅ **Was wurde implementiert:**

### 🎯 **Neue Benutzer-Registrierung ohne Rechte**

#### **1. Neue `pending` Rolle eingeführt:**
- **Rolle**: `pending`
- **Unterrolle**: `awaiting_approval`  
- **Zugriffsrechte**: `null` (explizit keine Rechte)
- **Zugriff**: Nur Dashboard sichtbar

#### **2. AuthService angepasst:**
```javascript
// Neue Benutzer werden als "pending" erstellt
rolle: 'pending',
unterrolle: 'awaiting_approval',
zugriffsrechte: null
```

#### **3. PermissionSystem erweitert:**
```javascript
// Pending-User: Warten auf Admin-Freischaltung
if (normalizedRole === 'pending') {
  return pendingPermissions; // Nur Dashboard
}
```

#### **4. Dashboard für Pending-User:**
- **Spezielle Nachricht** anstatt regulärer Inhalte
- **Wartestatus** deutlich angezeigt
- **Anweisungen** für nächste Schritte
- **Professionelles Design** mit Icon und Details

## 🔄 **Aktueller Flow:**

### **1. Benutzer-Registrierung:**
```
Registrierung → E-Mail-Bestätigung → OTP-Eingabe → Account erstellt
                                                      ↓
                                               Rolle: "pending"
                                                      ↓
                                              Nur Dashboard-Zugriff
```

### **2. Admin-Freischaltung (manuell):**
```
Admin öffnet Mitarbeiter-Liste → Sieht pending User → Ändert Rolle
                                                              ↓
                                                   "mitarbeiter" + Unterrolle
                                                              ↓
                                                      Volle Rechte entsprechend Rolle
```

## 🔑 **Rollen-System:**

### **Verfügbare Rollen:**
1. **`pending`** - Wartend auf Freischaltung (nur Dashboard)
2. **`mitarbeiter`** - Standard-Mitarbeiter mit Unterrollen:
   - `user` - Basis-Rechte
   - `can_view` - Nur Leserechte  
   - `can_edit` - Lese- und Bearbeitungsrechte
3. **`admin`** - Vollzugriff auf alles

### **Standard-Berechtigungen pro Rolle:**

#### **`pending`:**
```javascript
{
  creator: { can_view: false, can_edit: false, can_delete: false },
  unternehmen: { can_view: false, can_edit: false, can_delete: false },
  // ... alle Module: false
  dashboard: { can_view: true, can_edit: false, can_delete: false }
}
```

#### **`mitarbeiter` mit `can_view`:**
```javascript
{
  creator: { can_view: true, can_edit: false, can_delete: false },
  unternehmen: { can_view: true, can_edit: false, can_delete: false },
  // ... alle Module: nur lesen
  dashboard: { can_view: true, can_edit: false, can_delete: false }
}
```

#### **`mitarbeiter` mit `can_edit`:**
```javascript
{
  creator: { can_view: true, can_edit: true, can_delete: false },
  unternehmen: { can_view: true, can_edit: true, can_delete: false },
  // ... alle Module: lesen + bearbeiten
  dashboard: { can_view: true, can_edit: false, can_delete: false }
}
```

#### **`admin`:**
```javascript
{
  // Alle Module: can_view: true, can_edit: true, can_delete: true
}
```

## 🛠️ **Admin-Aufgaben:**

### **Neue Benutzer freischalten:**

#### **1. Pending-User finden:**
```sql
SELECT name, email, created_at, mitarbeiter_klasse_id 
FROM benutzer 
WHERE rolle = 'pending' 
ORDER BY created_at DESC;
```

#### **2. User freischalten:**
```sql
UPDATE benutzer 
SET rolle = 'mitarbeiter', 
    unterrolle = 'can_view'  -- oder 'can_edit' je nach Bedarf
WHERE auth_user_id = 'USER_ID';
```

#### **3. Spezielle Rechte vergeben (optional):**
```sql
-- Zusätzliche Page-/Table-spezifische Rechte
INSERT INTO user_permissions (user_id, page_id, can_view, can_edit)
VALUES ('USER_ID', 'kampagne', true, true);
```

## 🔒 **Sicherheitsfeatures:**

### **1. Standard-Sicherheit:**
- ✅ Neue User haben **keine Rechte** (außer Dashboard)
- ✅ Explizite Admin-Freischaltung erforderlich
- ✅ Granulare Rechtevergabe möglich
- ✅ Audit-Trail über `created_at`, `updated_at`

### **2. Navigationsbeschränkung:**
- ✅ Pending-User sehen nur Dashboard in Navigation
- ✅ Alle anderen Module werden ausgeblendet
- ✅ Direct-URL-Zugriff wird blockiert

### **3. Dashboard-Schutz:**
- ✅ Pending-User sehen keine sensiblen Daten
- ✅ Spezielle Nachricht statt echter Inhalte
- ✅ Benutzer-Information beschränkt

## 📋 **Nächste Schritte:**

### **Für Admins:**
1. **Mitarbeiter-Liste** prüfen auf pending Users
2. **Rollen zuweisen** je nach Position/Aufgabe
3. **Spezielle Rechte** konfigurieren falls nötig

### **Für Entwicklung:**
1. **Admin-UI** für einfache User-Freischaltung erstellen
2. **E-Mail-Benachrichtigungen** bei Freischaltung
3. **Audit-Log** für Rechte-Änderungen
4. **Bulk-Aktionen** für mehrere User

## 🎯 **Vorteile:**

✅ **Sicherheit**: Keine automatischen Rechte für neue User  
✅ **Kontrolle**: Admin entscheidet über jeden Zugriff  
✅ **Flexibilität**: Granulare Rechtevergabe möglich  
✅ **Audit**: Nachvollziehbare Rechte-Vergabe  
✅ **UX**: Klare Kommunikation an wartende User  

**Das System ist jetzt produktionsbereit für sicheres User-Management! 🔐**
