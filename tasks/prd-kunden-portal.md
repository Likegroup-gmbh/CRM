# PRD: Kunden-Portal (Externes Kunden-Login, Kampagnen- und Inhalteinsicht)

## Ziel
- **Kunden einladen**, eigenes Login erhalten, **nur eigene Daten** (Unternehmen/Marke/Kampagnen/Kooperationen/Inhalte) sehen.
- **Benachrichtigungen** bei neuen Uploads/Status-Änderungen per E-Mail (Resend) und optional In-App.
- **Leichtes Onboarding** (OTP/E-Mail-Confirm, minimaler Setup-Wizard).

## Scope (v1)
- Rollen: `kunde` (read-only), `kunde_editor` (eingeschränkt bearbeitbar), `admin` (bestehend).
- Kunden-Zuordnung: Kunde gehört zu mindestens einem `unternehmen` und optional zu `marke(n)`; Sichtbarkeit kaskadiert auf `kampagne`, `kooperation`, `uploads`.
- UI: Separater Kunden-Bereich in bestehendem Frontend (Routing-Gate via `PermissionSystem`).
- E-Mail: Resend für Transaktionsmails (Einladung, Upload-Benachrichtigung).

Nicht im Scope v1: komplexe Freigabe-Workflows, Kommentare, Datei-Vorschau mit DRM.

## Akzeptanzkriterien
- **Login:** Eingeladene Kunden können sich anmelden (OTP/Email-Link), E-Mail bestätigt.
- **Sichtbarkeit:** Kunde sieht nur Entitäten, die über Unternehmen/Marke referenziert sind.
- **Listen/Details:** Kampagnen- und Kooperationen-Listen zeigen nur kundenspezifische Items; Detailseiten enthalten Upload-Liste.
- **Benachrichtigung:** Beim neuen Upload in relevanter Kooperation erhält Kunde E-Mail innerhalb <2 Min.
- **RLS:** Alle kundenseitigen Queries durch RLS abgesichert; Admin weiterhin Vollzugriff.
- **Onboarding:** Wizard führt durch Passwort-Set (falls benötigt), Profil-Name, Benachrichtigungs-Opt-in.
 - **Admin-Verwaltung:** Admin kann Kunden in separater Liste/Detail verwalten (einladen, deaktivieren/aktivieren, Zuordnung Unternehmen/Marke), identisch zur Mitarbeiter-Verwaltung.

## Architekturübersicht
- Supabase Auth (bestehend) + neue Rollen `kunde`, `kunde_editor` in `benutzer.rolle`.
- RLS Policies auf Tabellen: `unternehmen`, `marke`, `kampagne`, `kooperation`, `kooperation_uploads`.
- Junction-Tabellen: `kunde_unternehmen`, `kunde_marke`.
- Edge Function `notify-customer-upload` (Deno) → Resend API.
- Frontend: Reuse bestehende Module mit `PermissionSystem` und `DataService`-Filter; eigener Kunden-Start (`/kunden`).

## Datenmodell (SQL)
- Neue Tabellen:
  - `kunde` (optional, wenn separate Entität gewünscht) oder reuse `benutzer` mit `rolle in ('kunde','kunde_editor')`.
  - `kunde_unternehmen(kunde_id uuid fk benutzer.id, unternehmen_id uuid fk unternehmen.id, created_at timestamptz default now())`.
  - `kunde_marke(kunde_id uuid fk benutzer.id, marke_id uuid fk marke.id, created_at timestamptz default now())`.
- Indizes: auf allen FK-Spalten + Composite Unique `(kunde_id, unternehmen_id)` und `(kunde_id, marke_id)`.

```sql
-- 01_roles.sql
alter table benutzer add column if not exists unterrolle text;

-- 02_kunde_links.sql
create table if not exists kunde_unternehmen (
  kunde_id uuid references benutzer(id) on delete cascade,
  unternehmen_id uuid references unternehmen(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (kunde_id, unternehmen_id)
);

create table if not exists kunde_marke (
  kunde_id uuid references benutzer(id) on delete cascade,
  marke_id uuid references marke(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (kunde_id, marke_id)
);
```

## RLS-Policies (Konzept)
- Aktivieren: `alter table <t> enable row level security;`
- `unternehmen`: erlauben, wenn `exists (select 1 from kunde_unternehmen where kunde_id = auth.uid() and unternehmen_id = unternehmen.id)`.
- `marke`: erlauben via `kunde_marke` oder transitiv über `marke.unternehmen_id` in `kunde_unternehmen`.
- `kampagne`: erlauben, wenn `kampagne.marke_id` in sichtbaren Marken oder `kampagne.unternehmen_id` in sichtbaren Unternehmen.
- `kooperation`: erlauben, wenn `kooperation.kampagne_id` in sichtbaren Kampagnen.
- `kooperation_uploads`: erlauben, wenn zugehörige Kooperation sichtbar.

Beispiel:
```sql
create policy kunden_see_unternehmen on unternehmen
for select using (
  exists (
    select 1 from kunde_unternehmen ku
    where ku.kunde_id = auth.uid() and ku.unternehmen_id = unternehmen.id
  )
);
```

## Einladungs- und Onboarding-Flow
1. Admin legt neuen Benutzer mit Rolle `kunde` an (bestehendes Admin-UI erweitern oder SQL/Edge-Function).
2. Verknüpfung mit `kunde_unternehmen`/`kunde_marke`.
3. E-Mail Einladung via Resend: Magic Link/OTP zu `verify-email.html` bzw. Kunden-Start `/kunden`.
4. Wizard (Frontend): Profil prüfen, Opt-ins, Fertig.

## Benachrichtigungen (Resend)
- Event: neuer Upload in `kooperation_uploads` (Insert Trigger → Edge Function → Resend E-Mail an alle betroffenen Kunden der Marke/Unternehmen).
- E-Mail-Template schlicht, Variablen: Unternehmen, Marke, Kampagne, Kooperation, Dateiname/Typ, Link.
- Rate-Limit: Batch pro Kooperation und Kunde gruppieren (debounce 60s) um Spam zu vermeiden.

## Edge Function: notify-customer-upload (Pseudo)
```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const payload = await req.json(); // { kooperation_id, upload_id }
  // 1) Daten joinen: kooperation → kampagne → marke/unternehmen
  // 2) Empfänger ermitteln aus kunde_unternehmen/kunde_marke
  // 3) Resend API call pro Empfänger
  return new Response(JSON.stringify({ ok: true }));
});
```

## Frontend
- `PermissionSystem`: Rollen `kunde`, `kunde_editor` hinzufügen. Sichtbarkeit: nur `dashboard`, `kampagne`, `kooperation` (read), `briefing` (read), `uploads` (read). Keine `rechnung`.
- Routing: `/kunden` Landing → Kampagnen-Liste gefiltert nach RLS.
- UI-Reuse: Listen-Komponenten mit `can_view` Gates + `DataService`-Filter; Upload-Liste als read-only Tabelle mit Download-Link.
- Onboarding Wizard: einfacher 1–2 Schritte Modal bei erstem Login (Flag `first_login_done` auf `benutzer`).

## Admin-Kundenverwaltung (analog Mitarbeiter)
- Route: `/admin/kunden` (nur `admin`).
- Komponenten:
  - `src/modules/admin/KundenList.js` – Liste aller Kunden (`benutzer` mit `rolle in ('kunde','kunde_editor')`).
  - `src/modules/admin/KundenDetail.js` – Detailansicht inkl. Zuordnungen und Status.
- Liste (Spalten): Name, E-Mail, Rolle/Unterrolle, Status (aktiv/deaktiviert), Unternehmen/Marken (Counts/Badges), erstellt_am.
- Aktionen (ActionsDropdown):
  - Kunde einladen / Einladungslink kopieren (Resend).
  - Aktivieren/Deaktivieren.
  - Unternehmen zuordnen / entfernen (reuse Ansprechpartner-/Marke-Modal-Pattern).
  - Marken zuordnen / entfernen.
  - Rolle ändern (`kunde` ↔ `kunde_editor`).
  - OTP/Passwort zurücksetzen (falls erforderlich, via Supabase Admin-API/Edge).
- Suchen/Filtern: nach Name/E-Mail/Rolle/Status/Unternehmen/Marke.
- DataService: Entity `kunden` mapped auf Tabelle `benutzer` mit Filter `rolle in ('kunde','kunde_editor')`; Relations laden: `kunde_unternehmen`, `kunde_marke`.
- Berechtigungen: Gates ausschließlich `admin`; Logs/Audits optional.

## Tasks/Milestones
- Datenbank & RLS
  - Migration: Tabellen `kunde_unternehmen`, `kunde_marke`, Indizes, RLS aktivieren.
  - Policies für alle relevanten Tabellen implementieren und getestet.
- Backend/Edge
  - Edge Function `notify-customer-upload` (insert hook), Secret für Resend Key.
- Frontend
  - `PermissionSystem` um Kundenrollen erweitern, Gates setzen.
  - Admin-UI: Kundenverwaltung analog Mitarbeiter:
    - Route `/admin/kunden` registrieren.
    - `KundenList.js` mit Suche/Filter/ActionsDropdown.
    - `KundenDetail.js` inkl. Zuordnungen Unternehmen/Marke und Status.
    - Actions: Einladen/Link kopieren, Aktivieren/Deaktivieren, Rolle ändern, Zuordnungen pflegen.
  - Kunden-UI: Kampagnen-/Kooperationen-Liste + Upload-Liste.
  - Onboarding Wizard + Benachrichtigungs-Opt-in Flag.
- E-Mail
  - Resend Account, API Key als Secret, Templates (Einladung, Upload-Info).

## Akzeptanztests (stichpunktartig)
- Kundenbenutzer ohne Zuordnung sieht 0 Elemente.
- Kunde mit `kunde_unternehmen` sieht nur zugehörige Kampagnen/Kooperationen.
- Upload erzeugt innerhalb 2 Min. eine E-Mail.
- Admin-Sicht unverändert, keine Datenlecks bei direkten REST-Calls (RLS greift).

## Risiken/Offene Punkte
- Resend Zustellbarkeit/Rate-Limits; Fallback lokal (Console) in Dev.
- RLS-Performance bei tiefen EXISTS-Ketten → Indizes zwingend.
- File-Zugriff: Falls Storage Buckets privat sind, signierte URLs generieren (Edge) statt Direktlinks.
