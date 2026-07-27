// page-fetcher.js
// Holt HTML mit maximaler Trefferquote: erst ein normales fetch(), und wenn das
// Ergebnis ein Qualitaets-Gate reisst (Bot-Wall, JS-only-SPA, leere Seite),
// derselbe Puppeteer-Stealth-Stack wie bei den Screenshots.
//
// Ein Fetcher haelt den Browser fuer alle Seiten eines Laufs offen, damit die
// Impressum-Unterseite keinen zweiten Cold Start kostet.

const { htmlToText } = require('./html-distill');

const FETCH_TIMEOUT_MS = 12000;
const BROWSER_TIMEOUT_MS = 25000;
const MIN_TEXT_LENGTH = 400;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1'
};

// Typische Marker von Challenge-Seiten und Bot-Walls
const BOT_WALL_MARKERS = [
  'cf-browser-verification',
  'challenge-platform',
  '__cf_chl',
  'cf_chl_opt',
  'just a moment',
  'attention required',
  'checking your browser',
  'enable javascript and cookies',
  'ddos protection by',
  'please verify you are a human',
  'access denied'
];

/** Offensichtlich interne Ziele blocken - die Function laeuft mit Service-Key. */
function assertPublicUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('Keine gueltige URL');
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('Nur http und https werden unterstuetzt');
  }
  const host = u.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1' ||
    host === '0.0.0.0';
  if (blocked) {
    throw new Error('Interne Adressen sind nicht erlaubt');
  }
  return u.href;
}

/**
 * Bewertet, ob das HTML verwertbar ist. Gibt bei Problemen einen Grund zurueck,
 * damit das Log nachvollziehbar bleibt.
 */
function assessHtml(html, status) {
  if (status && (status === 403 || status === 429 || status >= 500)) {
    return { ok: false, reason: `HTTP ${status}` };
  }
  if (!html || html.length < 200) {
    return { ok: false, reason: 'Antwort praktisch leer' };
  }

  const head = html.slice(0, 60000).toLowerCase();
  const marker = BOT_WALL_MARKERS.find((needle) => head.includes(needle));
  if (marker) {
    return { ok: false, reason: `Bot-Wall erkannt ("${marker}")` };
  }

  if (!/<title[^>]*>\s*\S/i.test(html)) {
    return { ok: false, reason: 'Kein Titel im HTML' };
  }

  const textLength = htmlToText(html, MIN_TEXT_LENGTH * 4).length;
  if (textLength < MIN_TEXT_LENGTH) {
    return { ok: false, reason: `Nur ${textLength} Zeichen Text (JS-gerendert?)` };
  }

  return { ok: true };
}

async function plainFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: controller.signal
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      return { html: '', status: res.status, finalUrl: res.url || url, reason: `Content-Type ${contentType}` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const html = buffer.slice(0, MAX_HTML_BYTES).toString('utf8');
    return { html, status: res.status, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

function createPageFetcher() {
  let browser = null;
  let page = null;
  let browserFailed = false;

  async function getPage() {
    if (page) return page;
    // Lazy: Chromium wird nur gestartet, wenn plain fetch tatsaechlich versagt
    const { launchBrowser, setupPage } = require('../screenshot-utils/browser-setup');
    browser = await launchBrowser('website');
    page = await setupPage(browser, 'website');
    return page;
  }

  async function browserFetch(url) {
    const p = await getPage();
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: BROWSER_TIMEOUT_MS });
    // Kurz nachlaufen lassen, damit client-gerenderte Inhalte im DOM landen
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const html = await p.content();
    return { html, finalUrl: p.url() };
  }

  /**
   * `degraded` heisst: das Gate hat angeschlagen, der Browser konnte es aber
   * nicht auffangen. Der Inhalt ist dann meist eine Bot-Wall. Der Aufrufer soll
   * so ein Ergebnis nicht cachen.
   * @returns {Promise<{ html: string, finalUrl: string, source: 'fetch'|'browser', degraded: boolean, notes: string[] }>}
   */
  async function load(rawUrl) {
    const url = assertPublicUrl(rawUrl);
    const notes = [];

    let direct = null;
    try {
      direct = await plainFetch(url);
      const verdict = assessHtml(direct.html, direct.status);
      if (verdict.ok) {
        console.log(`✅ site-extract: fetch ok (${url})`);
        return { html: direct.html, finalUrl: direct.finalUrl, source: 'fetch', degraded: false, notes };
      }
      console.log(`⚠️ site-extract: fetch unbrauchbar (${verdict.reason}) -> Browser`);
      notes.push(`fetch verworfen: ${verdict.reason}`);
    } catch (err) {
      console.log(`⚠️ site-extract: fetch fehlgeschlagen (${err.message}) -> Browser`);
      notes.push(`fetch fehlgeschlagen: ${err.message}`);
    }

    if (browserFailed) {
      if (direct?.html) return { html: direct.html, finalUrl: direct.finalUrl, source: 'fetch', degraded: true, notes };
      throw new Error('Seite konnte nicht geladen werden');
    }

    try {
      const viaBrowser = await browserFetch(url);
      console.log(`✅ site-extract: Browser ok (${viaBrowser.finalUrl})`);
      return { ...viaBrowser, source: 'browser', degraded: false, notes };
    } catch (err) {
      browserFailed = true;
      console.error(`❌ site-extract: Browser fehlgeschlagen (${err.message})`);
      notes.push(`Browser fehlgeschlagen: ${err.message}`);
      // Lieber ein schwaches fetch-Ergebnis als gar keins
      if (direct?.html) return { html: direct.html, finalUrl: direct.finalUrl, source: 'fetch', degraded: true, notes };
      throw new Error(`Seite konnte nicht geladen werden: ${err.message}`);
    }
  }

  async function close() {
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.warn('⚠️ site-extract: Browser-Close fehlgeschlagen:', err.message);
      }
      browser = null;
      page = null;
    }
  }

  return { load, close };
}

module.exports = {
  createPageFetcher,
  assertPublicUrl,
  assessHtml,
  MIN_TEXT_LENGTH
};
