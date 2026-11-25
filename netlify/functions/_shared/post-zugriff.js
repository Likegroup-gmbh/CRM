// _shared/post-zugriff.js
// Zugriff der Post-Functions (post-link-abruf, post-screenshot-background) auf kooperation_post.
// Wer abrufen oder lesen lassen darf, entscheidet RLS: der Post wird mit dem JWT des Aufrufers
// gelesen, ihn sieht also nur das Team im eigenen Bereich (Agent, Kunde, Gast nicht). Geschrieben
// wird danach mit service_role, damit ein langer KI-Lauf nicht am Ablauf des Tokens hängt.

const { createClient } = require('@supabase/supabase-js');

const TABELLE = 'kooperation_post';

// Gleich zu POST_SELECT in src/modules/auswertung/auswertungPostsDaten.js (auswertungKonfigSync.test.js)
const POST_SPALTEN = [
  'id', 'kampagne_id', 'produktion_id', 'kooperation_id', 'video_id', 'story_id', 'still_id',
  'video_asset_id', 'story_asset_id', 'plattform', 'account_handle', 'link', 'posted_at', 'measured_at',
  'metrics', 'confidence', 'source', 'status', 'ki_status', 'ki_fehler', 'ki_schritt', 'ki_gestartet_at',
  'screenshot_pfade', 'created_at', 'updated_at', 'confirmed_by', 'confirmed_at'
].join(', ');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OHNE_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

function env() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

function bearer(event) {
  const h = event?.headers || {};
  return String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function callerClient(jwt) {
  const { url, anon } = env();
  if (!url || !anon || !jwt) return null;
  return createClient(url, anon, { ...OHNE_SESSION, global: { headers: { Authorization: `Bearer ${jwt}` } } });
}

let service = null;
function serviceClient() {
  const { url, service: key } = env();
  if (!url || !key) return null;
  if (!service) service = createClient(url, key, OHNE_SESSION);
  return service;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

/** postId aus dem Body, null wenn sie fehlt oder keine UUID ist. */
function postIdAus(event) {
  try {
    const id = JSON.parse(event?.body || '{}').postId;
    return UUID.test(String(id || '')) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Post unter RLS des Aufrufers lesen, mit api_raw (der Client liest es nicht).
 * @returns {Promise<{ post: object } | { response: object }>}
 */
async function liesPostAlsAufrufer(caller, postId) {
  const { data, error } = await caller.from(TABELLE).select(`${POST_SPALTEN}, api_raw`).eq('id', postId).maybeSingle();
  if (error) {
    if (error.code === 'PGRST301') return { response: json(401, { error: 'Sitzung abgelaufen', session_dead: true }) };
    console.error('[post-zugriff] Post nicht lesbar:', error.message);
    return { response: json(500, { error: 'Post nicht lesbar' }) };
  }
  if (!data) return { response: json(404, { error: 'Post nicht gefunden' }) };
  return { post: data };
}

module.exports = {
  TABELLE,
  POST_SPALTEN,
  bearer,
  callerClient,
  serviceClient,
  json,
  postIdAus,
  liesPostAlsAufrufer
};
