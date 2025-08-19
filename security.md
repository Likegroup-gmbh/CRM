## Security Review Report (Bounty/Red-Team Stil)

### Executive Summary
Mehrere kritische Schwachstellen ermöglichen Account‑Übernahme mit Admin‑Rechten und potenziell beliebige Datenbankeingriffe. Zusätzlich bestehen XSS‑Risiken aufgrund weit verbreiteter `innerHTML`/`insertAdjacentHTML` Nutzung und einer zu laxen CSP. Sofortmaßnahmen unten priorisiert.

### Risiko-Ranking (CVSS-ähnlich, geschätzt)
- Kritisch (10.0): Offline‑Auth‑Bypass zu Admin
- Kritisch (9.5): Client‑seitige beliebige SQL via RPC `execute_sql`
- Hoch (8.5): Reflected/Stored XSS durch unsichere DOM‑Sinks + `unsafe-inline` CSP
- Mittel (6.0): Schwache Passwortpolicy im Frontend (4 Zeichen)
- Mittel (6.0): PII Logging (E‑Mail/Name) in Konsole
- Mittel (5.5): Hardcodierter Supabase Anon Key + fehlende Bestätigung strenger RLS

---

### Findings im Detail

#### 1) Auth-Bypass zu Admin über Offline-Modus [Kritisch]
- Ort: `src/modules/auth/AuthService.js`
- Verhalten: Wenn Supabase fehlt/fehlerhaft ist, wird `this._offlineMode = true` und ein lokaler Benutzer mit Rolle `admin` gesetzt oder aus `localStorage.offline_user` geladen. Es existiert zusätzlich ein Dev‑Login (`test@example.com`/`test123`) mit Admin‑Rechten.
- PoC:
  1. Browser-Konsole: `localStorage.setItem('offline_user', JSON.stringify({id:'x', name:'X', rolle:'admin', unterrolle:'admin'}))`
  2. Seite neu laden → volle Admin-Navigation und Rechte
- Impact: Vollständige Kompromittierung (RCE via XSS möglich, alle Daten lesbar/änderbar/löschbar je nach RLS).
- Fix (sofort):
  - Offline‑Modus und Dev‑Login strikt hinter Build‑Zeit Flag `process.env.NODE_ENV !== 'production'` deaktivieren; in Produktion hart aus.
  - Entfernen des automatischen Fallbacks auf Offline‑Admin; beim Fehler: Logout + Login-Screen anzeigen.
  - `localStorage.offline_user` komplett entfernen.

Empfohlene Code‑Skizze (Prinzip):
```js
// Produktion: kein Offline-Fallback
if (import.meta.env.PROD) {
  this._offlineMode = false;
  return false; // erzwinge Login
}
```

#### 2) Beliebige SQL via RPC `execute_sql` vom Client [Kritisch]
- Ort: `src/core/DataService.js` → `executeQuery(query, params)` ruft `supabase.rpc('execute_sql', { sql_query: query, sql_params: params })` auf.
- Risiko: Wenn die RPC‑Funktion auf dem Backend existiert und nicht strikt abgesichert ist, kann ein Angreifer beliebiges SQL aus dem Browser absetzen (DDL/DML/Exfiltration trotz RLS, je nach definer‑Sicherheitskontext der Funktion).
- PoC (angenommen RPC ist aktiv):
  ```js
  window.dataService.executeQuery('delete from benutzer where true', [])
  ```
- Fix (sofort):
  - `execute_sql` RPC deaktivieren/entfernen.
  - Ausschließlich parametrisierte, whiteliste‑basierte RPCs pro Use‑Case nutzen (keine freien SQL‑Strings aus dem Client!).
  - Verifizieren, dass alle RPCs mit `security definer` nur das Nötige erlauben und RLS nicht umgehen.

#### 3) XSS durch unsichere DOM-APIs + zu lockere CSP [Hoch]
- Orte (Beispiele):
  - `innerHTML`/`insertAdjacentHTML` an vielen Stellen, z.B. `CreatorList.js`, `KampagneDetail.js`, `KooperationDetail.js`, `ActionsDropdown.js`, `AuthUtils.js`, `...`
  - Teils wird `validatorSystem.sanitizeHtml` verwendet, aber inkonsistent.
  - `index.html` CSP erlaubt `script-src 'unsafe-inline'` und `style-src 'unsafe-inline'` → XSS‑Schutz weitgehend ausgehebelt.
- Impact: Reflected/Stored XSS durch Anzeige von aus DB stammenden Feldern (z.B. Namen, Beschreibungen). In Kombination mit Finding #1/#2 → Kontoübernahme/Defacement.
- Fix (sofort):
  - Keine Rohdaten in `innerHTML`/`insertAdjacentHTML` schreiben. Entweder
    - DOM sicher bauen (`createElement`, `textContent`) oder
    - Eine bewährte Sanitizer‑Lib wie DOMPurify strikt verwenden (und konsistent!).
  - CSP verschärfen: Entferne `'unsafe-inline'`, arbeite mit Nonces/Hashes und bundle Assets lokal über Vite. Beispiel:
    ```html
    Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<RANDOM>'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' https://<your-supabase>.supabase.co;
    ```

#### 4) Schwache Passwortpolicy im Frontend [Mittel]
- Ort: `AuthService.validatePasswordStrength` → Mindestlänge 4.
- Fix: Mindestanforderungen (z.B. 12 Zeichen, Groß/Klein/Zahl/Sonderzeichen) und Server‑Side durchsetzen. Supabase‑Policy anpassen; Frontend‑Validierung nur als UX‑Ergänzung.

#### 5) PII/Debug Logging [Mittel]
- Orte: vielfach `console.log`, u.a. Anzeige von E‑Mail/Name bei Login.
- Fix: In Produktion Logging minimieren/anonymisieren; Feature‑Flag für Debug.

#### 6) Hardcodierter Supabase Anon Key + unklare RLS-Abdeckung [Mittel]
- Ort: `src/core/ConfigSystem.js` enthält URL + ANON KEY.
- Hinweis: Anon Key ist client‑seitig üblich, aber nur sicher bei konsequent strengen RLS‑Policies auf ALLEN Tabellen/Views/RPCs.
- Fix:
  - Build‑Zeit Konfiguration (env‑Variablen) nutzen; kein Key in Repo.
  - RLS prüfen: Nur autorisierte Nutzer sehen/bearbeiten eigene Daten. Tabellen wie `benutzer`, `user_permissions` besonders restriktiv.

---

### Sofortmaßnahmen (24–48h)
1. Offline‑Modus + Dev‑Login in Produktion deaktivieren/entfernen.
2. RPC `execute_sql` auf dem Backend deaktivieren; vorhandene Aufrufe im Frontend entfernen/ersetzen.
3. CSP verschärfen: `'unsafe-inline'` entfernen, Nonces/Hashes einführen, JS/CSS bundlen.
4. XSS‑Sweep: Alle `innerHTML`/`insertAdjacentHTML`-Stellen prüfen und auf sichere Renderpfade umstellen.
5. Production‑Build ohne Debug‑Logs.
6. RLS‑Audit für alle Datenpfade (lesen/schreiben); Tests ergänzen.

### Härtung/Nächste Schritte (1–2 Wochen)
- DOMPurify einführen und zentral via `validatorSystem` kapseln; Linter‑Regel gegen unkontrolliertes `innerHTML`.
- Stärkere Passwort‑Policy + serverseitige Policies in Supabase.
- Security‑Headers komplettieren (z.B. `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`).
- E2E‑Tests für Berechtigungen (rollenbasiert) und XSS‑Regression.
- Secret‑Handling: Keys via `.env` + CI‑Secrets, keine Secrets im Repo.

---

### Technische Anhänge

#### Beispiel: Sichere DOM‑Erzeugung statt innerHTML
```js
// unsicher (XSS-gefährdet)
el.innerHTML = `<div>${name}</div>`;

// sicher
const div = document.createElement('div');
div.textContent = name; // automatisch escaped
el.replaceChildren(div);
```

#### Beispiel: DOMPurify zentral nutzen
```js
import DOMPurify from 'dompurify';

export function safeHtml(html) {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

// Nutzung
el.innerHTML = safeHtml(userProvidedHtml);
```

#### Beispiel: CSP (ohne unsafe-inline)
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<GENERATED>'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' https://<your-supabase>.supabase.co;
```

---

### Maßnahmen-Checkliste
- [ ] Offline‑Modus/Dev‑Login in Prod entfernt/abgeschaltet
- [ ] RPC `execute_sql` entfernt; Frontend‑Nutzung eliminiert
- [ ] CSP verschärft (keine `'unsafe-inline'`), Nonce/Hash implementiert
- [ ] XSS‑Sweep abgeschlossen; Linter‑Regeln hinzugefügt
- [ ] DOMPurify integriert und zentralisiert
- [ ] Passwort‑Policy erhöht; Backendschutz bestätigt
- [ ] Debug/PII‑Logs in Prod deaktiviert
- [ ] Vollständiger RLS‑Audit dokumentiert und getestet

—
Kontakt für Rückfragen/Validierung von Fixes: Security‑Review Team



