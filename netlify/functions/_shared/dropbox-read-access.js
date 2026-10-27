// Lesezugriff auf Dropbox-Pfade fuer Nicht-Staff (Kunden, Gaeste).
//
// Kunden und Gaeste holen ueber dropbox-proxy Streaming-/Download-Links fuer
// Dateien, die ihnen die App anzeigt. Die App laedt die Asset-Zeile vorher per
// Supabase, also durch RLS. Hier wird dieselbe Zeile noch einmal mit dem JWT
// des Aufrufers abgefragt: Sieht er sie, darf er den Link bekommen. Das gilt
// fuer Supabase-Sessions (Kunde) und Gast-JWTs gleichermassen, ohne Rollenlogik.

const { createClient } = require('@supabase/supabase-js');
const { isSafeDropboxPath } = require('./dropbox-path');

/** Tabellen mit Dropbox-`file_path`, die Kunden/Gaeste ueber die App sehen koennen */
const ASSET_TABLES = [
  'kooperation_video_asset',
  'kooperation_story_asset',
  'kooperation_bilder_asset',
  'custom_column_assets',
  'kooperation_rohmaterial_asset',
];

function callerJwt(event) {
  const headers = (event && event.headers) || {};
  const raw = headers.authorization || headers.Authorization || '';
  return raw.replace(/^Bearer\s+/i, '').trim();
}

function defaultClientFactory(jwt) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/**
 * Darf der Aufrufer (mit seinem JWT, unter RLS) einen Asset-Eintrag zu `path` sehen?
 * @param {object} event Netlify-Event (Authorization-Header)
 * @param {string} path Dropbox-Pfad
 * @param {{ clientFactory?: (jwt: string) => object|null }} [options]
 * @returns {Promise<{ ok: boolean, status?: number, error?: string }>}
 */
async function canReadAssetPath(event, path, options = {}) {
  const jwt = callerJwt(event);
  if (!jwt) return { ok: false, status: 401, error: 'Nicht angemeldet' };
  if (!isSafeDropboxPath(path)) return { ok: false, status: 400, error: 'path is invalid' };

  const client = (options.clientFactory || defaultClientFactory)(jwt);
  if (!client) {
    console.error('[dropbox-read-access] SUPABASE_URL / SUPABASE_ANON_KEY fehlt');
    return { ok: false, status: 500, error: 'Serverkonfiguration unvollständig' };
  }

  for (const table of ASSET_TABLES) {
    const { data, error } = await client
      .from(table)
      .select('id')
      .eq('file_path', path)
      .limit(1);
    if (error) {
      // Fehlende Tabelle/Spalte oder abgelehntes JWT: naechste Tabelle probieren
      continue;
    }
    if (data && data.length > 0) return { ok: true };
  }

  return { ok: false, status: 403, error: 'Kein Zugriff auf diese Datei' };
}

module.exports = { canReadAssetPath, ASSET_TABLES };
