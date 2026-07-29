// cache.js
// Liest und schreibt Extraktions-Ergebnisse in public.url_extractions.
// Cache-Fehler sind nie fatal: im Zweifel wird neu extrahiert.

const crypto = require('crypto');

const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/** Normalisiert die URL, damit Tippvarianten denselben Cache-Eintrag treffen. */
function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|msclkid|mc_cid|mc_eid|ref)/i.test(key)) u.searchParams.delete(key);
    }
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.href;
  } catch {
    return rawUrl;
  }
}

function hashUrl(rawUrl) {
  return crypto.createHash('sha256').update(normalizeUrl(rawUrl)).digest('hex');
}

async function readCache(supabase, { url, entityType, specVersion }) {
  try {
    const { data, error } = await supabase
      .from('url_extractions')
      .select('result, source, created_at')
      .eq('url_hash', hashUrl(url))
      .eq('entity_type', entityType)
      .eq('spec_version', specVersion)
      .maybeSingle();

    if (error || !data) return null;

    const age = Date.now() - new Date(data.created_at).getTime();
    if (age > TTL_MS) {
      console.log('🕒 site-extract: Cache-Eintrag abgelaufen');
      return null;
    }

    console.log(`⚡ site-extract: Cache-Treffer (${Math.round(age / 86400000)} Tage alt)`);
    return { ...data.result, source: data.source || data.result?.source, cached: true };
  } catch (err) {
    console.warn('⚠️ site-extract: Cache-Lesen fehlgeschlagen:', err.message);
    return null;
  }
}

async function writeCache(supabase, { url, entityType, specVersion, source, result }) {
  try {
    const { error } = await supabase.from('url_extractions').upsert(
      {
        url_hash: hashUrl(url),
        url: normalizeUrl(url),
        entity_type: entityType,
        spec_version: specVersion,
        source,
        result,
        created_at: new Date().toISOString()
      },
      { onConflict: 'url_hash,entity_type,spec_version' }
    );
    if (error) console.warn('⚠️ site-extract: Cache-Schreiben fehlgeschlagen:', error.message);
  } catch (err) {
    console.warn('⚠️ site-extract: Cache-Schreiben fehlgeschlagen:', err.message);
  }
}

module.exports = { readCache, writeCache, normalizeUrl, hashUrl, TTL_DAYS };
