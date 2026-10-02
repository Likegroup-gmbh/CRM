// Netlify Function: stakeholder-dashboard
// Das Investor-Dashboard rechnet hier statt im Browser. Der Browser bekommt
// je Auftrag eine fertig gerechnete Zeile plus die Monatsauswertung (Hundert-
// KB-Bereich) statt der 2 MB Rohzeilen von stakeholder_finanzbestand().
//
// GET/POST, Auth: Supabase Bearer-Token.
//   -> Die Rolle (Admin/Investor) prueft die RPC selbst: die Function ruft sie
//      mit dem JWT des Aufrufers auf, nicht mit dem Service-Key. Kein Token,
//      kein Zugriff; keine zweite Rechtelogik.
//   -> Gerechnet wird mit denselben reinen Modulen wie im Browser-Fallback
//      (src/modules/stakeholder/daten/stakeholderDashboard.js, ADR 0006/0007).
//   -> Kein Cache (Frische-Vertrag): jede Antwort ist der Stand von jetzt.
//
// Antworten: 200 { version, geladenAm, zeilen, ... }
//            401 { error, code, session_dead }   Token fehlt/ungueltig
//            403 { error, code: 'forbidden' }    Rolle darf das Dashboard nicht
//            501 { error, code: 'rpc_missing' }  Migration fehlt (Client faellt zurueck)
//            502 { error, code: 'bestand_fehler' }

const { createClient } = require('@supabase/supabase-js');
const { authErrorBody } = require('./_shared/verify-auth');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const HEADERS = {
  'Content-Type': 'application/json',
  // Frische-Vertrag: Finanzzahlen werden nie gecacht, auch nicht im CDN.
  'Cache-Control': 'no-store',
};

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function bearerToken(event) {
  const headers = (event && event.headers) || {};
  const raw = headers.authorization || headers.Authorization || '';
  return raw.replace(/^Bearer\s+/i, '').trim();
}

function isMissingRpc(error) {
  const code = error && error.code;
  if (code === 'PGRST202' || code === '42883') return true;
  const message = String((error && error.message) || '');
  return /could not find the function/i.test(message)
    || /function .* does not exist/i.test(message);
}

function isJwtError(error) {
  if (!error) return false;
  if (error.status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') return true;
  return /jwt/i.test(String(error.message || ''));
}

// Beides erst beim Aufruf laden: im Test ersetzbar, und die ESM-Module aus
// src/ werden von esbuild beim Deploy ins Function-Bundle gezogen.
async function ladeRechenkern() {
  const [{ berechneDashboard }, { dropTestunternehmenBestand }] = await Promise.all([
    import('../../src/modules/stakeholder/daten/stakeholderDashboard.js'),
    import('../../src/core/budget/testunternehmen.js'),
  ]);
  return { berechneDashboard, dropTestunternehmenBestand };
}

function createHandler({
  createSupabase = createClient,
  rechenkern = ladeRechenkern,
  jetzt = () => Date.now(),
  env = () => ({ url: SUPABASE_URL, key: ANON_KEY || SERVICE_KEY }),
} = {}) {
  return async function handler(event) {
    if (event.httpMethod && !['GET', 'POST'].includes(event.httpMethod)) {
      return jsonResponse(405, { error: 'Methode nicht erlaubt' });
    }

    const token = bearerToken(event);
    if (!token) {
      return jsonResponse(401, authErrorBody({ code: 'no_token' }));
    }

    const { url, key } = env();
    if (!url || !key) {
      console.error('[stakeholder-dashboard] Supabase-Env fehlt');
      return jsonResponse(500, authErrorBody({ code: 'config_missing' }));
    }

    const supabase = createSupabase(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const t0 = jetzt();
    const { data, error } = await supabase.rpc('stakeholder_finanzbestand');
    const tRpc = jetzt();

    if (error) {
      if (error.code === '42501') {
        return jsonResponse(403, { error: 'Kein Zugriff auf das Dashboard.', code: 'forbidden' });
      }
      if (isMissingRpc(error)) {
        return jsonResponse(501, { error: 'stakeholder_finanzbestand fehlt.', code: 'rpc_missing' });
      }
      if (isJwtError(error)) {
        return jsonResponse(401, authErrorBody({ code: 'bad_jwt', error: error.message }));
      }
      console.error('[stakeholder-dashboard] RPC-Fehler', error);
      return jsonResponse(502, {
        error: 'Finanzbestand konnte nicht geladen werden.',
        code: 'bestand_fehler',
      });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonResponse(502, {
        error: 'Finanzbestand-RPC lieferte kein Objekt.',
        code: 'bestand_fehler',
      });
    }

    try {
      const { berechneDashboard, dropTestunternehmenBestand } = await rechenkern();
      const ergebnis = berechneDashboard(dropTestunternehmenBestand(data));
      ergebnis.geladenAm = jetzt();
      const tEnde = jetzt();
      return jsonResponse(200, ergebnis, {
        'Server-Timing': `rpc;dur=${tRpc - t0}, rechnen;dur=${tEnde - tRpc}`,
      });
    } catch (e) {
      console.error('[stakeholder-dashboard] Rechnung fehlgeschlagen', e);
      return jsonResponse(500, {
        error: 'Dashboard konnte nicht gerechnet werden.',
        code: 'rechenfehler',
      });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
