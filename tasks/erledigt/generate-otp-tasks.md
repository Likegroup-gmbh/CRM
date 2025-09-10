# 📋 OTP E-Mail-Verifikation - Aufgaben

## ✅ Bereits erledigt

### 1. Seite erstellt ✓
- [x] `/src/auth/verify-email.html` - OTP-Eingabe-Seite mit 6-stelligem Code
- [x] Vollständige JavaScript-Logik für OTP-Handling
- [x] Timer-Funktionalität (10 Minuten Countdown)
- [x] "Code erneut senden" Funktionalität
- [x] Mobile-responsive Design

### 2. Features implementiert ✓
- [x] 6 separate Eingabefelder für Ziffern
- [x] Automatischer Fokus-Wechsel zwischen Feldern
- [x] Paste-Funktionalität für kompletten Code
- [x] Rate-Limiting (3x Code senden, 5x Versuche)
- [x] Fehlerbehandlung und Benutzer-Feedback
- [x] Deutsche Lokalisierung

### 3. Supabase Integration ✓
- [x] `verifyOtp()` API-Integration
- [x] `resend()` API für neue Codes
- [x] Session-Management nach erfolgreicher Verifikation
- [x] Weiterleitung zum Login nach Bestätigung

## 🚧 Noch zu erledigen

### 4. Styling-Probleme beheben
- [ ] **OTP-Seite auf minimalistisches App-Layout umstellen**
  - [ ] Aktuell: Gradient-Background und eigenes Styling
  - [ ] Gewünscht: Identisches Layout wie restliche App
  - [ ] Dashboard.css Variablen verwenden
  - [ ] Sidebar und Header-Layout integrieren

- [ ] **Countdown-Timer reparieren**
  - [ ] Timer läuft aktuell nicht ab
  - [ ] JavaScript-Fehler in Timer-Funktion beheben
  - [ ] Korrekte Anzeige der verbleibenden Zeit

### 5. E-Mail-Template konfigurieren
- [ ] **Supabase E-Mail-Template auf OTP umstellen**
  - [ ] Aktuell: Nur Link in E-Mail ("E-Mail bestätigen")
  - [ ] Gewünscht: 6-stelliger Code mit `{{ .Token }}`
  - [ ] Template-Text auf Deutsch anpassen
  - [ ] Sicherheitshinweise hinzufügen

### 6. URL-Konfiguration
- [ ] **Registrierungsflow anpassen**
  - [ ] Nach Registrierung zu `/src/auth/verify-email.html?email=...` weiterleiten
  - [ ] Benutzer NICHT automatisch einloggen
  - [ ] E-Mail-Parameter korrekt übergeben

### 7. Testing & Verifikation
- [ ] **End-to-End Test durchführen**
  - [ ] Registrierung → OTP-E-Mail → Code-Eingabe → Login
  - [ ] Timer-Funktionalität testen
  - [ ] "Code erneut senden" testen
  - [ ] Mobile Responsiveness prüfen

## 🎯 Aktueller Status

**Fortschritt: 70% ✅**

### Was funktioniert bereits:
- ✅ Vollständige OTP-Eingabe-Seite mit 6-stelligem Code
- ✅ Automatisches Fokus-Management und Paste-Support
- ✅ Supabase Auth Integration (verifyOtp, resend)
- ✅ Rate-Limiting und Fehlerbehandlung
- ✅ Deutsche Benutzeroberfläche
- ✅ Mobile-responsive Grundlayout

### Was noch nicht funktioniert:
- ❌ **Styling**: Seite passt nicht zum App-Design
- ❌ **Timer**: Countdown läuft nicht korrekt ab
- ❌ **E-Mail**: Enthält Link statt OTP-Code
- ❌ **Integration**: Registrierung leitet nicht zur OTP-Seite

## 🚀 Nächste Schritte

### Priorität 1: Styling-Fix
1. **OTP-Seite umgestalten**:
   - Dashboard.css Variablen verwenden
   - Sidebar/Header-Layout integrieren
   - Minimalistisches Design wie andere Seiten

### Priorität 2: Timer reparieren
2. **JavaScript-Debugging**:
   - Timer-Funktion analysieren
   - Countdown-Logik korrigieren
   - Ablauf-Handling testen

### Priorität 3: E-Mail-Template
3. **Supabase Dashboard konfigurieren**:
   - "Confirm signup" Template bearbeiten
   - `{{ .Token }}` statt Link verwenden
   - Deutsche Texte und Sicherheitshinweise

### Priorität 4: Integration
4. **Registrierungsflow verbinden**:
   - AuthService.js anpassen
   - Weiterleitung zur OTP-Seite implementieren
   - URL-Parameter korrekt setzen

## 💡 Technische Details

### Aktueller Code-Stand:
- **Datei**: `/src/auth/verify-email.html`
- **Funktionen**: OTP-Eingabe, Timer, Resend, Validation
- **API-Integration**: Supabase verifyOtp() und resend()
- **Styling**: Eigenes CSS (nicht App-konform)

### Benötigte Änderungen:
- **CSS**: Dashboard.css Variablen und Layout-System
- **JavaScript**: Timer-Bug-Fix
- **Supabase**: E-Mail-Template auf OTP umstellen
- **Integration**: Registrierung → OTP-Seite Verbindung

**Nach Abschluss aller Tasks ist das OTP-System vollständig funktionsfähig! 🎉**
