# 🔧 Supabase OTP-Konfiguration

## 📧 E-Mail-Template für OTP-Code einrichten

### 1. Supabase Dashboard öffnen

1. Gehen Sie zu: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Wählen Sie Ihr Projekt aus
3. Navigieren Sie zu **Authentication** → **Email Templates**

### 2. "Confirm signup" Template bearbeiten

#### Neues OTP-basiertes Template:

**Betreff:** `Bestätigen Sie Ihre E-Mail-Adresse - CRM Dashboard`

**HTML-Inhalt:**
```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Mail bestätigen</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            text-align: center; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 2rem; 
            border-radius: 8px 8px 0 0; 
        }
        .content { 
            background: #f9fafb; 
            padding: 2rem; 
            border-radius: 0 0 8px 8px; 
        }
        .otp-container { 
            text-align: center; 
            margin: 2rem 0; 
            padding: 1.5rem; 
            background: white; 
            border-radius: 8px; 
            border: 2px solid #4f46e5; 
        }
        .otp-code { 
            font-size: 2rem; 
            font-weight: bold; 
            letter-spacing: 0.5rem; 
            color: #4f46e5; 
            font-family: 'Courier New', monospace; 
            margin: 1rem 0; 
        }
        .warning { 
            background: #fef3cd; 
            border: 1px solid #fde047; 
            padding: 1rem; 
            border-radius: 6px; 
            margin: 1rem 0; 
        }
        .footer { 
            text-align: center; 
            color: #6b7280; 
            font-size: 0.875rem; 
            margin-top: 2rem; 
            padding-top: 2rem; 
            border-top: 1px solid #e5e7eb; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Willkommen bei CRM Dashboard!</h1>
        <p>Bestätigen Sie Ihre E-Mail-Adresse</p>
    </div>
    
    <div class="content">
        <p>Hallo,</p>
        
        <p>vielen Dank für Ihre Registrierung bei CRM Dashboard. Um Ihr Konto zu aktivieren, geben Sie bitte den folgenden 6-stelligen Code auf der Bestätigungsseite ein:</p>
        
        <div class="otp-container">
            <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">Ihr Bestätigungscode:</p>
            <div class="otp-code">{{ .Token }}</div>
            <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">Gültig für 10 Minuten</p>
        </div>
        
        <div class="warning">
            <h3 style="margin-top: 0; color: #92400e;">⚠️ Wichtige Sicherheitshinweise:</h3>
            <ul style="margin-bottom: 0; color: #92400e;">
                <li>Teilen Sie diesen Code mit niemandem</li>
                <li>Unser Support wird Sie niemals nach diesem Code fragen</li>
                <li>Der Code ist nur 10 Minuten gültig</li>
                <li>Falls Sie sich nicht registriert haben, ignorieren Sie diese E-Mail</li>
            </ul>
        </div>
        
        <p>Sollten Sie Probleme haben, können Sie einen neuen Code auf der Bestätigungsseite anfordern oder sich an unseren Support wenden.</p>
        
        <p>Mit freundlichen Grüßen<br>
        <strong>Ihr CRM Dashboard Team</strong></p>
    </div>
    
    <div class="footer">
        <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.</p>
        <p>Bei Fragen wenden Sie sich an: <a href="mailto:support@crm-dashboard.com">support@crm-dashboard.com</a></p>
    </div>
</body>
</html>
```

### 3. Auth-Einstellungen konfigurieren

#### A. E-Mail-Bestätigung aktivieren
1. Gehen Sie zu **Authentication** → **Settings**
2. Unter **User Signups**: Aktivieren Sie **"Enable email confirmations"**
3. **Speichern** Sie die Einstellungen

#### B. Site URL konfigurieren
1. Gehen Sie zu **Authentication** → **URL Configuration**
2. **Site URL** setzen:
   - Lokal: `http://localhost:3000`
   - Produktion: `https://ihre-domain.com`

#### C. Redirect URLs hinzufügen
Fügen Sie folgende URLs zur Redirect-Liste hinzu:
- `http://localhost:3000/src/auth/verify-email.html`
- `https://ihre-domain.com/src/auth/verify-email.html`
- `http://localhost:3000/login`
- `https://ihre-domain.com/login`

### 4. OTP-spezifische Einstellungen

#### A. Token-Gültigkeit (Optional)
1. Gehen Sie zu **Authentication** → **Settings**
2. Unter **Email Auth**: 
   - **Email confirmation token validity**: `600` (10 Minuten)
   - **Email confirmation rate limit**: `3` (max. 3 E-Mails pro Stunde)

#### B. Rate-Limiting konfigurieren
```sql
-- Optional: Custom Rate Limiting in Database
-- Führen Sie diese SQL-Befehle in der SQL-Konsole aus:

-- Rate Limiting für OTP-Versuche
CREATE OR REPLACE FUNCTION auth.check_otp_rate_limit(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    attempt_count integer;
BEGIN
    -- Zähle Versuche in den letzten 10 Minuten
    SELECT COUNT(*) INTO attempt_count
    FROM auth.audit_log_entries
    WHERE payload->>'email' = user_email
    AND payload->>'action' = 'token_verification_attempt'
    AND created_at > NOW() - INTERVAL '10 minutes';
    
    -- Maximal 5 Versuche pro 10 Minuten
    RETURN attempt_count < 5;
END;
$$;
```

### 5. Testen der Konfiguration

#### Testschritte:
1. **Registrierung testen**:
   ```javascript
   // In Browser-Konsole oder Test-Skript
   const { data, error } = await supabase.auth.signUp({
     email: 'test@example.com',
     password: 'testpassword123'
   })
   console.log('Signup result:', { data, error })
   ```

2. **E-Mail prüfen**:
   - E-Mail sollte mit 6-stelligem Code ankommen
   - Code sollte in `{{ .Token }}` Variable stehen
   - E-Mail sollte professionell aussehen

3. **OTP-Verifikation testen**:
   ```javascript
   // Code aus E-Mail verwenden
   const { data, error } = await supabase.auth.verifyOtp({
     email: 'test@example.com',
     token: '123456', // Code aus E-Mail
     type: 'email'
   })
   console.log('Verify result:', { data, error })
   ```

### 6. Troubleshooting

#### Häufige Probleme:

**Problem: E-Mail kommt nicht an**
- Lösung: Prüfen Sie Spam-Ordner, SMTP-Einstellungen
- Check: Supabase Dashboard → Settings → SMTP

**Problem: "Invalid OTP" Fehler**
- Lösung: Prüfen Sie Token-Format und Gültigkeit
- Check: Ist `{{ .Token }}` korrekt im Template?

**Problem: Rate-Limiting-Fehler**
- Lösung: Warten Sie oder erhöhen Sie Limits
- Check: Authentication → Settings → Rate Limits

**Problem: Template wird nicht angezeigt**
- Lösung: Cache leeren, Template erneut speichern
- Check: Browser-Cache und Supabase-Template-Cache

#### Debug-Befehle:
```sql
-- Prüfe aktuelle Auth-Einstellungen
SELECT * FROM auth.config;

-- Prüfe letzte OTP-Versuche
SELECT * FROM auth.audit_log_entries 
WHERE payload->>'action' LIKE '%otp%' 
ORDER BY created_at DESC 
LIMIT 10;

-- Prüfe Benutzer-Status
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'test@example.com';
```

### 7. Produktions-Deployment

#### Checkliste:
- [ ] SMTP-Server konfiguriert (nicht Supabase Standard-SMTP)
- [ ] SPF/DKIM Records gesetzt
- [ ] Site URL auf Produktions-Domain gesetzt
- [ ] Redirect URLs für Produktion hinzugefügt
- [ ] Rate-Limiting angemessen konfiguriert
- [ ] E-Mail-Template getestet
- [ ] Monitoring für E-Mail-Zustellbarkeit eingerichtet

#### Custom SMTP (Empfohlen für Produktion):
1. **Authentication** → **Settings** → **SMTP Settings**
2. Konfigurieren Sie Ihren eigenen SMTP-Provider:
   - **Host**: z.B. `smtp.gmail.com`
   - **Port**: `587`
   - **Username**: Ihre E-Mail
   - **Password**: App-Passwort
   - **Sender name**: "CRM Dashboard"
   - **Sender email**: "noreply@ihre-domain.com"

### 8. Monitoring & Analytics

#### Wichtige Metriken:
- **E-Mail-Zustellrate**: > 95%
- **OTP-Erfolgsrate**: > 90%
- **Durchschnittliche Verifikationszeit**: < 3 Minuten
- **Abbruchrate**: < 10%

#### Monitoring-Setup:
```sql
-- Custom Monitoring View
CREATE OR REPLACE VIEW auth_otp_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE payload->>'error' IS NULL) as successful,
    COUNT(*) FILTER (WHERE payload->>'error' IS NOT NULL) as failed,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM auth.audit_log_entries 
WHERE payload->>'action' = 'token_verification_attempt'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

**Nach dieser Konfiguration ist Ihr OTP-System produktionsbereit!** 🚀

**Wichtige Hinweise:**
- Testen Sie alle Schritte in einer Entwicklungsumgebung
- Dokumentieren Sie Ihre spezifischen Einstellungen
- Überwachen Sie die E-Mail-Zustellbarkeit nach dem Go-Live
- Stellen Sie sicher, dass Ihr Support-Team über den neuen Flow informiert ist

