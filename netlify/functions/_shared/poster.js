// poster.js
// Gemeinsame Bausteine der Poster-Functions (ADR 0064): Bucket, Service-Client und das
// Anstossen von poster-erzeugen-background aus poster-urls (Read-Repair) und poster-abgleich.
//
// Das Anstossen ist durch ein Secret geschuetzt. Ohne POSTER_SECRET wird es aus dem
// Service-Key abgeleitet: beide Seiten kennen ihn, uebertragen wird nur der Hash.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'video-posters';
const ERZEUGEN_PFAD = '/.netlify/functions/poster-erzeugen-background';
const SECRET_HEADER = 'x-poster-secret';

function supabaseEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function serviceClient() {
  const { url, service } = supabaseEnv();
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

function posterSecret() {
  if (process.env.POSTER_SECRET) return process.env.POSTER_SECRET;
  const { service } = supabaseEnv();
  return service ? crypto.createHash('sha256').update(`poster-erzeugen:${service}`).digest('hex') : '';
}

function secretOk(event) {
  const expected = posterSecret();
  const given = String((event?.headers || {})[SECRET_HEADER] || '');
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Basis-URL der eigenen Deployment-Umgebung (wie strategie-item-background). */
function siteUrl(event) {
  const fromEnv = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = (event?.headers || {}).host;
  return host ? `https://${host}` : null;
}

/**
 * Stoesst poster-erzeugen-background an. Background Functions antworten sofort mit 202,
 * das Warten kostet also nur den Roundtrip. Fehler werden geschluckt: der naechste
 * Abgleich holt alles nach.
 * @returns {Promise<boolean>}
 */
async function erzeugungAnstossen(event, { fetchImpl = (...a) => fetch(...a), timeoutMs = 3000 } = {}) {
  const base = siteUrl(event);
  const secret = posterSecret();
  if (!base || !secret) return false;
  try {
    const resp = await fetchImpl(`${base}${ERZEUGEN_PFAD}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SECRET_HEADER]: secret },
      body: '{}',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return resp.ok;
  } catch (err) {
    console.warn('[poster] Anstossen fehlgeschlagen:', err.message);
    return false;
  }
}

module.exports = {
  BUCKET,
  SECRET_HEADER,
  supabaseEnv,
  serviceClient,
  posterSecret,
  secretOk,
  siteUrl,
  erzeugungAnstossen,
};
