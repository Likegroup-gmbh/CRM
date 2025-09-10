# 🔧 Supabase OTP E-Mail-Template Konfiguration

## 📧 E-Mail-Template auf OTP-Code umstellen

### 1. Supabase Dashboard öffnen
1. Gehen Sie zu: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Wählen Sie Ihr Projekt aus
3. Navigieren Sie zu **Authentication** → **Email Templates**

### 2. "Confirm signup" Template bearbeiten

#### ❌ Aktueller Standard (Link-basiert):
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

#### ✅ Neues OTP-Template (Code-basiert):

**Betreff:** `E-Mail-Adresse bestätigen - CRM Dashboard`

**HTML-Inhalt:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: white; border-radius: 8px; padding: 40px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 16px; font-weight: 700;">
      E-Mail bestätigen
    </h1>
    
    <p style="color: #6b7280; font-size: 16px; margin-bottom: 8px;">
      Wir haben einen 6-stelligen Code gesendet an:
    </p>
    
    <p style="color: #4f46e5; font-size: 16px; font-weight: 600; margin-bottom: 32px;">
      {{ .Email }}
    </p>
    
    <!-- OTP Code Box -->
    <div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <p style="color: #374151; font-size: 14px; margin: 0 0 8px 0;">
        Ihr Bestätigungscode:
      </p>
      <div style="font-size: 32px; font-weight: 700; color: #1f2937; letter-spacing: 4px; margin: 8px 0;">
        {{ .Token }}
      </div>
      <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">
        Dieser Code ist 10 Minuten gültig
      </p>
    </div>
    
    <!-- Instructions -->
    <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 24px 0;">
      Geben Sie diesen Code auf der Bestätigungsseite ein, um Ihre E-Mail-Adresse zu verifizieren.
    </p>
    
    <!-- Security Notice -->
    <div style="background: #fef7f0; border: 1px solid #fed7aa; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: left;">
      <h3 style="color: #ea580c; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
        🔒 Sicherheitshinweise:
      </h3>
      <ul style="color: #9a3412; font-size: 12px; margin: 0; padding-left: 16px;">
        <li>Teilen Sie diesen Code mit niemandem</li>
        <li>Unser Support wird Sie niemals nach diesem Code fragen</li>
        <li>Falls Sie sich nicht registriert haben, ignorieren Sie diese E-Mail</li>
      </ul>
    </div>
    
    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
    
    <p style="color: #6b7280; font-size: 12px; line-height: 1.5;">
      Diese E-Mail wurde automatisch von CRM Dashboard gesendet.<br>
      Bei Fragen wenden Sie sich bitte an unseren Support.
    </p>
    
    <p style="color: #9ca3af; font-size: 11px; margin-top: 16px;">
      CRM Dashboard Team
    </p>
    
  </div>
</div>
```

### 3. Magic Link Template (falls verwendet)

Falls Sie auch Magic Links verwenden, passen Sie das Template entsprechend an:

**Betreff:** `Ihr Anmelde-Code - CRM Dashboard`

**HTML-Inhalt:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: white; border-radius: 8px; padding: 40px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 16px; font-weight: 700;">
      Anmelde-Code
    </h1>
    
    <p style="color: #6b7280; font-size: 16px; margin-bottom: 32px;">
      Ihr Anmelde-Code für CRM Dashboard:
    </p>
    
    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <div style="font-size: 32px; font-weight: 700; color: #065f46; letter-spacing: 4px;">
        {{ .Token }}
      </div>
      <p style="color: #047857; font-size: 12px; margin: 8px 0 0 0;">
        Dieser Code ist 1 Stunde gültig
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 12px;">
      Falls Sie sich nicht anmelden wollten, können Sie diese E-Mail ignorieren.
    </p>
    
  </div>
</div>
```

## 🔧 Template-Variablen Erklärung

Die wichtigsten Variablen für OTP-Templates:

| Variable | Beschreibung | Verwendung |
|----------|--------------|------------|
| `{{ .Token }}` | **6-stelliger OTP-Code** | Hauptcode für Verifikation |
| `{{ .Email }}` | E-Mail-Adresse des Benutzers | Personalisierung |
| `{{ .SiteURL }}` | Ihre Haupt-Website-URL | Links und Branding |
| `{{ .TokenHash }}` | Gehashter Token | Für custom Links (nicht bei OTP) |

## ⚙️ Wichtige Einstellungen

### OTP-Gültigkeit konfigurieren
1. Gehen Sie zu **Authentication** → **Settings**
2. Unter **Email Auth**:
   - **Email confirmation token validity**: `600` (10 Minuten)
   - **Email confirmation rate limit**: `3` (max. 3 E-Mails pro Stunde)

### Site URL konfigurieren
1. **Authentication** → **URL Configuration**
2. **Site URL**: `https://thriving-stardust-370718.netlify.app`
3. **Redirect URLs** hinzufügen:
   ```
   https://thriving-stardust-370718.netlify.app/src/auth/verify-email.html
   http://localhost:3000/src/auth/verify-email.html
   ```

## 🧪 Template testen

### 1. Test-Registrierung
1. Registrieren Sie einen neuen Test-Benutzer
2. Prüfen Sie die empfangene E-Mail
3. Verifizieren Sie, dass ein **6-stelliger Code** angezeigt wird
4. **NICHT** ein "E-Mail bestätigen" Link

### 2. Code-Verifikation
1. Öffnen Sie `/src/auth/verify-email.html?email=test@example.com`
2. Geben Sie den 6-stelligen Code ein
3. Prüfen Sie, dass die Verifikation funktioniert
4. Überprüfen Sie Browser-Konsole auf Fehler

## 📱 Verschiedene E-Mail-Clients

Das Template ist optimiert für:
- **Gmail** (Desktop & Mobile)
- **Outlook** (365 & Desktop)
- **Apple Mail** (iOS & macOS)
- **Mobile E-Mail-Apps** (responsive Design)

## 🔒 Sicherheitsfeatures

- **Rate-Limiting**: Maximal 3 Codes pro 10 Minuten
- **Zeitbegrenzung**: Codes sind 10 Minuten gültig
- **Einmalverwendung**: Jeder Code kann nur einmal verwendet werden
- **Sichere Generierung**: Kryptographisch sichere Zufallscodes

## ✅ Checkliste nach Konfiguration

- [ ] **Template gespeichert** in Supabase Dashboard
- [ ] **OTP-Variable** `{{ .Token }}` verwendet (nicht `{{ .ConfirmationURL }}`)
- [ ] **Deutsche Texte** konfiguriert
- [ ] **Sicherheitshinweise** hinzugefügt
- [ ] **Site URL** korrekt gesetzt
- [ ] **Test-E-Mail** versendet und empfangen
- [ ] **6-stelliger Code** wird angezeigt
- [ ] **OTP-Seite** funktioniert mit Code

## 🚨 Häufige Probleme

### Problem: Immer noch Link statt Code
**Lösung**: Template komplett ersetzen, nicht nur ergänzen

### Problem: Code wird nicht angezeigt
**Lösung**: `{{ .Token }}` Variable prüfen (case-sensitive)

### Problem: E-Mail kommt nicht an
**Lösung**: Site URL und Redirect URLs prüfen

**Nach erfolgreicher Konfiguration funktioniert der komplette OTP-Flow! 🎉**
