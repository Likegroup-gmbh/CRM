// page-fetcher.js
// Holt HTML mit maximaler Trefferquote: erst ein normales fetch(), und wenn das
// Ergebnis ein Qualitaets-Gate reisst (Bot-Wall, JS-only-SPA, leere Seite),
// derselbe Puppeteer-Stealth-Stack wie bei den Screenshots.
//
// Ein Fetcher haelt den Browser fuer alle Seiten eines Laufs offen, damit die
// Impressum-Unterseite keinen zweiten Cold Start kostet.

const { htmlToText } = require('./html-distill');

const FETCH_TIMEOUT_MS = 8000;
const BROWSER_TIMEOUT_MS = 18000;
// Chromium-Cold-Start plus goto: darunter lohnt der Versuch nicht mehr und
// wuerde nur das Zeitlimit der Function reissen
const BROWSER_MIN_REMAINING_MS = 24000;
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

// Nachwartezeit, wenn nach dem Laden noch zu wenig Text im DOM steht
const CONTENT_WAIT_MAX_MS = 3000;
const CONTENT_WAIT_STEP_MS = 400;

// Bekannte Zustimm-Buttons der verbreiteten Consent-Tools. Hinter so einem
// Overlay steht der Seiteninhalt haeufig noch nicht im DOM.
const CONSENT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#didomi-notice-agree-button',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  '[data-testid="uc-accept-all-button"]',
  '.cmpboxbtnyes',
  '.sp_choice_type_11',
  '#consent-page button[type="submit"]'
];

// Fallback ueber die Beschriftung. Nur innerhalb eines Consent-Containers, sonst
// wuerde ein beliebiges "OK" auf der Seite geklickt.
const CONSENT_TEXT = /^(alle\s+)?(cookies\s+)?(akzeptieren|annehmen|zustimmen|einverstanden|verstanden|erlauben|accept(\s+all)?(\s+cookies)?|allow\s+all|i\s+agree|agree|got\s+it|ok)$/i;
const CONSENT_CONTAINER = /consent|cookie|gdpr|dsgvo|cmp|privacy|usercentrics|didomi|onetrust|cookiebot|klaro|borlabs/i;

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

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Versucht, ein Consent-Overlay zu bestaetigen.
 * @returns {Promise<string|null>} was geklickt wurde, fuer die Diagnose
 */
async function dismissConsent(p) {
  try {
    return await p.evaluate((selectors, textQuelle, containerQuelle) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          el.click();
          return sel;
        }
      }

      // Beschriftungs-Fallback, aber nur innerhalb eines Consent-Containers:
      // ein freistehendes "OK" koennte sonst irgendwohin navigieren
      const textRe = new RegExp(textQuelle, 'i');
      const containerRe = new RegExp(containerQuelle, 'i');
      const imConsentContainer = (el) => {
        let node = el;
        for (let tiefe = 0; node && tiefe < 6; tiefe += 1) {
          const kennung = `${node.id || ''} ${typeof node.className === 'string' ? node.className : ''}`;
          if (containerRe.test(kennung)) return true;
          node = node.parentElement;
        }
        return false;
      };

      for (const el of document.querySelectorAll('button, [role="button"]')) {
        const text = (el.innerText || el.textContent || '').trim();
        if (text.length > 30 || !textRe.test(text)) continue;
        if (!imConsentContainer(el)) continue;
        el.click();
        return `Text "${text}"`;
      }
      return null;
    }, CONSENT_SELECTORS, CONSENT_TEXT.source, CONSENT_CONTAINER.source);
  } catch (err) {
    // Ein fehlgeschlagener Klickversuch darf die Extraktion nicht kippen
    console.log(`🍪 site-extract: Consent-Versuch fehlgeschlagen (${err.message})`);
    return null;
  }
}

/** Wartet nur so lange, bis genug Text im DOM steht - hoechstens maxMs. */
async function warteAufInhalt(p, maxMs) {
  const bis = Date.now() + maxMs;
  let laenge = 0;
  for (;;) {
    laenge = await p.evaluate(() => document.body?.innerText?.length || 0).catch(() => 0);
    if (laenge >= MIN_TEXT_LENGTH || Date.now() >= bis) return laenge;
    await warte(Math.min(CONTENT_WAIT_STEP_MS, Math.max(0, bis - Date.now())));
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
    // Ein Budget fuer den gesamten Browser-Schritt, Cold Start eingerechnet.
    // Sonst summieren sich Start, goto und Nachwarten ueber das Limit.
    const deadline = Date.now() + BROWSER_TIMEOUT_MS;
    const rest = () => Math.max(0, deadline - Date.now());

    const p = await getPage();
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.max(3000, rest()) });

    const consent = await dismissConsent(p);
    if (consent) {
      console.log(`🍪 site-extract: Consent-Banner bestaetigt (${consent})`);
      await warte(Math.min(800, rest()));
    }

    // Adaptiv statt pauschal: nur nachwarten, wenn im DOM noch zu wenig steht
    const textLaenge = await warteAufInhalt(p, Math.min(CONTENT_WAIT_MAX_MS, rest()));

    const html = await p.content();
    return { html, finalUrl: p.url(), consent, textLaenge };
  }

  /**
   * `degraded` heisst: das Gate hat angeschlagen, der Browser konnte es aber
   * nicht auffangen. Der Inhalt ist dann meist eine Bot-Wall. Der Aufrufer soll
   * so ein Ergebnis nicht cachen.
   * @param {string} rawUrl
   * @param {Object} [options]
   * @param {number} [options.remainingMs] - Restbudget der Function. Reicht es
   *   nicht fuer den Browser, bleibt es beim fetch-Ergebnis statt das
   *   Zeitlimit zu reissen.
   * @returns {Promise<{ html: string, finalUrl: string, source: 'fetch'|'browser', degraded: boolean, notes: string[], timings: Object }>}
   */
  async function load(rawUrl, options = {}) {
    const url = assertPublicUrl(rawUrl);
    const { remainingMs = Infinity } = options;
    const notes = [];
    const timings = {};

    let direct = null;
    const fetchStart = Date.now();
    try {
      direct = await plainFetch(url);
      timings.fetchMs = Date.now() - fetchStart;
      const verdict = assessHtml(direct.html, direct.status);
      if (verdict.ok) {
        console.log(`✅ site-extract: fetch ok in ${timings.fetchMs}ms (${url})`);
        return { html: direct.html, finalUrl: direct.finalUrl, source: 'fetch', degraded: false, notes, timings };
      }
      console.log(`⚠️ site-extract: fetch unbrauchbar nach ${timings.fetchMs}ms (${verdict.reason}) -> Browser`);
      notes.push(`fetch verworfen: ${verdict.reason}`);
    } catch (err) {
      timings.fetchMs = Date.now() - fetchStart;
      console.log(`⚠️ site-extract: fetch fehlgeschlagen nach ${timings.fetchMs}ms (${err.message}) -> Browser`);
      notes.push(`fetch fehlgeschlagen: ${err.message}`);
    }

    const degradedFetch = () => ({
      html: direct.html, finalUrl: direct.finalUrl, source: 'fetch', degraded: true, notes, timings
    });

    if (browserFailed) {
      if (direct?.html) return degradedFetch();
      throw new Error('Seite konnte nicht geladen werden');
    }

    // Nur starten, wenn das Restbudget den Cold Start plus goto traegt
    if (remainingMs < BROWSER_MIN_REMAINING_MS) {
      const grund = `Browser wegen Zeitlimit uebersprungen (${Math.round(remainingMs / 1000)}s Rest)`;
      console.log(`⏱️ site-extract: ${grund}`);
      notes.push(grund);
      if (direct?.html) return degradedFetch();
      throw new Error('Seite konnte nicht geladen werden: Zeitlimit erreicht');
    }

    const browserStart = Date.now();
    try {
      const viaBrowser = await browserFetch(url);
      timings.browserMs = Date.now() - browserStart;
      console.log(`✅ site-extract: Browser ok in ${timings.browserMs}ms (${viaBrowser.finalUrl})`);
      return { ...viaBrowser, source: 'browser', degraded: false, notes, timings };
    } catch (err) {
      timings.browserMs = Date.now() - browserStart;
      browserFailed = true;
      console.error(`❌ site-extract: Browser fehlgeschlagen nach ${timings.browserMs}ms (${err.message})`);
      notes.push(`Browser fehlgeschlagen: ${err.message}`);
      // Lieber ein schwaches fetch-Ergebnis als gar keins
      if (direct?.html) return degradedFetch();
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
