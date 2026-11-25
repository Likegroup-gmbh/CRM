// Lokaler Ersatz für `netlify functions:serve`.
// Die CLI ist keine Projekt-Abhängigkeit und auf dieser Maschine nicht im PATH.
// Vite proxyt /.netlify/functions hierher. Background-Functions antworten sofort
// mit 202 und laufen danach weiter, wie auf Netlify.

import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUNKTIONEN = join(ROOT, 'netlify', 'functions');
const PORT = Number(process.env.FUNCTIONS_PORT || 9999);
const BODY_MAX = 20 * 1024 * 1024;

function ladeEnv(datei) {
  const pfad = join(ROOT, datei);
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
    const text = zeile.trim();
    if (!text || text.startsWith('#')) continue;
    const gleich = text.indexOf('=');
    if (gleich < 1) continue;
    const key = text.slice(0, gleich).trim();
    let wert = text.slice(gleich + 1).trim();
    if ((wert.startsWith('"') && wert.endsWith('"')) || (wert.startsWith("'") && wert.endsWith("'"))) {
      wert = wert.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = wert;
  }
}

ladeEnv('.env');
ladeEnv('.env.local');

function alias(ziel, ...quellen) {
  if (process.env[ziel]) return;
  for (const name of quellen) {
    if (process.env[name]) {
      process.env[ziel] = process.env[name];
      return;
    }
  }
}

alias('SUPABASE_URL', 'VITE_SUPABASE_URL');
alias('SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');

const fehlend = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ANTHROPIC_API_KEY']
  .filter((name) => !process.env[name]);
if (fehlend.length) {
  console.error(`[functions] Fehlende Env: ${fehlend.join(', ')}. Die Function bricht dann nach dem 202 ab.`);
}

function funktionName(url) {
  const pfad = String(url || '').split('?')[0];
  const treffer = pfad.match(/^\/(?:\.netlify\/functions\/)?([a-z0-9-]+)$/i);
  return treffer ? treffer[1] : null;
}

function leseBody(req) {
  return new Promise((resolve, reject) => {
    const teile = [];
    let groesse = 0;
    req.on('data', (chunk) => {
      groesse += chunk.length;
      if (groesse > BODY_MAX) {
        reject(Object.assign(new Error('Body zu gross'), { status: 413 }));
        req.destroy();
        return;
      }
      teile.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(teile).toString('utf8')));
    req.on('error', reject);
  });
}

function sende(res, status, body, headers = {}) {
  if (res.headersSent || res.writableEnded) return;
  const text = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(text);
}

async function rufeAuf(name, event) {
  const datei = join(FUNKTIONEN, `${name}.js`);
  if (!existsSync(datei)) return { statusCode: 404, body: 'Function nicht gefunden' };
  const mod = require(datei);
  if (typeof mod.handler !== 'function') return { statusCode: 500, body: 'Function ohne handler' };
  return mod.handler(event);
}

async function onRequest(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    sende(res, 200, { ok: true });
    return;
  }
  const name = funktionName(req.url);
  if (!name || req.method !== 'POST') {
    sende(res, 404, { fehler: 'Keine Function' });
    return;
  }

  let body = '';
  try {
    body = await leseBody(req);
  } catch (err) {
    sende(res, err.status || 400, { fehler: err.message });
    return;
  }

  const event = {
    httpMethod: 'POST',
    path: req.url,
    headers: req.headers,
    body,
    isBase64Encoded: false
  };
  const background = name.endsWith('-background');

  if (background) {
    sende(res, 202, '');
    rufeAuf(name, event).then((antwort) => {
      if (antwort?.statusCode && antwort.statusCode >= 400) {
        console.error(`[functions] ${name} ${antwort.statusCode}`, String(antwort.body || '').slice(0, 300));
      }
    }).catch((err) => {
      console.error(`[functions] ${name} abgebrochen:`, err?.message || err);
    });
    return;
  }

  try {
    const antwort = await rufeAuf(name, event) || { statusCode: 200, body: '' };
    sende(res, antwort.statusCode || 200, antwort.body || '', antwort.headers || {});
  } catch (err) {
    console.error(`[functions] ${name}:`, err?.message || err);
    sende(res, 500, { fehler: err?.message || 'Function-Fehler' });
  }
}

function hoere(host) {
  const server = http.createServer(onRequest);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[functions] Port ${PORT} auf ${host} ist belegt.`);
      process.exit(1);
    }
    if (host === '::1') return;
    console.error(`[functions] ${host}:`, err.message);
  });
  server.listen(PORT, host, () => {
    console.log(`[functions] ${host}:${PORT}`);
  });
}

hoere('127.0.0.1');
hoere('::1');
