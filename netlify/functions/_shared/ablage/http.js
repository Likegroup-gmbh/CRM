// _shared/ablage/http.js
// Huelle fuer die Ablage-Functions: Methode, Body, Service-Client, Aufrufer, Fehler -> JSON.

const { serviceClient, callerClient, bearer, parseBody, json } = require('./konfig');
const { aufrufer } = require('./zugriff');
const { ablageAusEnv } = require('./index');

class AblageFehler extends Error {
  constructor(status, message, code = null, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Signatur prueft PostgREST bei jeder Abfrage ueber caller; hier zaehlt nur der Claim
function istGastToken(event) {
  const token = bearer(event);
  if (!token) return false;
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
    return typeof claims.share_id === 'string' && claims.share_id !== '';
  } catch {
    return false;
  }
}

function fehlerAntwort(err, name) {
  if (err instanceof AblageFehler) {
    return json(err.status, { error: err.message, ...(err.code ? { code: err.code } : {}), ...err.extra });
  }
  // Graph-Drosselung/-Ausfall an den Client durchreichen, damit er spaeter erneut versucht
  if (err?.status === 429 || err?.status === 503) {
    return json(503, { error: 'SharePoint ist gerade ausgelastet, bitte gleich erneut versuchen', code: 'sharepoint_busy' },
      err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {});
  }
  console.error(`[${name}]`, err?.status || '', err?.code || '', err?.message || err);
  return json(500, { error: 'Interner Fehler' });
}

/**
 * @param {string} name Function-Name (Logs)
 * @param {(ctx:{event, body, supabase, ablage, benutzer, user, caller}) => Promise<object>} fn
 * @param {{ auth?: boolean|'optional' }} [opts] auth=false: kein JWT (Creator-Token, Webhook);
 *   'optional': Gast-JWTs haben kein Benutzerprofil, dann benutzer=null und nur RLS ueber caller
 */
function ablageHandler(name, fn, { auth = true } = {}) {
  return async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const body = parseBody(event);
    if (!body || typeof body !== 'object') return json(400, { error: 'Ungueltiger Request' });
    const supabase = serviceClient();
    if (!supabase) return json(500, { error: 'Serverkonfiguration unvollständig' });
    try {
      let wer = {};
      if (auth === 'optional') {
        const caller = callerClient(event);
        if (!caller) return json(401, { error: 'Nicht angemeldet' });
        wer = await aufrufer(event, supabase);
        if (!wer.ok) {
          // Nur echte Gast-Tokens ohne Profil; sonst ginge ein Auth-Ausfall als Gast durch
          if (!istGastToken(event)) return wer.antwort;
          wer = { benutzer: null, user: null, caller };
        }
      } else if (auth) {
        wer = await aufrufer(event, supabase);
        if (!wer.ok) return wer.antwort;
      }
      const ablage = ablageAusEnv({ supabase });
      const ergebnis = await fn({ event, body, supabase, ablage, benutzer: wer.benutzer, user: wer.user, caller: wer.caller });
      return json(200, ergebnis ?? { ok: true });
    } catch (err) {
      return fehlerAntwort(err, name);
    }
  };
}

module.exports = { AblageFehler, fehlerAntwort, ablageHandler, istGastToken };
