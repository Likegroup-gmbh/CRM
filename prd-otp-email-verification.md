# Product Requirements Document (PRD)

## OTP-basierte E-Mail-Verifikation

### Projekt-Kontext
CRM Dashboard - Benutzerregistrierung und E-Mail-Verifikation

### Problem Statement
Aktuell werden Benutzer nach der Registrierung teilweise eingeloggt und müssen einen Link in der E-Mail klicken. Dies führt zu inkonsistenten Zuständen und schlechter UX. Benutzer sollen stattdessen einen 6-stelligen Code eingeben, um ihre E-Mail zu bestätigen.

### Ziele
- **Hauptziel**: Implementierung einer OTP-basierten E-Mail-Verifikation
- **UX-Verbesserung**: Klarer Registrierungsflow ohne Zwischenzustände
- **Sicherheit**: Sichere E-Mail-Verifikation über zeitlich begrenzte Codes
- **Konsistenz**: Einheitlicher Auth-Flow ohne Seitenreloads

### Zielgruppe
- Neue Benutzer bei der Registrierung
- Administratoren, die Benutzer einladen
- Support-Team für Troubleshooting

### Funktionale Anforderungen

#### 1. Registrierungsflow
- **RF-001**: Nach Registrierung wird Benutzer NICHT eingeloggt
- **RF-002**: Weiterleitung zu OTP-Eingabe-Seite nach erfolgreicher Registrierung
- **RF-003**: Anzeige der E-Mail-Adresse für die der Code gesendet wurde
- **RF-004**: Möglichkeit, Code erneut zu senden (max. 3x pro 10 Minuten)

#### 2. OTP-Generierung und -Versendung
- **RF-005**: 6-stelliger numerischer Code wird generiert
- **RF-006**: Code ist 10 Minuten gültig
- **RF-007**: Nur ein aktiver Code pro E-Mail-Adresse
- **RF-008**: Code wird in E-Mail-Template eingefügt ({{ .Token }})
- **RF-009**: E-Mail enthält Code und Gültigkeitsdauer

#### 3. OTP-Eingabe-Interface
- **RF-010**: Dedizierte Seite für OTP-Eingabe (/auth/verify-email)
- **RF-011**: 6 separate Eingabefelder für Ziffern
- **RF-012**: Automatischer Fokus-Wechsel zwischen Feldern
- **RF-013**: Paste-Funktionalität für kompletten Code
- **RF-014**: Countdown-Timer für Gültigkeitsdauer
- **RF-015**: "Code erneut senden" Button

#### 4. OTP-Verifikation
- **RF-016**: Verifikation über Supabase Auth API
- **RF-017**: Bei erfolgreicher Verifikation: E-Mail als bestätigt markieren
- **RF-018**: Weiterleitung zum Login nach erfolgreicher Verifikation
- **RF-019**: Fehlermeldungen bei ungültigem/abgelaufenem Code
- **RF-020**: Rate-Limiting: Max. 5 Versuche pro 10 Minuten

#### 5. E-Mail-Template
- **RF-021**: Neues E-Mail-Template mit OTP-Code
- **RF-022**: Deutsche Lokalisierung
- **RF-023**: Klare Anweisungen zur Code-Eingabe
- **RF-024**: Sicherheitshinweise (Code nicht teilen)
- **RF-025**: Fallback-Kontaktmöglichkeit bei Problemen

### Nicht-funktionale Anforderungen

#### Performance
- **NF-001**: OTP-Generierung < 500ms
- **NF-002**: E-Mail-Versendung < 2 Sekunden
- **NF-003**: Code-Verifikation < 300ms

#### Sicherheit
- **NF-004**: Codes sind kryptografisch sicher generiert
- **NF-005**: Rate-Limiting gegen Brute-Force-Angriffe
- **NF-006**: Codes werden nach Verwendung invalidiert
- **NF-007**: Keine Code-Speicherung im Frontend

#### Usability
- **NF-008**: Mobile-responsive Design
- **NF-009**: Barrierefreie Eingabefelder
- **NF-010**: Klare Fehlermeldungen
- **NF-011**: Intuitive Navigation

### User Stories

#### Story 1: Neue Benutzerregistrierung
**Als** neuer Benutzer  
**möchte ich** mich mit E-Mail und Passwort registrieren  
**damit** ich Zugang zum CRM-System erhalte

**Akzeptanzkriterien:**
- Registrierungsformular mit E-Mail, Passwort, Passwort-Bestätigung
- Nach Submit: Weiterleitung zu OTP-Eingabe-Seite
- Bestätigungs-E-Mail mit 6-stelligem Code wird versendet
- Benutzer ist NICHT eingeloggt nach Registrierung

#### Story 2: OTP-Code eingeben
**Als** registrierter Benutzer  
**möchte ich** den erhaltenen 6-stelligen Code eingeben  
**damit** meine E-Mail-Adresse bestätigt wird

**Akzeptanzkriterien:**
- 6 separate Eingabefelder für Ziffern
- Automatischer Fokus-Wechsel
- Countdown-Timer zeigt verbleibende Zeit
- Bei korrektem Code: Weiterleitung zum Login
- Bei falschem Code: Fehlermeldung und erneute Eingabe möglich

#### Story 3: Code erneut anfordern
**Als** Benutzer  
**möchte ich** einen neuen Code anfordern können  
**falls** ich die E-Mail nicht erhalten habe oder der Code abgelaufen ist

**Akzeptanzkriterien:**
- "Code erneut senden" Button verfügbar
- Rate-Limiting: Max. 3x pro 10 Minuten
- Neue E-Mail mit neuem Code wird versendet
- Alter Code wird invalidiert

### Technische Spezifikation

#### Frontend-Komponenten
1. **OTP-Eingabe-Seite** (`/src/auth/verify-email.html`)
   - 6 Eingabefelder für Ziffern
   - Timer-Anzeige
   - "Erneut senden" Button
   - Responsive Design

2. **JavaScript-Logik** (`/src/auth/verify-email.js`)
   - OTP-Eingabe-Handling
   - Supabase Auth Integration
   - Timer-Management
   - Fehlerbehandlung

#### Backend-Integration
1. **Supabase Auth Configuration**
   - E-Mail-Template mit `{{ .Token }}` Variable
   - OTP-Verifikation über `verifyOtp()` API
   - Rate-Limiting-Konfiguration

2. **E-Mail-Template Updates**
   - "Confirm signup" Template mit OTP-Code
   - Deutsche Lokalisierung
   - Sicherheitshinweise

#### Datenfluss
```
1. Benutzer registriert sich
2. Supabase generiert 6-stelligen OTP
3. E-Mail mit OTP wird versendet
4. Benutzer wird zu /auth/verify-email weitergeleitet
5. Benutzer gibt OTP ein
6. Frontend ruft verifyOtp() API auf
7. Bei Erfolg: Weiterleitung zu /login
8. Bei Fehler: Fehlermeldung anzeigen
```

### Wireframes/Mockups

#### OTP-Eingabe-Seite Layout
```
┌─────────────────────────────────────┐
│              LOGO/TITEL             │
├─────────────────────────────────────┤
│                                     │
│    E-Mail-Bestätigung erforderlich  │
│                                     │
│  Wir haben einen 6-stelligen Code   │
│  an ihre-email@domain.com gesendet  │
│                                     │
│  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐          │
│  │ │ │ │ │ │ │ │ │ │ │ │          │
│  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘          │
│                                     │
│     Code läuft ab in: 09:45         │
│                                     │
│  [    Code bestätigen    ]          │
│                                     │
│  Code nicht erhalten?               │
│  [Code erneut senden]               │
│                                     │
└─────────────────────────────────────┘
```

### E-Mail-Template Design
```
Betreff: Bestätigen Sie Ihre E-Mail-Adresse - CRM Dashboard

Hallo,

vielen Dank für Ihre Registrierung bei CRM Dashboard.

Ihr Bestätigungscode lautet:

    [  1  2  3  4  5  6  ]

Dieser Code ist 10 Minuten gültig.

Geben Sie den Code auf der Bestätigungsseite ein, um Ihre 
E-Mail-Adresse zu verifizieren.

Wichtige Sicherheitshinweise:
• Teilen Sie diesen Code mit niemandem
• Unser Support wird Sie niemals nach diesem Code fragen
• Falls Sie sich nicht registriert haben, ignorieren Sie diese E-Mail

Bei Fragen wenden Sie sich an: support@crm-dashboard.com

Mit freundlichen Grüßen
Ihr CRM Dashboard Team
```

### Implementierungsplan

#### Phase 1: Backend-Konfiguration (Tag 1)
- [ ] Supabase E-Mail-Template für OTP konfigurieren
- [ ] Auth-Einstellungen für OTP-Flow anpassen
- [ ] Rate-Limiting konfigurieren

#### Phase 2: Frontend-Entwicklung (Tag 2-3)
- [ ] OTP-Eingabe-Seite erstellen
- [ ] JavaScript für OTP-Handling implementieren
- [ ] Styling und Responsive Design
- [ ] Integration mit Supabase Auth API

#### Phase 3: Integration & Testing (Tag 4)
- [ ] Registrierungsflow anpassen
- [ ] End-to-End Testing
- [ ] Error-Handling verfeinern
- [ ] Mobile Testing

#### Phase 4: Deployment & Monitoring (Tag 5)
- [ ] Production Deployment
- [ ] Monitoring Setup
- [ ] User Feedback sammeln
- [ ] Performance Optimierung

### Akzeptanzkriterien

#### Muss-Kriterien
- ✅ Benutzer wird nach Registrierung NICHT automatisch eingeloggt
- ✅ OTP-Code wird per E-Mail versendet
- ✅ 6-stellige Code-Eingabe funktioniert
- ✅ Erfolgreiche Verifikation führt zu Login-Weiterleitung
- ✅ Rate-Limiting verhindert Missbrauch

#### Soll-Kriterien
- ✅ Mobile-responsive Design
- ✅ Countdown-Timer für Code-Gültigkeit
- ✅ "Code erneut senden" Funktionalität
- ✅ Deutsche Lokalisierung

#### Kann-Kriterien
- 🔄 Biometrische Verifikation (zukünftig)
- 🔄 SMS-OTP als Alternative (zukünftig)
- 🔄 QR-Code für mobile Apps (zukünftig)

### Risiken & Mitigation

#### Risiko 1: E-Mail-Zustellbarkeit
**Beschreibung:** OTP-E-Mails landen im Spam  
**Wahrscheinlichkeit:** Mittel  
**Auswirkung:** Hoch  
**Mitigation:** SMTP-Konfiguration optimieren, SPF/DKIM Setup

#### Risiko 2: Benutzer vergessen E-Mail-Adresse
**Beschreibung:** Benutzer wissen nicht, an welche E-Mail der Code ging  
**Wahrscheinlichkeit:** Niedrig  
**Auswirkung:** Mittel  
**Mitigation:** E-Mail-Adresse auf Verifikationsseite anzeigen

#### Risiko 3: Code-Brute-Force
**Beschreibung:** Angreifer versuchen Codes zu erraten  
**Wahrscheinlichkeit:** Mittel  
**Auswirkung:** Hoch  
**Mitigation:** Strenge Rate-Limiting, Account-Sperrung

### Metriken & KPIs

#### Erfolgsmetriken
- **Verifikationsrate:** > 85% der gesendeten Codes werden erfolgreich eingegeben
- **Abbruchrate:** < 15% der Benutzer brechen bei OTP-Eingabe ab
- **E-Mail-Zustellrate:** > 95% der OTP-E-Mails werden zugestellt
- **Durchschnittliche Verifikationszeit:** < 3 Minuten

#### Qualitätsmetriken
- **Fehlerrate:** < 2% API-Fehler bei OTP-Verifikation
- **Performance:** OTP-Generierung < 500ms
- **Support-Tickets:** < 5% Anstieg bei auth-bezogenen Tickets

### Abhängigkeiten
- Supabase Auth API für OTP-Generierung
- SMTP-Service für E-Mail-Versendung
- Frontend-Framework für UI-Komponenten
- CSS-Framework für Styling

### Dokumentation
- Setup-Anleitung für Entwickler
- Benutzerhandbuch für End-User
- Troubleshooting-Guide
- API-Dokumentation für OTP-Endpoints

---

**Erstellt:** $(date)  
**Version:** 1.0  
**Status:** Draft  
**Reviewer:** TBD

