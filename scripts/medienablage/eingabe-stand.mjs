// eingabe-stand.mjs
// Grundlage der Eingabeseite (eingabe.mjs): Pfade, .env lesen/schreiben (Modus 600),
// Zertifikat- und Haken-Stand, die Definition aller Felder, Schritte und Aktionen sowie
// der Stand, den die Seite anzeigt.

import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumente } from './_env.mjs';

export const HIER = path.dirname(fileURLToPath(import.meta.url));
export const args = argumente();
export const ROOT = path.resolve(args.root || path.resolve(HIER, '../..'));
export const DATEI = { live: path.join(ROOT, '.env') };
export const SECRETS = path.join(ROOT, '.secrets');
export const KEY_FILE = path.join(SECRETS, 'medienablage-app.key');
export const CRT_FILE = path.join(SECRETS, 'medienablage-app.crt');
export const HAKEN_FILE = path.join(SECRETS, 'eingabe-haken.json');
export const NETLIFY = { live: path.join(SECRETS, 'netlify-live-ablage.env') };
const KOPF = '# Medienablage (scripts/medienablage/eingabe.mjs)';

const GUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const SUPA_KEY = '^(eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+|sb_(secret|publishable)_[\\w-]+)$';
const SITE_URL = '^https://[a-z0-9-]+\\.sharepoint\\.com/sites/[^/\\s]+$';
const OHNE_LEER = '^\\S+$';
const SP_HOST = '^[a-z0-9-]+\\.sharepoint\\.com$';

// ─── Dateien ────────────────────────────────────────────────

export const rel = (p) => path.relative(ROOT, p) || p;
export const zufall = () => crypto.randomBytes(32).toString('hex');

function envLesen(datei) {
  const out = {};
  if (!existsSync(datei)) return out;
  for (const line of readFileSync(datei, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export function sicherSchreiben(datei, inhalt) {
  mkdirSync(path.dirname(datei), { recursive: true });
  if (path.dirname(datei) === SECRETS) chmodSync(SECRETS, 0o700);
  const tmp = `${datei}.${process.pid}.tmp`;
  writeFileSync(tmp, inhalt, { mode: 0o600 });
  renameSync(tmp, datei);
  chmodSync(datei, 0o600);
}

/** Setzt KEY=VALUE (alle Vorkommen), haengt Neues unten an, laesst den Rest der Datei stehen. */
export function envSchreiben(datei, werte) {
  const zeilen = existsSync(datei) ? readFileSync(datei, 'utf8').split('\n') : [];
  if (zeilen.length && zeilen[zeilen.length - 1] === '') zeilen.pop();
  const neu = new Map(Object.entries(werte));
  const erledigt = new Set();
  for (let i = 0; i < zeilen.length; i++) {
    const m = zeilen[i].match(/^\s*([A-Za-z0-9_]+)\s*=/);
    if (m && neu.has(m[1])) {
      zeilen[i] = `${m[1]}=${neu.get(m[1])}`;
      erledigt.add(m[1]);
    }
  }
  const rest = [...neu].filter(([k]) => !erledigt.has(k));
  if (rest.length) {
    if (!zeilen.includes(KOPF)) zeilen.push(...(zeilen.length ? [''] : []), KOPF);
    for (const [k, v] of rest) zeilen.push(`${k}=${v}`);
  }
  sicherSchreiben(datei, `${zeilen.join('\n')}\n`);
}

export const env = () => ({ live: envLesen(DATEI.live) });

export function zertInfo() {
  if (!existsSync(KEY_FILE) || !existsSync(CRT_FILE)) return null;
  try {
    const x = new crypto.X509Certificate(readFileSync(CRT_FILE));
    return { pfad: rel(CRT_FILE), ablauf: new Date(x.validTo).toISOString(), fingerabdruck: x.fingerprint.replace(/:/g, '') };
  } catch (err) {
    return { pfad: rel(CRT_FILE), fehler: err.message };
  }
}

export function hakenLesen() {
  try {
    return JSON.parse(readFileSync(HAKEN_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// ─── Was eingetragen wird ───────────────────────────────────

const host = (e) => e.live.SP_TENANT_HOST || 'netorg12915005.sharepoint.com';
const adminHost = (e) => host(e).replace(/\.sharepoint\.com$/, '-admin.sharepoint.com');
const projektRef = (url) => (String(url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
const supabase = (url, pfad) => (projektRef(url)
  ? `https://supabase.com/dashboard/project/${projektRef(url)}/${pfad}`
  : 'https://supabase.com/dashboard/projects');
const entraApp = (e, blade) => (e.live.MS_CLIENT_ID
  ? `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/${blade}/appId/${e.live.MS_CLIENT_ID}`
  : 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade');

const FORMAT = {
  [GUID]: 'GUID wie 1a2b3c4d-1a2b-1a2b-1a2b-1a2b3c4d5e6f',
  [SUPA_KEY]: 'eyJ… (JWT) oder sb_secret_…',
  [SITE_URL]: 'https://<tenant>.sharepoint.com/sites/<Name>',
  [OHNE_LEER]: 'ohne Leerzeichen',
  [SP_HOST]: '<name>.sharepoint.com',
};

// Reihenfolge je Gruppe: f: Feld, h: Schritt ohne Eingabe, a: Aktion, x: Infokasten
const GRUPPEN = [
  {
    id: 'm365', titel: 'Microsoft 365 und Entra-App', datei: 'live', wizard: 'Wizard 1 und 2',
    ablauf: ['h:admin', 'f:live:MS_TENANT_ID', 'f:live:SP_TENANT_HOST', 'h:anyone', 'f:live:MS_CLIENT_ID', 'a:zertifikat', 'x:zertifikat', 'h:zert_hochgeladen', 'h:api_rechte'],
  },
  {
    id: 'sites', titel: 'SharePoint-Sites', datei: 'live', wizard: 'Wizard 2',
    ablauf: ['f:live:SP_SITE_URL', 'f:live:SP_TEST_SITE_URL', 'h:speicher', 'h:sites_freigegeben', 'a:site_test', 'f:live:SP_TEST_SITE_ID', 'f:live:SP_TEST_DRIVE_ID', 'a:site_live', 'f:live:SP_SITE_ID', 'f:live:SP_DRIVE_ID'],
  },
  {
    id: 'live', titel: 'Vault im bestehenden Supabase', datei: 'live', wizard: 'Wizard 2',
    ablauf: ['f:live:SUPABASE_SERVICE_ROLE_KEY', 'h:migrationen_live', 'a:vault_live', 'h:vault_live'],
  },
  {
    id: 'netlify', titel: 'Netlify-Variablen', datei: null, wizard: 'Wizard 2',
    ablauf: ['a:netlify_dateien', 'x:netlify', 'h:netlify_live'],
  },
];

const F = (datei, gruppe, key, label, wo, extra = {}) => ({ datei, gruppe, key, label, wo, ...extra });

const FELDER = [
  F('live', 'm365', 'MS_TENANT_ID', 'Tenant-ID', 'Entra Admin Center → Übersicht → „Mandanten-ID“.',
    { link: () => 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/TenantOverview.ReactView', muster: GUID }),
  F('live', 'm365', 'SP_TENANT_HOST', 'SharePoint-Host', 'Steht in jeder SharePoint-Adresse eures Tenants.',
    { standard: () => 'netorg12915005.sharepoint.com', muster: SP_HOST }),
  F('live', 'm365', 'MS_CLIENT_ID', 'Client-ID der App',
    'Entra → App-Registrierungen → „Neue Registrierung“: Name „CRM Medienablage“, nur dieses Verzeichnis, keine Umleitungs-URI → Übersicht → „Anwendungs-ID (Client)“.',
    { link: () => 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', muster: GUID }),

  F('live', 'sites', 'SP_SITE_URL', 'Adresse der Live-Site',
    'SharePoint Admin Center → Aktive Websites → erst „Medienablage“ suchen (gibt es sie schon, nur die Adresse übernehmen) → sonst Erstellen → „Kommunikationswebsite“ (keine Microsoft 365-Gruppe, sonst sehen Gruppenmitglieder alles), Name „Medienablage“. Die bestehenden Kunden-Sites (… x CreatorJobs, … x LikeGroup) und die Stamm-Site bleiben, wie sie sind: Die App bekommt nur auf die zwei Medienablage-Sites Zugriff.',
    { link: (e) => `https://${adminHost(e)}/_layouts/15/online/AdminHome.aspx#/siteManagement`, standard: (e) => `https://${host(e)}/sites/Medienablage`, muster: SITE_URL }),
  F('live', 'sites', 'SP_TEST_SITE_URL', 'Adresse der Test-Site', 'Dasselbe noch einmal als „Medienablage-Test“.',
    { link: (e) => `https://${adminHost(e)}/_layouts/15/online/AdminHome.aspx#/siteManagement`, standard: (e) => `https://${host(e)}/sites/Medienablage-Test`, muster: SITE_URL }),
  F('live', 'sites', 'SP_TEST_SITE_ID', 'Site-ID Test', 'Füllt der Knopf „Test-Site einrichten“ unten. Von Hand: Graph Explorer, GET /sites/{host}:/sites/Medienablage-Test?$select=id.', { muster: OHNE_LEER }),
  F('live', 'sites', 'SP_TEST_DRIVE_ID', 'Drive-ID Test (Bibliothek „Daten“)', 'Füllt derselbe Knopf. Von Hand: GET /sites/{site-id}/drives, Eintrag „Daten“ (früher „Videos“).', { muster: OHNE_LEER }),
  F('live', 'sites', 'SP_SITE_ID', 'Site-ID Live', 'Füllt der Knopf „Live-Site einrichten“.', { muster: OHNE_LEER }),
  F('live', 'sites', 'SP_DRIVE_ID', 'Drive-ID Live (Bibliothek „Daten“)', 'Füllt derselbe Knopf.', { muster: OHNE_LEER }),

  F('live', 'live', 'SUPABASE_SERVICE_ROLE_KEY', 'service_role-Key (bestehendes Projekt)',
    'Nicht neu erzeugen und kein neues Projekt. Supabase → das aktuelle Production-Projekt → Project Settings → API Keys → „service_role“ anzeigen und hier einfügen. URL und anon-Key stehen schon in .env. Der Key wird nur gebraucht, um das Zertifikat in den Vault zu schreiben.',
    { link: (e) => supabase(e.live.VITE_SUPABASE_URL, 'settings/api-keys'), geheim: true, muster: SUPA_KEY }),
].map((f) => ({ ...f, id: `${f.datei}:${f.key}` }));

export const FELD = new Map(FELDER.map((f) => [f.id, f]));

const H = (gruppe, id, text, extra = {}) => ({ gruppe, id, text, ...extra });
const HAKEN = [
  H('m365', 'admin', () => 'Du bist Globaler Administrator und landest im Microsoft 365 Admin Center, nicht bei GoDaddy.',
    { link: () => 'https://admin.microsoft.com/Adminportal/Home#/users' }),
  H('m365', 'anyone', () => 'SharePoint Admin Center → Richtlinien → Freigabe: „Jeder“ wählbar, Ablauf höchstens 30 Tage, Berechtigung „Anzeigen“.',
    { link: (e) => `https://${adminHost(e)}/_layouts/15/online/AdminHome.aspx#/sharing` }),
  H('m365', 'zert_hochgeladen', () => 'Zertifikat .secrets/medienablage-app.crt in der App hochgeladen (Zertifikate und Geheimnisse → Zertifikate → Hochladen). Der Fingerabdruck in Entra muss dem unten entsprechen. Kein Client Secret anlegen.',
    { link: (e) => entraApp(e, 'Credentials') }),
  H('m365', 'api_rechte', () => 'API-Berechtigungen: Microsoft Graph → Anwendungsberechtigungen → Sites.Selected, SharePoint → Anwendungsberechtigungen → Sites.Selected, dann „Administratorzustimmung erteilen“. Beide Zeilen grün.',
    { link: (e) => entraApp(e, 'CallAnAPI') }),
  H('sites', 'speicher', () => 'Speicher geprüft: Aktive Websites zeigt oben rechts den Speicher des ganzen Tenants, alle Sites teilen ihn. Der Dropbox-Bestand (Videos, Storys, Bilder, Rohmaterial) muss mit Luft hineinpassen, sonst bricht der Umzug mitten drin ab. Mehr Speicher: Microsoft 365 Admin Center → Marketplace → „Office 365 Extra File Storage“.',
    { link: (e) => `https://${adminHost(e)}/_layouts/15/online/AdminHome.aspx#/siteManagement` }),
  H('sites', 'sites_freigegeben', (e) => `App für beide Sites freigeben: Graph Explorer als Admin, „Berechtigungen ändern“ → Sites.FullControl.All. Je Site GET https://graph.microsoft.com/v1.0/sites/${host(e)}:/sites/<Name>?$select=id, dann POST /sites/{id}/permissions mit dem Body unten, dann PATCH /sites/{id}/permissions/{permission-id} mit {"roles":["fullcontrol"]}.`,
    {
      link: () => 'https://developer.microsoft.com/de-de/graph/graph-explorer',
      code: (e) => JSON.stringify({ roles: ['write'], grantedToIdentities: [{ application: { id: e.live.MS_CLIENT_ID || '<Client-ID>', displayName: 'CRM Medienablage' } }] }),
    }),
  H('live', 'migrationen_live', () => 'Migration 20261201_medienablage.sql auf dem bestehenden Production-Projekt angewendet. Erst danach kann der Vault den Schlüssel aufnehmen.'),
  H('live', 'vault_live', () => 'Zertifikat im Vault des bestehenden Projekts (Knopf unten meldet „ok“).'),
  H('netlify', 'netlify_live', () => 'Live-Site → Site configuration → Environment variables → „Import from a .env file“ → Inhalt der Datei eingefügt. ABLAGE_ZIEL NICHT setzen. Vorhandene Variablen (Supabase, Dropbox) nicht überschreiben.',
    { link: () => 'https://app.netlify.com/' }),
];
export const HAKEN_IDS = new Set(HAKEN.map((h) => h.id));

export const AKTIONEN = {
  zertifikat: {
    gruppe: 'm365', label: 'Zertifikat erzeugen',
    text: 'RSA 2048, 2 Jahre gültig, Schlüssel und Zertifikat in .secrets/. Danach die .crt in der App hochladen. Ein vorhandenes Zertifikat bleibt.',
    braucht: [],
  },
  site_test: {
    gruppe: 'sites', label: 'Test-Site einrichten und IDs übernehmen',
    text: 'Legt in der Test-Site die Bibliothek „Daten“ an bzw. benennt „Videos“ um (Versionslimit 5) und die Stufe „Bearbeiten ohne Löschen“, liest Site- und Drive-ID. Mehrfach ausführbar. Braucht die Freigabe aus dem Schritt oben.',
    braucht: ['live:MS_TENANT_ID', 'live:MS_CLIENT_ID', 'live:SP_TEST_SITE_URL', 'zertifikat'],
  },
  site_live: {
    gruppe: 'sites', label: 'Live-Site einrichten und IDs übernehmen', text: 'Dasselbe für die Live-Site.',
    braucht: ['live:MS_TENANT_ID', 'live:MS_CLIENT_ID', 'live:SP_SITE_URL', 'zertifikat'],
  },
  vault_live: {
    gruppe: 'live', label: 'Zertifikat in den Vault',
    text: 'Schreibt Schlüssel und Zertifikat in den Vault des bestehenden Production-Projekts und liest zur Kontrolle zurück. Erst nach Migration 20261201.',
    braucht: ['live:SUPABASE_SERVICE_ROLE_KEY', 'zertifikat'],
  },
  netlify_dateien: {
    gruppe: 'netlify', label: 'Import-Datei erzeugen',
    text: 'Baut aus den Werten oben die Datei für „Import from a .env file“ auf der Live-Site. ABLAGE_SECRET und SP_WEBHOOK_CLIENT_STATE werden einmal erzeugt und gespeichert, damit sie bei jedem Lauf gleich bleiben. Supabase- und Dropbox-Variablen stehen da nicht drin.',
    braucht: [],
  },
};

const labelVon = (id) => (id === 'zertifikat' ? 'Zertifikat' : FELD.get(id)?.label || id);

export function stand() {
  const e = env();
  const z = zertInfo();
  const haken = hakenLesen();
  const istGesetzt = (id) => (id === 'zertifikat' ? !!z && !z.fehler : !!e[FELD.get(id).datei][FELD.get(id).key]);
  return {
    pfade: { live: rel(DATEI.live), secrets: rel(SECRETS) },
    gruppen: GRUPPEN.map((g) => ({ ...g, dateiPfad: g.datei ? rel(DATEI[g.datei]) : rel(SECRETS) })),
    felder: FELDER.map((f) => {
      const v = e[f.datei][f.key] || '';
      return {
        id: f.id, key: f.key, datei: f.datei, gruppe: f.gruppe, label: f.label, wo: f.wo,
        geheim: !!f.geheim, optional: !!f.optional, muster: f.muster || null, format: FORMAT[f.muster] || null,
        link: f.link?.(e) || null, standard: f.standard?.(e) || '',
        gesetzt: !!v, wert: f.geheim ? '' : v, ende: f.geheim && v ? v.slice(-4) : '',
      };
    }),
    haken: HAKEN.map((h) => ({ id: h.id, gruppe: h.gruppe, text: h.text(e), link: h.link?.(e) || null, code: h.code?.(e) || null, an: !!haken[h.id] })),
    aktionen: Object.entries(AKTIONEN).map(([id, a]) => ({
      id, gruppe: a.gruppe, label: a.label, text: a.text, eingabe: a.eingabe || null,
      link: a.link?.(e) || null, fehlt: a.braucht.filter((b) => !istGesetzt(b)).map(labelVon),
    })),
    zertifikat: z,
    erzeugt: {
      live: ['ABLAGE_SECRET', 'SP_WEBHOOK_CLIENT_STATE'].filter((k) => e.live[k]),
    },
    netlify: { live: existsSync(NETLIFY.live) ? rel(NETLIFY.live) : null },
  };
}
