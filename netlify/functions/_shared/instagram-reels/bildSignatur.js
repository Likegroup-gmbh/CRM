// _shared/instagram-reels/bildSignatur.js
// Thumbnails der Instagram-CPM-Seite laufen ueber die Function instagram-bild, weil das
// Instagram-CDN Einbettungen auf fremden Seiten per Cross-Origin-Resource-Policy blockt.
// Ein <img> schickt keinen Bearer-Token mit, deshalb signiert der Scraper jede Bild-URL;
// instagram-bild laedt nur signierte URLs von Instagram-Hosts und ist so kein offener Proxy.

const crypto = require('crypto');

const ENDPOINT = '/.netlify/functions/instagram-bild';
const HOST_RE = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

function schluessel(env = process.env) {
  const token = String(env.APIFY_TOKEN || '').trim();
  return token ? `instagram-bild:${token}` : null;
}

function istInstagramBild(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

function signatur(url, key) {
  return crypto.createHmac('sha256', key).update(url).digest('base64url');
}

/** Proxy-Pfad fuer eine CDN-URL, null wenn sie nicht von Instagram kommt oder kein Schluessel da ist. */
function bildPfad(url, env = process.env) {
  const key = schluessel(env);
  if (!key || !istInstagramBild(url)) return null;
  return `${ENDPOINT}?u=${encodeURIComponent(url)}&s=${signatur(url, key)}`;
}

function signaturOk(url, sig, env = process.env) {
  const key = schluessel(env);
  if (!key || typeof url !== 'string' || typeof sig !== 'string') return false;
  const want = Buffer.from(signatur(url, key));
  const got = Buffer.from(sig);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

module.exports = { ENDPOINT, istInstagramBild, bildPfad, signaturOk };
