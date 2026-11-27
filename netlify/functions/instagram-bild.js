// instagram-bild.js
// Liefert Thumbnails fuer die Admin-Seite Instagram-CPM aus. Das Instagram-CDN blockt
// Einbettungen auf fremden Seiten, deshalb laedt diese Function das Bild und gibt es selbst aus.
// Nur signierte URLs von Instagram-Hosts (bildSignatur.js), sonst waere das ein offener Proxy.
//
// GET ?u=<CDN-URL>&s=<Signatur> -> Bild (Base64), Cache einen Tag

const { istInstagramBild, signaturOk } = require('./_shared/instagram-reels/bildSignatur');

const TIMEOUT_MS = 8000;
// Netlify-Antworten duerfen 6 MB haben, Base64 macht ein Drittel mehr daraus
const MAX_BYTES = 4 * 1024 * 1024;

const fehler = (statusCode, text) => ({
  statusCode,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  body: text,
});

function createHandler({ env = process.env, fetchImpl = (...a) => fetch(...a) } = {}) {
  return async (event) => {
    if (event.httpMethod !== 'GET') return fehler(405, 'Method not allowed');
    const { u: url, s: sig } = event.queryStringParameters || {};
    if (!istInstagramBild(url) || !signaturOk(url, sig, env)) return fehler(403, 'Ungültige Bild-URL');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const resp = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow' });
      if (resp.url && !istInstagramBild(resp.url)) return fehler(502, 'Weiterleitung auf fremden Host');
      if (!resp.ok) return fehler(resp.status === 404 || resp.status === 403 ? 404 : 502, `CDN ${resp.status}`);
      const typ = resp.headers.get('content-type') || '';
      if (!/^image\//i.test(typ)) return fehler(502, 'Kein Bild');
      const daten = Buffer.from(await resp.arrayBuffer());
      if (daten.length > MAX_BYTES) return fehler(502, 'Bild zu groß');
      return {
        statusCode: 200,
        headers: { 'Content-Type': typ, 'Cache-Control': 'private, max-age=86400' },
        body: daten.toString('base64'),
        isBase64Encoded: true,
      };
    } catch (err) {
      return fehler(err?.name === 'AbortError' ? 504 : 502, 'Bild nicht abrufbar');
    } finally {
      clearTimeout(timer);
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
