'use strict';

// Reine Pruefungen fuer den Magic-Link-Smoke-Test (kein Netzwerk, damit testbar).
// Runner: scripts/smoke-magic-link.cjs

const RAW_ICON = /\$\{\s*icon\(/;
const DIRECT_TABLE_READ = /from\(\s*["'`]magic_links["'`]\s*\)/;
const SUPABASE_URL = /https:\/\/[a-z0-9]{15,}\.supabase\.co/;
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;

/** Rohes ${icon()} im HTML heisst: Template wurde nie gerendert (Fehlericon als Text). */
function checkHtml(html) {
  const fehler = [];
  if (RAW_ICON.test(html)) fehler.push('HTML enthaelt rohes ${icon(...)} (Icon wird als Text angezeigt)');
  if (!/<script[^>]+type="module"[^>]+src="[^"]+"/.test(html)) fehler.push('HTML bindet kein Modul-Script ein');
  return fehler;
}

/** Die Registrierungsseite muss den Token ueber den RPC pruefen, nie ueber die Tabelle. */
function checkEntryBundle(js) {
  const fehler = [];
  if (!js.includes('magic_link_vorschau')) fehler.push('Bundle ruft magic_link_vorschau nicht auf');
  if (DIRECT_TABLE_READ.test(js)) fehler.push('Bundle liest magic_links direkt (fuer anon gesperrt, ergibt 406)');
  return fehler;
}

/** Supabase-URL und Anon-Key stecken oeffentlich im Bundle. */
function extractSupabaseConfig(bundles) {
  const text = bundles.join('\n');
  const url = (text.match(SUPABASE_URL) || [])[0] || null;
  const anonKey = (text.match(JWT) || [])[0] || null;
  return { url, anonKey };
}

/** Unbekannter Token: RPC antwortet 200 mit { valid:false, error:'not_found' }. */
function checkRpcResponse(status, body) {
  const fehler = [];
  if (status !== 200) {
    fehler.push(`RPC magic_link_vorschau antwortet ${status} statt 200 (Funktion fehlt oder fuer anon gesperrt)`);
    return fehler;
  }
  if (!body || body.valid !== false || body.error !== 'not_found') {
    fehler.push(`RPC magic_link_vorschau liefert unerwartet ${JSON.stringify(body)}`);
  }
  return fehler;
}

/** anon darf magic_links nicht lesen: leere Liste oder 4xx ist ok, jede Zeile ist ein Leck. */
function checkTableClosed(status, body) {
  if (Array.isArray(body) && body.length > 0) {
    return ['magic_links ist fuer anon lesbar (Token-Leck)'];
  }
  if (status >= 500) return [`magic_links-Abfrage liefert ${status}`];
  return [];
}

module.exports = {
  checkHtml,
  checkEntryBundle,
  extractSupabaseConfig,
  checkRpcResponse,
  checkTableClosed,
};
