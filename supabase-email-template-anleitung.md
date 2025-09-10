# Supabase E-Mail-Template Konfiguration

## 📧 E-Mail-Templates für Bestätigungslinks anpassen

### 1. Supabase Dashboard öffnen

1. Gehen Sie zu: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Wählen Sie Ihr Projekt aus
3. Navigieren Sie zu **Authentication** → **Email Templates**

### 2. "Confirm signup" Template bearbeiten

#### Aktueller Standard-Link:
```html
{{ .ConfirmationURL }}
```

#### Neuer angepasster Link:
```html
{{ .SiteURL }}/src/auth/confirm-email.html?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}
```

#### Vollständiges Template-Beispiel:

```html
<h2>Willkommen bei CRM Dashboard!</h2>

<p>Vielen Dank für Ihre Registrierung. Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.</p>

<p>
  <a href="{{ .SiteURL }}/src/auth/confirm-email.html?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}" 
     style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    E-Mail-Adresse bestätigen
  </a>
</p>

<p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
<p style="word-break: break-all; color: #6b7280; font-size: 12px;">
  {{ .SiteURL }}/src/auth/confirm-email.html?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}
</p>

<p><small>Dieser Link ist 24 Stunden gültig. Falls Sie sich nicht registriert haben, können Sie diese E-Mail ignorieren.</small></p>

<hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">

<p style="color: #6b7280; font-size: 12px;">
  Diese E-Mail wurde automatisch von CRM Dashboard gesendet.<br>
  Bei Fragen wenden Sie sich bitte an unseren Support.
</p>
```

### 3. "Magic Link" Template bearbeiten (falls verwendet)

```html
<h2>Ihr Magic Link für CRM Dashboard</h2>

<p>Klicken Sie auf den folgenden Link, um sich anzumelden:</p>

<p>
  <a href="{{ .SiteURL }}/src/auth/confirm-email.html?token_hash={{ .TokenHash }}&type=magiclink&redirect_to={{ .RedirectTo }}" 
     style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Anmelden
  </a>
</p>

<p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
<p style="word-break: break-all; color: #6b7280; font-size: 12px;">
  {{ .SiteURL }}/src/auth/confirm-email.html?token_hash={{ .TokenHash }}&type=magiclink&redirect_to={{ .RedirectTo }}
</p>

<p><small>Dieser Link ist 1 Stunde gültig und kann nur einmal verwendet werden.</small></p>
```

### 4. "Reset Password" Template bearbeiten (falls verwendet)

```html
<h2>Passwort zurücksetzen</h2>

<p>Sie haben eine Passwort-Zurücksetzung für Ihr CRM Dashboard-Konto angefordert.</p>

<p>
  <a href="{{ .SiteURL }}/src/auth/confirm-email.html?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}" 
     style="display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Passwort zurücksetzen
  </a>
</p>

<p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
<p style="word-break: break-all; color: #6b7280; font-size: 12px;">
  {{ .SiteURL }}/src/auth/confirm-email.html?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}
</p>

<p><small>Falls Sie keine Passwort-Zurücksetzung angefordert haben, können Sie diese E-Mail ignorieren.</small></p>
```

## 🔧 Template-Variablen Erklärung

| Variable | Beschreibung |
|----------|--------------|
| `{{ .SiteURL }}` | Ihre Haupt-Website-URL (konfiguriert in Auth Settings) |
| `{{ .TokenHash }}` | Gehashter Token für sichere Verifikation |
| `{{ .ConfirmationURL }}` | Standard Supabase Bestätigungs-URL |
| `{{ .RedirectTo }}` | URL zur Weiterleitung nach Bestätigung |
| `{{ .Email }}` | E-Mail-Adresse des Benutzers |
| `{{ .Token }}` | 6-stelliger OTP-Code (alternative zu TokenHash) |

## ⚙️ Site URL konfigurieren

1. Gehen Sie zu **Authentication** → **URL Configuration**
2. Setzen Sie die **Site URL** auf Ihre Domain:
   - Lokal: `http://localhost:3000` oder `http://127.0.0.1:5500`
   - Produktion: `https://ihre-domain.com`

3. Fügen Sie **Redirect URLs** hinzu:
   - `http://localhost:3000/src/auth/confirm-email.html`
   - `https://ihre-domain.com/src/auth/confirm-email.html`

## 🚀 JavaScript Integration

Stellen Sie sicher, dass in `confirm-email.html` die richtigen Supabase-Konfigurationen eingetragen sind:

```javascript
// Diese Werte in confirm-email.html ersetzen:
const SUPABASE_URL = 'https://ihr-project-ref.supabase.co'
const SUPABASE_ANON_KEY = 'ihre-anon-key'
```

## 🧪 Testen der Konfiguration

1. Registrieren Sie einen neuen Test-Benutzer
2. Prüfen Sie die empfangene E-Mail
3. Klicken Sie auf den Bestätigungslink
4. Verifizieren Sie, dass die `confirm-email.html` Seite korrekt lädt
5. Überprüfen Sie die Browser-Konsole auf Fehler

## 📱 Verschiedene Flows unterstützt

Die Bestätigungsseite unterstützt:
- **PKCE Flow** (Server-side): `token_hash` + `type`
- **Implicit Flow** (Client-side): `access_token` + `refresh_token`
- **Fehlerbehandlung**: Zeigt benutzerfreundliche Fehlermeldungen
- **Bereits bestätigt**: Erkennt bereits verifizierte Benutzer

## 🔒 Sicherheitshinweise

- Links sind zeitlich begrenzt (24h für Registrierung, 1h für Magic Links)
- `TokenHash` ist sicherer als `Token` für E-Mail-Links
- Verwenden Sie HTTPS in der Produktion
- Konfigurieren Sie korrekte Redirect-URLs in Supabase

## 🎨 Anpassungen

Die `confirm-email.html` kann vollständig angepasst werden:
- CSS-Styling ändern
- Branding hinzufügen
- Zusätzliche Validierungen implementieren
- Custom Redirect-Logik hinzufügen

---

**Wichtig:** Nach jeder Änderung der E-Mail-Templates testen Sie die vollständige Registrierungsflow, um sicherzustellen, dass alles korrekt funktioniert!

