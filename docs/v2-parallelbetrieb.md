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
