// eingabe.mjs
// Lokale Eingabeseite fuer den SharePoint-Video-Upload: nur die Werte, die dafuer neu
// dazukommen. Schreibt nach .env (gitignored, Modus 600), erzeugt Zertifikat und die
// Netlify-Importdatei in .secrets/. URL und anon-Key des bestehenden Supabase bleiben unangetastet.
// Lauscht nur auf 127.0.0.1; jede API-Anfrage braucht das Einmal-Token aus der Start-URL.
// Felder, Schritte, Dateizugriff und Stand: eingabe-stand.mjs.
//
// Aufruf: node scripts/medienablage/eingabe.mjs [--port 4719] [--root <Repo>] [--kein-browser]

import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import {
  HIER, args, ROOT, DATEI, SECRETS, KEY_FILE, CRT_FILE, HAKEN_FILE, NETLIFY,
  rel, zufall, sicherSchreiben, envSchreiben, env, zertInfo, hakenLesen,
  FELD, HAKEN_IDS, AKTIONEN, stand,
} from './eingabe-stand.mjs';

const LEERLAUF_MS = 60 * 60 * 1000;
const TOKEN = crypto.randomBytes(24).toString('base64url');

// ─── Aenderungen ────────────────────────────────────────────

function speichern(werte) {
  const fehler = {};
  const je = { live: {} };
  for (const [id, roh] of Object.entries(werte || {})) {
    const f = FELD.get(id);
    if (!f) {
      fehler[id] = 'Unbekanntes Feld';
      continue;
    }
    const v = String(roh ?? '').trim();
    if (!v) continue;
    if (/[\r\n]/.test(v) || v.length > 4096) fehler[id] = 'Ungültiger Wert';
    else if (f.muster && !new RegExp(f.muster).test(v)) fehler[id] = 'Format passt nicht';
    else je[f.datei][f.key] = v;
  }
  if (Object.keys(fehler).length) return { ok: false, fehler };
  let n = 0;
  for (const datei of ['live']) {
    if (!Object.keys(je[datei]).length) continue;
    envSchreiben(DATEI[datei], je[datei]);
    n += Object.keys(je[datei]).length;
  }
  return { ok: true, gespeichert: n };
}

function skript(name, argv) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(HIER, name), ...argv], { cwd: ROOT, timeout: 180000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
      const log = [String(stderr || '').trim(), err && !stderr ? err.message : ''].filter(Boolean).join('\n');
      resolve({ ok: !err, stdout: String(stdout || ''), log });
    });
  });
}

function openssl(argv) {
  return new Promise((resolve) => {
    execFile('openssl', argv, { timeout: 60000 }, (err, _out, stderr) => resolve({ ok: !err, log: String(stderr || err?.message || '').trim() }));
  });
}

async function zertifikatErzeugen() {
  if (zertInfo()) return { ok: true, log: 'Zertifikat existiert schon und bleibt unverändert.' };
  mkdirSync(SECRETS, { recursive: true });
  chmodSync(SECRETS, 0o700);
  const r = await openssl(['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '730', '-nodes',
    '-subj', '/CN=CRM Medienablage', '-keyout', KEY_FILE, '-out', CRT_FILE]);
  if (!r.ok) return { ok: false, log: `openssl: ${r.log}` };
  chmodSync(KEY_FILE, 0o600);
  return { ok: true, log: `Angelegt: ${rel(KEY_FILE)} und ${rel(CRT_FILE)}. Jetzt die .crt in Entra hochladen.` };
}

async function siteEinrichten(welche) {
  const { live } = env();
  const url = welche === 'test' ? live.SP_TEST_SITE_URL : live.SP_SITE_URL;
  const prefix = welche === 'test' ? 'SP_TEST_' : 'SP_';
  const r = await skript('site-einrichten.mjs', ['--site', url, '--env-prefix', prefix, '--env', DATEI.live, '--key', KEY_FILE, '--cert', CRT_FILE]);
  const ids = {};
  for (const line of r.stdout.split('\n')) {
    const m = line.match(/^(SP_(?:TEST_)?(?:SITE|DRIVE)_ID)=(\S+)$/);
    if (m) ids[m[1]] = m[2];
  }
  if (Object.keys(ids).length) envSchreiben(DATEI.live, ids);
  return { ok: r.ok && Object.keys(ids).length === 2, log: [r.log, ...Object.entries(ids).map(([k, v]) => `${k}=${v}`)].filter(Boolean).join('\n') };
}

async function vault(ziel) {
  const r = await skript('vault-setzen.mjs', ['--env', DATEI[ziel], '--key', KEY_FILE, '--cert', CRT_FILE]);
  if (r.ok) {
    const h = hakenLesen();
    h[`vault_${ziel}`] = true;
    sicherSchreiben(HAKEN_FILE, JSON.stringify(h, null, 2));
  }
  return { ok: r.ok, log: [r.stdout.trim(), r.log].filter(Boolean).join('\n') };
}

function importDatei(datei, werte) {
  sicherSchreiben(datei, Object.entries(werte).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}

function netlifyDateien() {
  const zeilen = [];
  let ok = true;
  const { live } = env();
  const fehltLive = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'SP_SITE_URL', 'SP_SITE_ID', 'SP_DRIVE_ID'].filter((k) => !live[k]);
  if (fehltLive.length) {
    ok = false;
    zeilen.push(`Live: fehlt noch ${fehltLive.map((k) => FELD.get(`live:${k}`)?.label || k).join(', ')}`);
  } else {
    const neu = {};
    for (const k of ['SP_WEBHOOK_CLIENT_STATE', 'ABLAGE_SECRET']) if (!live[k]) neu[k] = zufall();
    if (Object.keys(neu).length) envSchreiben(DATEI.live, neu);
    const l = { ...live, ...neu };
    importDatei(NETLIFY.live, {
      MS_TENANT_ID: l.MS_TENANT_ID, MS_CLIENT_ID: l.MS_CLIENT_ID,
      SP_SITE_URL: l.SP_SITE_URL, SP_SITE_ID: l.SP_SITE_ID, SP_DRIVE_ID: l.SP_DRIVE_ID,
      SP_WEBHOOK_CLIENT_STATE: l.SP_WEBHOOK_CLIENT_STATE, ABLAGE_SECRET: l.ABLAGE_SECRET,
      ABLAGE_UMZUG_PARALLEL: l.ABLAGE_UMZUG_PARALLEL || '2',
    });
    zeilen.push(`Live: ${rel(NETLIFY.live)} geschrieben.`);
  }
  return { ok, log: zeilen.join('\n') };
}

async function aktion(id, body) {
  const a = AKTIONEN[id];
  if (!a) return { ok: false, log: 'Unbekannte Aktion' };
  const fehlt = stand().aktionen.find((x) => x.id === id).fehlt;
  if (fehlt.length) return { ok: false, log: `Fehlt noch: ${fehlt.join(', ')}` };
  switch (id) {
    case 'zertifikat': return zertifikatErzeugen();
    case 'site_test': return siteEinrichten('test');
    case 'site_live': return siteEinrichten('live');
    case 'vault_live': return vault('live');
    case 'netlify_dateien': return netlifyDateien();
    default: return { ok: false, log: 'Unbekannte Aktion' };
  }
}

// ─── HTTP ───────────────────────────────────────────────────

let erlaubteHosts = new Set();
let letzte = Date.now();

function senden(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  });
  res.end(JSON.stringify(body));
}

function seite(res) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const html = readFileSync(path.join(HIER, 'eingabe.html'), 'utf8').replace(/__NONCE__/g, nonce);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  });
  res.end(html);
}

function tokenOk(wert) {
  const a = Buffer.from(String(wert || ''));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function lesen(req) {
  return new Promise((resolve, reject) => {
    let roh = '';
    req.on('data', (c) => {
      roh += c;
      if (roh.length > 64 * 1024) reject(new Error('zu gross'));
    });
    req.on('end', () => {
      try {
        resolve(roh ? JSON.parse(roh) : {});
      } catch {
        reject(new Error('kein JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  letzte = Date.now();
  // Schutz gegen DNS-Rebinding: nur Anfragen an genau diese Adresse
  if (!erlaubteHosts.has(req.headers.host)) return senden(res, 421, { fehler: 'Falscher Host' });
  const { pathname } = new URL(req.url, 'http://lokal');
  if (req.method === 'GET' && pathname === '/') return seite(res);
  if (!pathname.startsWith('/api/')) return senden(res, 404, { fehler: 'Nicht gefunden' });
  if (req.method !== 'POST') return senden(res, 405, { fehler: 'Nur POST' });
  if (!tokenOk(req.headers['x-eingabe-token'])) return senden(res, 401, { fehler: 'Token fehlt oder falsch. Seite über die URL aus dem Terminal öffnen.' });

  try {
    const body = await lesen(req);
    const was = pathname.slice(5);
    if (was === 'stand') return senden(res, 200, stand());
    if (was === 'speichern') {
      const r = speichern(body.werte);
      return senden(res, r.ok ? 200 : 400, { ...r, stand: stand() });
    }
    if (was === 'haken') {
      if (!HAKEN_IDS.has(body.id)) return senden(res, 400, { fehler: 'Unbekannter Schritt' });
      const h = hakenLesen();
      h[body.id] = !!body.an;
      sicherSchreiben(HAKEN_FILE, JSON.stringify(h, null, 2));
      return senden(res, 200, { ok: true, stand: stand() });
    }
    if (was === 'aktion') {
      const r = await aktion(body.id, body);
      return senden(res, 200, { ...r, stand: stand() });
    }
    if (was === 'netlify_inhalt') {
      const datei = NETLIFY[body.welche];
      if (!datei || !existsSync(datei)) return senden(res, 404, { fehler: 'Datei noch nicht erzeugt' });
      return senden(res, 200, { inhalt: readFileSync(datei, 'utf8') });
    }
    if (was === 'beenden') {
      senden(res, 200, { ok: true });
      console.log('Beendet über die Seite.');
      setTimeout(() => process.exit(0), 100);
      return undefined;
    }
    return senden(res, 404, { fehler: 'Unbekannt' });
  } catch (err) {
    console.error('[eingabe]', err.message);
    return senden(res, 500, { fehler: err.message });
  }
});

function oeffnen(url) {
  if (args['kein-browser']) return;
  const [cmd, argv] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  execFile(cmd, argv, () => {});
}

function starten(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port !== 0) return starten(0);
    console.error(err.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const p = server.address().port;
    erlaubteHosts = new Set([`127.0.0.1:${p}`, `localhost:${p}`]);
    const url = `http://127.0.0.1:${p}/#t=${TOKEN}`;
    console.log(`Medienablage · Eingaben\n  ${url}\n  Speichert nach ${rel(DATEI.live)} (in ${ROOT}).\n  Beenden: Ctrl-C oder Knopf auf der Seite. Nach 60 Minuten ohne Zugriff beendet sich der Server selbst.`);
    oeffnen(url);
  });
}

setInterval(() => {
  if (Date.now() - letzte > LEERLAUF_MS) {
    console.log('60 Minuten ohne Zugriff, beendet.');
    process.exit(0);
  }
}, 60000).unref();

starten(Number(args.port) || 4719);
