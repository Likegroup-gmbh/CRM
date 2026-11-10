// _shared/ablage/konfig.js
// Env, Service-Client, Secret fuer Selbstaufrufe, JSON-Antworten.
// Zertifikat und Schluessel liegen NICHT hier (Netlify-Env max. 4 KB), sondern im Vault (graph-auth.js).

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { dropboxUpload } = require('./schalter');

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

// Graph verlangt Vielfache von 320 KiB; 10 MiB = 32 x 320 KiB
const CHUNK_BYTES = 32 * 320 * 1024;

const MAX_BYTES = {
  video: 2 * GIB,
  story: 2 * GIB,
  still: 2 * GIB,
  roh: 20 * GIB,
};

const SECRET_HEADER = 'x-ablage-secret';

function supabaseEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

let _service = null;
function serviceClient() {
  const { url, service } = supabaseEnv();
  if (!url || !service) return null;
  if (!_service) {
    _service = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _service;
}

function bearer(event) {
  const h = event?.headers || {};
  const raw = h.authorization || h.Authorization || '';
  return raw.startsWith('Bearer ') ? raw.slice(7) : null;
}

// Client mit dem JWT des Aufrufers: Sichtbarkeit laeuft ueber RLS
function callerClient(event) {
  const { url, anon } = supabaseEnv();
  const token = bearer(event);
  if (!url || !anon || !token) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function sharePointKonfig(env = process.env) {
  const siteUrl = (env.SP_SITE_URL || '').replace(/\/+$/, '');
  let host = '';
  try { host = siteUrl ? new URL(siteUrl).host : ''; } catch { host = ''; }
  return {
    tenantId: env.MS_TENANT_ID || '',
    clientId: env.MS_CLIENT_ID || '',
    siteUrl,
    host,
    siteId: env.SP_SITE_ID || '',
    driveId: env.SP_DRIVE_ID || '',
    clientState: env.SP_WEBHOOK_CLIENT_STATE || '',
  };
}

// Schalter an: ablageAusEnv() ist ueberall null (Zeitplan, Background, Loeschkaskade, Poster)
function istKonfiguriert(k = sharePointKonfig()) {
  if (dropboxUpload()) return false;
  return !!(k.tenantId && k.clientId && k.siteUrl && k.host && k.siteId && k.driveId);
}

function ablageSecret() {
  if (process.env.ABLAGE_SECRET) return process.env.ABLAGE_SECRET;
  const { service } = supabaseEnv();
  return crypto.createHash('sha256').update(`ablage:${service || ''}`).digest('hex');
}

function secretOk(event) {
  const h = event?.headers || {};
  const got = Buffer.from(String(h[SECRET_HEADER] || h[SECRET_HEADER.toUpperCase()] || ''));
  const want = Buffer.from(ablageSecret());
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Fuer Selbstaufrufe: Branch-Deploys rufen ihre eigene Function, nicht Produktion
function siteUrl(event) {
  const env = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (env) return env.replace(/\/+$/, '');
  const host = event?.headers?.host || event?.headers?.Host;
  return host ? `https://${host}` : '';
}

// Webhook-Ziel: immer die stabile Produktions-URL der Site
function webhookUrl() {
  const base = (process.env.ABLAGE_WEBHOOK_URL || process.env.URL || '').replace(/\/+$/, '');
  return base ? `${base}/.netlify/functions/ablage-webhook` : '';
}

/** Stoesst eine (Background-)Function an; Fehler werden geschluckt, der Zeitplan holt nach. */
async function anstossen(event, name, body = {}, { fetchImpl = (...a) => fetch(...a), timeoutMs = 3000 } = {}) {
  const base = siteUrl(event);
  if (!base) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(`${base}/.netlify/functions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SECRET_HEADER]: ablageSecret() },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return resp.ok || resp.status === 202;
  } catch (err) {
    console.warn(`[ablage] ${name} anstossen fehlgeschlagen:`, err.message || err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try {
    return JSON.parse(event?.body || '{}');
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const istUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

module.exports = {
  MIB,
  GIB,
  CHUNK_BYTES,
  MAX_BYTES,
  SECRET_HEADER,
  supabaseEnv,
  serviceClient,
  callerClient,
  bearer,
  sharePointKonfig,
  istKonfiguriert,
  ablageSecret,
  secretOk,
  siteUrl,
  webhookUrl,
  anstossen,
  json,
  parseBody,
  istUuid,
};
