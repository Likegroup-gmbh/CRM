// Gemeinsame Bearer-Token-Pruefung fuer alle Netlify Functions.
//
// Wichtig: supabase.auth.getUser(token) fragt GoTrue nach der Session-Zeile,
// die zum session_id-Claim im JWT gehoert. Ein global ausgeloegter Logout
// (signOut ohne scope: 'local') loescht diese Zeile fuer ALLE Geraete. Der
// Token im Browser bleibt danach noch bis zum Ablauf signaturgueltig, RLS-
// Abfragen laufen also weiter - nur getUser() antwortet mit 403
// session_not_found. Damit dieser Zombie-Zustand nicht als anonymes
// "Nicht autorisiert" endet, gibt der Helper den Grund mit zurueck.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_KEY = SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

/** Meldungen, die direkt im UI landen duerfen */
const AUTH_MESSAGES = {
  no_token: 'Nicht angemeldet – bitte neu anmelden.',
  session_not_found: 'Sitzung abgelaufen – bitte neu anmelden.',
  bad_jwt: 'Sitzung ungültig – bitte neu anmelden.',
  session_expired: 'Sitzung abgelaufen – bitte neu anmelden.',
  config_missing: 'Serverkonfiguration unvollständig.'
};

/** Codes, bei denen der Client seine Session wegwerfen und neu anmelden soll */
const SESSION_DEAD_CODES = new Set(['no_token', 'session_not_found', 'session_expired', 'bad_jwt']);

let sharedClient = null;

function getFallbackClient() {
  if (!SUPABASE_URL || !AUTH_KEY) return null;
  if (!sharedClient) {
    sharedClient = createClient(SUPABASE_URL, AUTH_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return sharedClient;
}

/**
 * Bearer-Token aus dem Request pruefen.
 * @param {object} event Netlify-Function-Event
 * @param {object} [supabase] Vorhandener Service-Client; sonst wird einer aus der Env gebaut
 * @returns {Promise<{ user: object|null, code: string|null, error: string|null }>}
 */
async function verifyAuth(event, supabase) {
  const headers = (event && event.headers) || {};
  const authHeader = headers.authorization || headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    console.warn('[verifyAuth] Kein Bearer-Token im Request');
    return { user: null, code: 'no_token', error: 'Kein Token im Authorization-Header' };
  }

  const client = supabase || getFallbackClient();
  if (!client) {
    console.error('[verifyAuth] Supabase-Env fehlt (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
    return { user: null, code: 'config_missing', error: 'Supabase-Konfiguration fehlt' };
  }

  const { data, error } = await client.auth.getUser(token);
  const user = (data && data.user) || null;

  if (error || !user) {
    const code = (error && error.code) || 'invalid_token';
    const message = (error && error.message) || 'Kein Benutzer zum Token gefunden';
    console.warn(`[verifyAuth] Token abgelehnt (${code}, HTTP ${error?.status ?? '-'}): ${message}`);
    return { user: null, code, error: message };
  }

  return { user, code: null, error: null };
}

/**
 * Service-Role-Functions: nach verifyAuth intern-only ablehnen.
 * Sonst koennte ein Kunde mit offener Page den Service-Role-Bypass nutzen.
 */
async function requireInternal(supabase, authUser) {
  const { data: benutzer } = await supabase
    .from('benutzer')
    .select('id, rolle')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!benutzer || !['admin', 'mitarbeiter'].includes(benutzer.rolle)) {
    return {
      ok: false,
      benutzer,
      response: {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Nur interne Mitarbeiter' })
      }
    };
  }
  return { ok: true, benutzer };
}

/**
 * Response-Body fuer einen fehlgeschlagenen verifyAuth-Aufruf.
 * `code` und `session_dead` steuern im Client, ob refresh oder Logout folgt.
 */
function authErrorBody(result) {
  const code = (result && result.code) || 'invalid_token';
  return {
    error: AUTH_MESSAGES[code] || 'Nicht autorisiert',
    code,
    session_dead: SESSION_DEAD_CODES.has(code),
    detail: (result && result.error) || null
  };
}

module.exports = { verifyAuth, requireInternal, authErrorBody, AUTH_MESSAGES, SESSION_DEAD_CODES };
