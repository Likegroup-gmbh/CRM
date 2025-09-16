# 📋 Kunden-Portal – Aufgabenliste (aus PRD)

## ✅ Bereits erledigt
- [x] PRD erstellt: `tasks/prd-kunden-portal.md`

## 🚧 Noch zu erledigen

### 1. Datenbank & RLS
- [ ] Migrationen schreiben
  - [ ] `kunde_unternehmen` Tabelle anlegen (PK k: (kunde_id, unternehmen_id))
  - [ ] `kunde_marke` Tabelle anlegen (PK k: (kunde_id, marke_id))
  - [ ] Indizes auf FK-Spalten hinzufügen
  - [ ] `benutzer.unterrolle` sicherstellen
- [ ] RLS aktivieren und Policies
  - [ ] `unternehmen` Select-Policy für Kunden
  - [ ] `marke` Select-Policy (direkt + transitiv über unternehmen)
  - [ ] `kampagne` Select-Policy
  - [ ] `kooperation` Select-Policy
  - [ ] `kooperation_uploads` Select-Policy
- [ ] Tests für RLS (Admin vs Kunde vs Kunde ohne Zuordnung)

### 2. Backend/Edge & E-Mail
- [ ] Resend Setup
  - [ ] Resend Account/API Key besorgen und als Secret hinterlegen
  - [ ] E-Mail-Templates: Einladung, Upload-Benachrichtigung
- [ ] Edge Function `notify-customer-upload`
  - [ ] Insert-Trigger auf `kooperation_uploads`
  - [ ] Empfängerauflösung aus `kunde_unternehmen`/`kunde_marke`
  - [ ] Resend API Calls (Batch/Debounce 60s)
  - [ ] Dev-Logging, Error-Handling
- [ ] Einladungsversand Workflow (Admin-Aktion)

### 3. Frontend – Permissions & Routing
- [ ] `PermissionSystem` um Rollen `kunde`, `kunde_editor` erweitern
- [ ] Sichtbarkeits-Gates setzen (nur read auf relevante Module)
- [ ] Route `/kunden` registrieren (Landing mit Kampagnen-Liste)

### 4. Admin-Kundenverwaltung (analog Mitarbeiter)
- [ ] Route `/admin/kunden` registrieren
- [ ] `src/modules/admin/KundenList.js`
  - [ ] Tabelle: Name, E-Mail, Rolle/Unterrolle, Status, Unternehmen/Marken, erstellt_am
  - [ ] Suche/Filter, Pagination
  - [ ] ActionsDropdown: Einladen/Link, Aktivieren/Deaktivieren, Rolle ändern, Unternehmen/Marken zuordnen/entfernen
- [ ] `src/modules/admin/KundenDetail.js`
  - [ ] Stammdaten-Panel (Name, E-Mail, Rolle/Unterrolle, Status)
  - [ ] Zuordnungen-Unternehmen (Liste + hinzufügen/entfernen Modal)
  - [ ] Zuordnungen-Marken (Liste + hinzufügen/entfernen Modal)
  - [ ] Audit/Logs optional
- [ ] DataService Erweiterungen
  - [ ] Entity `kunden` (benutzer mit rolle in ('kunde','kunde_editor'))
  - [ ] Loader für `kunde_unternehmen`, `kunde_marke`

### 5. Kunden-UI
- [ ] Kampagnen-Liste gefiltert per RLS (read-only)
- [ ] Kooperationen-Liste pro Kampagne (read-only)
- [ ] Upload-Liste pro Kooperation mit Download-Link (signierte URL falls privat)
- [ ] Leichte Status-/Meta-Anzeigen (z. B. Upload-Datum, Uploader)

### 6. Onboarding
- [ ] Einladungslink/Magic Link/OTP Flow zu `/kunden`
- [ ] Wizard-Modal bei erstem Login (`first_login_done` Flag)
- [ ] Benachrichtigungs-Opt-in speichern

### 7. QA & E2E
- [ ] Test-Cases gemäß PRD Akzeptanzkriterien
- [ ] Admin-Sicht unverändert, Datenlecks ausgeschlossen
- [ ] Performance: Indizes validieren, Queries prüfen

## 🎯 Aktueller Status
- Fortschritt: 10%

## 🚀 Nächste Schritte
1. SQL-Migrationen implementieren
2. `PermissionSystem` Rollen ergänzen
3. Admin-Route `/admin/kunden` + `KundenList.js` Scaffold
