# PRD: Listen-Sharing „Zugänge" — Gast ohne Account

**Status:** Entwurf (gegrillt & entschieden, Umsetzung ausstehend)
**Datum:** 2026-08-28
**Kontext:** Eileen-Mund-Bug (Share-Gast landete als `rolle=pending` in der Mitarbeiterliste) + Anforderung: Listen sollen per Mail weiterleitbar sein, mehrere Kollegen (6–7) arbeiten an derselben Liste, ohne Account, ohne Approval-Schritt.

---

## 1. Ziel

Eine Liste (Sourcing / Strategie / Kampagne) kann über einen **Zugang** geteilt werden:
Link + 6-stelliger Code per Mail. Wer den Link hat, gibt **Code + eigenen Namen** ein und ist drin.
Kein Supabase-Account, keine E-Mail-Verifizierung, kein Freischalte-Schritt, keine Verzögerung.

## 2. Festgelegte Entscheidungen (Grilling Q1–Q13)

| # | Entscheidung |
|---|---|
| Q1/Q7 | **Ein Link pro Zugang**, personenunabhängig. Weiterleitung der Mail funktioniert nativ. |
| Q2 | **Kein Tor** außer Link + Code. Kein Approval, keine Domain-Sperre, keine E-Mail-Prüfung. |
| Q3 | **Pro Gerät/Browser:** nach Code-Eingabe 30 Tage gültige Session (signiertes Gast-JWT im localStorage). |
| Q4 | **Rechte hängen am Zugang** (`ansehen` / `feedback`), nicht an der Person. |
| Q5/Q9 | **Kein Per-Person-Sperren.** Sperren = ganzen Zugang widerrufen oder Code rotieren (betrifft alle auf dem Zugang). Es wird **keine E-Mail** erhoben — nur der Name. |
| Q6/Q13 | Beim Einstieg: **Code + Name**. Name wird als Teilnehmer gespeichert; Feedback-Autor = `<Name> (Gast)`. Namen sind für alle Betrachter der Liste sichtbar (Google-Docs-Modell). |
| Q8 | **Mehrere Zugänge pro Liste** (z. B. „OMC" mit Feedback, „Produktionsfirma" nur Ansehen) — getrennt widerrufbar, getrennte Codes, getrennte Teilnehmer-Listen. |
| Q10/Q11 | **Optionales Ablaufdatum** pro Zugang (Default: keins) + optionale Checkbox **„endet, wenn Kampagne abgeschlossen"** — nutzt die bestehende Funktion `kampagne_is_completed()` (alle Koops haben alle Videos freigegeben), ausgewertet bei jedem Zugriff. Nur verfügbar, wenn die Liste an einer Kampagne hängt. |
| Q12 | **Keine Migrations-Mail.** Alte Shares werden widerrufen; Mitarbeiter teilen betroffene Listen neu (Code geht per Mail raus). |

## 3. Architektur

**Kern:** Der Gast bekommt nach Code-Eingabe ein **signiertes Gast-JWT** mit Claim `share_id` (+ `participant_id`, `name`). Das Frontend spricht damit weiterhin **direkt PostgREST** an — die Detail-Module (CreatorAuswahlDetail, StrategieDetail, Kampagne-Gast-Ansicht) bleiben unangetastet. Die Durchsetzung bleibt in RLS, nur die Prüfung ändert sich: statt `auth.uid() → benutzer → list_shares` jetzt `jwt.share_id → list_shares`.

**Verworfen:** Voll-Proxy über die Edge Function (alle Reads/Writes durch die Function). Hätte ein Umschreiben aller Gast-Datenpfade bedeutet, ohne Sicherheitsgewinn gegenüber Claim-RLS.

**Folge:** `auth.users`-Eintrag und `benutzer`-Zeile für Gäste entfallen komplett. Der `handle_new_auth_user`-Trigger läuft für Gäste nie mehr — der Eileen-Bug kann strukturell nicht wieder auftreten.

```
Staff: ShareListDialog ──► share-list create ──► Zugang (token+code) ──► Resend-Mail (Link+Code)
Gast:  /share/:token ──► resolve ──► Code+Name ──► verify ──► Gast-JWT (30d)
                                                          │
                          PostgREST mit Gast-JWT ──► RLS: share_claim_has_access(share_id, entity)
```

## 4. Datenmodell

```sql
-- list_shares wird umgebaut (email/gast_benutzer_id entfallen)
list_shares:
  id, token (unique, 48 hex), entity_type, entity_id,
  label text,                    -- interner Name, z.B. "OMC"
  code_hash text,                -- 6-stelliger Code, nur gehasht
  rechte text,                   -- 'ansehen' | 'feedback'
  expires_at timestamptz null,
  ends_with_kampagne bool default false,
  revoked_at, last_access_at, created_by, created_at

share_participants:
  id, share_id → list_shares,
  name text,
  first_seen_at, last_seen_at    -- bei verify gesetzt
  unique (share_id, lower(name))
```

Keine Session-Tabelle: JWT ist stateless; Widerruf wirkt sofort, weil die RLS-Prüfung `revoked_at`/`expires_at`/`kampagne_is_completed` bei **jedem** Request gegen `list_shares` prüft.

## 5. Edge Function `share-list` v2

| Action | Auth | Zweck |
|---|---|---|
| `create` | Staff-JWT | Zugang anlegen (label, rechte, expires_at, ends_with_kampagne), Code generieren, optional Einladungs-Mail via Resend an frei eingegebene Adressen (nur Zustellung, keine Identität) |
| `resolve` | öffentlich | token → Listen-Name, Label, rechte, Status (für die Eingangs-Maske) |
| `verify` | öffentlich, **rate-limitiert** | token + code + name → Teilnehmer anlegen/finden, `last_access_at` setzen, Gast-JWT ausstellen |
| `rotate_code` | Staff-JWT | neuen Code, alte Sessions laufen weiter bis JWT-Ablauf, neue Logins nur mit neuem Code |
| `revoke` / `update` | Staff-JWT | widerrufen / Rechte, Ablauf, Label ändern |
| `participants` | Staff-JWT | Teilnehmer-Liste pro Zugang (Name, first/last seen) |

**Rate-Limit `verify`:** pro Token+IP max. ~5 Versuche / 15 min, danach temporäre Sperre. Code nur als Hash in der DB.

**Infra:** Das Projekt-JWT-Secret muss als Edge-Function-Secret hinterlegt werden (z. B. `GUEST_JWT_SECRET`), damit die Function HS256-JWTs signieren kann, die PostgREST akzeptiert. Claims: `{ role: 'anon', share_id, participant_id, name, exp: 30d }`.

## 6. RLS-Umbau

- `gast_has_share(type, id, write)` → neue Funktion `share_claim_has_access(type, id, write)`:
  liest `share_id` aus `auth.jwt()`, prüft gegen `list_shares`: Entity-Match, `revoked_at is null`, `expires_at` nicht überschritten, `ends_with_kampagne` → `kampagne_is_completed()` false, bei write `rechte = 'feedback'`.
- **Alle ~20 `*_gast_*` Policies bleiben bestehen** — nur der Funktionsrumpf ändert sich. Minimale Migration.
- `*_no_gast` Deny-Policies: `current_role_is_gast()` → „JWT hat `share_id`-Claim".
- `benutzer_gast_own_row_only` entfällt (keine Gast-`benutzer`-Zeilen mehr).
- **Audit nötig:** Was sehen `anon`/`authenticated` ohne `benutzer`-Zeile heute schon? Bekannter Fall: `custom_columns` hat `SELECT USING (true)` für authenticated — Gast-JWT mit `role=anon` umgeht das; trotzdem einmal alle Policies auf unbeabsichtigte anon/authenticated-Grants prüfen.

## 7. Frontend

- **`GuestShareApp.js`:** OTP-Flow raus → Maske „Code + Ihr Name". Nach verify: JWT im localStorage, Supabase-Client im Gast-Modus mit `Authorization: Bearer <jwt>` initialisieren. Synthetischer `window.currentUser = { rolle: 'gast', name }` (aus JWT) — `isGast`/`isGastReadonly`/PermissionSystem-Matrix `gast` funktionieren unverändert weiter.
- **`ModuleRegistry`:** Routensperre (`guestShare.allowedRoute`) bleibt wie heute.
- **Detail-Module:** unverändert — sie fragen `window.supabase`, RLS begrenzt auf die geteilte Entität.
- **Feedback-Pfade** (`CreatorAuswahlDetail`, `StrategieDetailTableEvents`, `VideoFeedbackRepository`, `StillFeedbackRepository`): Autor aus synthetischem User (`<name> (Gast)`), `author_benutzer_id = null` (Spalten sind nullable — geprüft).
- **Sperrseite `renderGuestNoAccess`:** ohne Auth-Session keine DB-Abfrage eigener Shares mehr — stattdessen lokal gespeicherte Zugänge (Token aus localStorage) als Link-Liste anzeigen.
- **`ShareListDialog`:** statt E-Mail-Feld → Zugänge verwalten: Label, Rechte, Ablaufdatum, „endet mit Kampagne"-Checkbox, Code anzeigen/kopieren/rotieren, Einladungs-Mail an freie Adressen absenden, Teilnehmer-Liste.
- **`SharesAdminPage`:** Zugänge statt E-Mail-Shares; Teilnehmer einsehbar.

## 8. Cutover / Migration

1. Alte `list_shares`-Zeilen: `revoked_at = now()` (Eileen, Svenja, p.venturella, lisa.b, mackeldanz, oliver.ma — 7 Shares). Mitarbeiter teilen neu.
2. Gast-`benutzer`-Zeilen (`rolle='gast'`) + zugehörige `auth.users` löschen. Vorher: evtl. vorhandenes Gast-Feedback mit `author_benutzer_id` auf `null` setzen (Name steht in `author_name`). Eileens `pending`-Zeile (`157e1d2c-…`) ebenfalls löschen.
3. Schema-Migration: `email`, `gast_benutzer_id` aus `list_shares` entfernen; neue Spalten/Tabelle wie oben.
4. Alte OTP-/Session-Pfade im Code entfernen (`signInWithOtp` im Gast-Flow, `shouldCreateUser:false`-Logik, E-Mail-Kollisionscheck in `create`).

## 9. Sicherheit

- 6-stelliger Code ist brute-forcebar → Rate-Limit auf `verify` ist **Pflicht**, kein Nice-to-have.
- Code als Hash speichern; im Klartext nur in der Mail/Dialog-Anzeige.
- JWT-Secret nie ins Frontend; nur Edge-Function-Secret.
- Widerruf wirkt sofort (RLS prüft pro Request), Code-Rotation wirkt ab sofort für neue Logins.
- Link + Code in derselben Mail: verhindert Zugriff durch Link-Preview-Bots (Chat-Tools fetchen URLs), ist aber **kein** Schutz gegen bewusstes Weiterleiten — das ist gewollt.

## 10. Phasen

1. **DB:** Schema-Migration + `share_claim_has_access` + Policy-Rumpf-Tausch + anon/authenticated-Audit.
2. **Edge Function:** v2-Actions (create/resolve/verify/rotate/revoke/participants) + Resend-Mail mit Code.
3. **Frontend:** GuestShareApp-Flow, JWT-Client-Wiring, ShareListDialog, SharesAdminPage, Sperrseite.
4. **Cutover:** alte Shares widerrufen, Gast-User löschen, Eileen-Cleanup.
5. **Tests:** RLS (Gast sieht nur geteilte Entität; Write nur mit `feedback`; revoked/expired/completed = kein Zugriff), verify-Rate-Limit, Code-Rotation.

## 11. Offene Punkte

- [ ] JWT-Secret als Edge-Function-Secret hinterlegen (Ops-Schritt).
- [ ] anon/authenticated-Policy-Audit (Ergebnis kann Nachbesserungen außerhalb des Sharing-Scopes auslösen).
- [ ] Namens-Duplikate in der Teilnehmer-Liste (zwei „Michael"): Anzeige ggf. um first_seen ergänzen — kosmetisch, nicht blockierend.
