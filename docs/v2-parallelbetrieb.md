# v2 Parallelbetrieb

Zwei Linien, zwei Ordner, zwei Cursor-Fenster. Kein `/v2`-Pfad in der SPA.

| Linie | Ordner | Branch | Lokal | Deploy |
| --- | --- | --- | --- | --- |
| v1 Live | `CRM` | `staging` → `main` | `:3000` | Production + Staging-Site |
| v2 Preview | `CRM-v2` | `v2` | `:3001` | Branch-Deploy `v2--<site>.netlify.app` |

Immer `staging` nach `v2` mergen. Nie `v2` nach `staging`/`main`, bis Cutover.

## Lokal (nach dem ersten Setup)

```bash
# v1
cd /Users/deezy/CRM
npm run dev

# v2 — Port 3001 steht in package.json / vite.config
cd /Users/deezy/CRM-v2
npm run dev
```

Badge **v2** oben rechts = richtiger Channel. Fehlt es, bist du auf v1 oder `VITE_APP_CHANNEL` ist leer.

## Kollege: Worktree holen

```bash
git fetch origin
./scripts/setup-v2-worktree.sh
```

Oder manuell:

```bash
git fetch origin
git worktree add --track -b v2 ../CRM-v2 origin/v2
cp .env ../CRM-v2/.env
# in CRM-v2: VITE_APP_CHANNEL=v2 setzen
cd ../CRM-v2 && npm install && npm run dev
```

Falls lokaler Branch `v2` schon existiert: `git worktree add ../CRM-v2 v2`.

## Hotfix auf v1

1. Cursor-Fenster `CRM` (Statusleiste: `staging`).
2. Fixen, committen, `git push origin staging`.
3. Nach QA: `staging` → `main` wie bisher.
4. Im Fenster `CRM-v2`:

```bash
git fetch origin
git merge origin/staging
```

Nicht: `git checkout v2` im Ordner `CRM`. Nicht: `git merge v2` auf `staging`.

## Datenbank und Functions

Eine Supabase für beide. Solange v1 live ist:

- nur additive Migrations (neue Tabelle, nullable Column, Index)
- nichts droppen oder umbenennen, das v1 noch liest
- Breaking Function-Contracts: neuer Name (`…-v2-background`), nicht denselben Endpoint knacken

### Breaking Migrations: erst v1-Frontend, dann Migration

Eine Migration ist breaking, sobald sie etwas wegnimmt oder verengt, das der Code auf `main` noch benutzt: `REVOKE`, `DROP POLICY`/engere Policy, `DROP`/Umbenennung, geänderte Trigger- oder RPC-Logik, neue Pflichtfelder.

Weil v1 und v2 dieselbe Datenbank haben, wirkt die Migration sofort auch auf die Live-Seite. Ein Fix, der nur auf `v2` liegt, hilft v1 nicht.

Reihenfolge, ohne Ausnahme:

1. Frontend-Änderung so bauen, dass sie **mit alter und neuer DB** läuft (oder zuerst das neue Verhalten additiv anbieten, z. B. neuer RPC neben der alten Tabelle).
2. Dieses Frontend auf `staging` → `main` bringen und warten, bis es live ist (`version.json` auf der Live-Domain zeigt den neuen Build).
3. Erst dann `apply_migration` für den Teil, der das Alte wegnimmt.
4. Danach Smoke-Test: `npm run smoke:magic-link` (siehe unten) und Logs auf 4xx prüfen.

Vor jedem `apply_migration` fragen:

- Liest oder schreibt `main` die betroffene Tabelle, Policy oder Funktion noch? (`git grep` in `origin/main`)
- Gilt das auch für Flows ohne Login (Einladungslink, Gast-Share, Creator-Upload, Bewerbung)? Die fallen nicht bei der QA auf, sondern erst beim Kunden.
- Gibt es ein ROLLBACK im Kopf der Migrationsdatei, das ich in einer Minute ausführen kann?

Fall aus der Praxis (27.10.2026): `signup_rollen_nicht_vom_client` sperrte `magic_links` für `anon`, das passende Frontend lag nur auf `v2`. Auf der Live-Seite zeigte jeder Einladungslink „Link ungültig“, bis der Fix auf `main` war.

### Smoke-Test Magic-Link

`npm run smoke:magic-link` prüft die Registrierungsseite auf der Live-Domain ohne Secrets und ohne Schreibzugriff: Seite lädt, ruft `magic_link_vorschau` auf (liest `magic_links` nicht direkt), RPC antwortet als `anon`, Tabelle ist für `anon` zu.

- GitHub Action `Smoke Magic-Link` läuft nach jedem Push auf `main` (mit Wiederholungen, bis Netlify ausgeliefert hat), alle 30 Minuten und per Hand. Schlägt sie fehl, kommt eine Mail.
- Gegen die v2-Preview: `SMOKE_BASE_URL=https://v2--<site>.netlify.app npm run smoke:magic-link`
- Den Signup-Trigger (Token → Rolle `kunde`, freigeschaltet, Rolle aus den Metadaten wird ignoriert) prüft [supabase/tests/magic_link_signup_rollback.sql](../supabase/tests/magic_link_signup_rollback.sql). Es rollt per Exception zurück und hinterlässt keine Daten. Nach jeder Änderung an `handle_new_auth_user`, `magic_links` oder den Policies auf `benutzer` ausführen.

## Netlify (manuell, Staging-Site)

Nicht auf der Production-Site. Nicht „all branches“.

1. Site configuration → Build & deploy → Branch deploys → nur Branch `v2`.
2. Nach dem ersten Push: URL `https://v2--<site>.netlify.app`.
3. Dieselbe URL plus `http://localhost:3001/**` in Supabase Auth → Redirect URLs (gleiche Instanz wie v1; Redirects sind projektweit).

Optional später: Branch-Subdomain `v2.<domain>` über Netlify DNS. Kein Plan-Upgrade, aber Nameserver müssen bei Netlify liegen.

`[context.v2.environment]` in `netlify.toml` setzt `VITE_APP_CHANNEL=v2` nur, wenn der Branch-Deploy in der UI aktiv ist. Sonst fehlt das Badge auf Netlify.

## Altbestand-Linien: Migration (ADR 0058)

Voraussetzung: V1-Hotfix (`ist_altbestand = false` in den Briefing-Listen) ist auf Production live. Env: `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY`.

1. Dry-run, schreibt nur CSV nach `reports/legacy-linien/<zeit>/` (`kampagnen.csv`, `linien.csv`, `koops.csv`):
   `node scripts/legacy-linien-migration.js`
2. Pilot, je Kampagne erst Dry-run, dann anwenden:
   `node scripts/legacy-linien-migration.js --kampagne 1d7f46ba-6629-4022-9dba-fb15ac103de9` (EDEKA SW Jahreskooperation)
   `node scripts/legacy-linien-migration.js --kampagne ac4910de-ed81-4b0f-a31e-ae350d65ba60` (Ninja Q4 Total Budget)
   jeweils nochmal mit `--apply`. Danach im CRM prüfen: Koops, Videos, Items, Rechnungen, Verträge je Kampagne unverändert; Rest der Produktionen nicht negativ.
3. Wellen: `--apply --limit 20` (nur Kampagnen mit Status `auto`). Review-Kampagnen: `freigabe=ja` in `kampagnen.csv` setzen, dann `--apply --reapply kampagnen.csv`.
4. Korrektur einzelner Zuordnungen: CSV `kooperation_id;ziel_briefing_id`, `--verschieben datei.csv [--apply]`.
5. Rückgängig: `--rollback <lauf_id> [--kampagne <id>]` (stellt aus `legacy_linien_backup` wieder her).
6. Bis zum Cutover wöchentlich wiederholen (idempotent), final direkt davor.
