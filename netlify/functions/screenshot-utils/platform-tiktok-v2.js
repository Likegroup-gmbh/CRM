/**
 * TikTok Screenshot V2
 *
 * TikTok schaltet seit Oktober 2026 eine Login-Wand vor das Video:
 *   1. "Bei TikTok anmelden" mit "Ueberspringen" (DivSkip)
 *   2. Altersabfrage mit drei Selects (Monat/Tag/Jahr) und "Weiter"
 *
 * V2 probiert zwei Strategien:
 *   A. Embed-Player (tiktok.com/player/v1/<ID>): keine Login-Wand, das Cover
 *      wird nach Entfernen der Overlays screenshottet.
 *   B. Login-Wand mit zufaelligem Geburtsdatum und variierenden Pausen
 *      durchklicken, dann das Player-Element im Desktop-Layout clippen.
 * Das alte Modul (platform-tiktok.js) bleibt unveraendert und ist der Fallback.
 *
 * Bewusst ohne schwere Imports (kein puppeteer): die Page kommt von aussen,
 * die DOM-Logik ist in `loginWallDom` gebuendelt und laesst sich mit jsdom testen.
 */

const MAX_SCREENSHOT_HEIGHT = 645;
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
// 9:16 wie das Cover des Embed-Players, damit es die Flaeche ausfuellt
const EMBED_VIEWPORT = { width: 430, height: 765 };
const MAX_WALL_ROUNDS = 5;
const MIN_BIRTH_YEAR = 1985;
const MAX_BIRTH_YEAR = 2002;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Zufaelliges, immer gueltiges und volljaehriges Geburtsdatum.
 * Tag bis 28, damit kein Monat ungueltig wird.
 */
function randomBirthdate(rng = Math.random) {
  return {
    month: randomInt(1, 12, rng),
    day: randomInt(1, 28, rng),
    year: randomInt(MIN_BIRTH_YEAR, MAX_BIRTH_YEAR, rng)
  };
}

/**
 * Alles, was im Browser (oder jsdom) am DOM passiert. Self-contained, weil
 * page.evaluate nur den Funktionstext serialisiert - keine Closures, keine
 * Modul-Helfer.
 *
 * ops:
 *   'state'                -> { state: 'none'|'skip'|'age'|'unknown', selects }
 *   'rect'  { kind, index }-> { x, y } Mittelpunkt im Viewport oder null
 *             kind: 'skip' | 'select' | 'option-index' | 'option-text' | 'next'
 *   'click' { kind, index }-> true/false (programmatischer Klick, Fallback)
 *   'remove-wall'          -> Anzahl entfernter Elemente
 *   'video'                -> { has, ready }
 *   'video-pause'          -> true
 *   'player-rect'          -> { x, y, width, height } oder null
 *
 * Fuer 'option-*' ist `index` das Select (0 Monat, 1 Tag, 2 Jahr), `value`
 * der Options-Index bzw. -Text.
 */
function loginWallDom(op, arg) {
  const args = arg || {};
  const SKIP_TEXTS = ['ueberspringen', 'überspringen', 'skip'];

  function isVisible(el) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  }

  function loginModal() {
    const modals = document.querySelectorAll('[data-e2e="login-modal"], #loginModalContentContainer');
    for (const m of modals) if (isVisible(m)) return m;
    return null;
  }

  function selectContainers() {
    const root = loginModal() || document;
    return Array.from(root.querySelectorAll('[data-e2e="select-container"]')).filter(isVisible);
  }

  function nextButton() {
    const btn = document.querySelector('[data-e2e="next-button"]');
    return btn && isVisible(btn) ? btn : null;
  }

  function skipButton() {
    const byClass = document.querySelector('[class*="DivSkip"]');
    if (byClass && isVisible(byClass)) return byClass;
    const candidates = document.querySelectorAll('[role="button"], button, div');
    for (const el of candidates) {
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim().toLowerCase();
      if (SKIP_TEXTS.includes(text) && isVisible(el)) return el;
    }
    return null;
  }

  function optionElement(selectIndex, value, byText) {
    const container = selectContainers()[selectIndex];
    if (!container) return null;
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    if (byText) return options.find((o) => (o.textContent || '').trim() === String(value)) || null;
    return options[value] || null;
  }

  function resolve(kind, index, value) {
    switch (kind) {
      case 'skip': return skipButton();
      case 'next': return nextButton();
      case 'select': return selectContainers()[index] || null;
      case 'option-index': return optionElement(index, value, false);
      case 'option-text': return optionElement(index, value, true);
      default: return null;
    }
  }

  function center(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  if (op === 'state') {
    const selects = selectContainers().length;
    if (selects >= 3 && nextButton()) return { state: 'age', selects };
    if (skipButton()) return { state: 'skip', selects };
    if (loginModal()) return { state: 'unknown', selects };
    return { state: 'none', selects };
  }

  if (op === 'rect') return center(resolve(args.kind, args.index, args.value));

  if (op === 'click') {
    const el = resolve(args.kind, args.index, args.value);
    if (!el) return false;
    el.click();
    return true;
  }

  if (op === 'remove-wall') {
    let removed = 0;
    const selectors = [
      '[data-e2e="login-modal"]',
      '#loginModalContentContainer',
      '[role="dialog"]',
      '[class*="DivModalMask"]',
      '[class*="DivModalContainer"]',
      '[class*="tux-base-dialog"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((el) => {
      el.remove();
      removed += 1;
    });
    [document.documentElement, document.body].forEach((el) => {
      if (!el) return;
      el.style.overflow = 'auto';
      el.style.pointerEvents = 'auto';
      el.style.filter = 'none';
      el.style.opacity = '1';
      el.classList.remove('body-hidden');
    });
    return removed;
  }

  if (op === 'video') {
    const v = document.querySelector('video');
    return { has: !!v, ready: !!v && v.readyState >= 2 };
  }

  if (op === 'video-pause') {
    const v = document.querySelector('video');
    if (v) {
      try { v.pause(); } catch (e) { /* egal */ }
    }
    return true;
  }

  if (op === 'player-rect') {
    const video = document.querySelector('video');
    if (!video) return null;
    window.scrollTo(0, 0);
    const base = video.getBoundingClientRect();
    if (!base.width || !base.height) return null;

    // Vorfahren mit praktisch gleicher Breite einbeziehen (Poster/Cover liegen
    // oft im Container statt im <video>), aber nie breiter als der Player.
    let best = base;
    let node = video.parentElement;
    for (let i = 0; i < 4 && node; i += 1, node = node.parentElement) {
      const r = node.getBoundingClientRect();
      if (r.width > base.width + 8 || r.height > window.innerHeight) break;
      if (r.width >= best.width && r.height >= best.height) best = r;
    }
    return { x: best.left, y: best.top, width: best.width, height: best.height };
  }

  return null;
}

const dom = (page, op, arg) => page.evaluate(loginWallDom, op, arg);

/** Cookie-Banner (Shadow DOM) ablehnen. */
async function declineCookieBanner(page, log) {
  try {
    const clicked = await page.evaluate(() => {
      const hosts = document.querySelectorAll('*');
      for (const el of hosts) {
        if (!el.shadowRoot) continue;
        for (const btn of el.shadowRoot.querySelectorAll('button')) {
          const text = (btn.textContent || '').toLowerCase();
          if (text.includes('ablehnen') || text.includes('decline') || text.includes('reject')) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });
    if (clicked) {
      log('Cookie-Banner abgelehnt');
      await sleep(randomInt(500, 1000));
    }
  } catch (e) {
    log(`Cookie-Banner: ${e.message}`);
  }
}

/**
 * Echter Mausklick mit kleiner Streuung und Mausweg. Faellt auf einen
 * programmatischen Klick zurueck, wenn das Element keine Box hat.
 */
async function humanClick(page, target) {
  const point = await dom(page, 'rect', target);
  if (!point) return dom(page, 'click', target);

  const x = point.x + randomInt(-3, 3);
  const y = point.y + randomInt(-2, 2);
  await page.mouse.move(x, y, { steps: randomInt(4, 10) });
  await sleep(randomInt(80, 240));
  await page.mouse.click(x, y, { delay: randomInt(40, 120) });
  return true;
}

async function fillAgeGate(page, log, rng) {
  const { month, day, year } = randomBirthdate(rng);
  log(`Altersabfrage: ${day}.${month}.${year}`);

  const steps = [
    { select: 0, kind: 'option-index', value: month - 1 },
    { select: 1, kind: 'option-index', value: day - 1 },
    { select: 2, kind: 'option-text', value: String(year) }
  ];

  for (const step of steps) {
    await humanClick(page, { kind: 'select', index: step.select });
    await sleep(randomInt(250, 600));
    const ok = await humanClick(page, { kind: step.kind, index: step.select, value: step.value });
    if (!ok) log(`Option nicht gefunden (Select ${step.select}, Wert ${step.value})`);
    await sleep(randomInt(250, 700));
  }

  await humanClick(page, { kind: 'next' });
  log('Weiter geklickt');
}

/**
 * Login-Wand abarbeiten. Gibt zurueck, ob sie weg ist.
 */
async function passLoginWall(page, log, rng) {
  let sawWall = false;

  for (let round = 1; round <= MAX_WALL_ROUNDS; round += 1) {
    let { state } = await dom(page, 'state');

    // Die Wand kommt mitunter verzoegert - einmal kurz nachsehen, bevor wir
    // "keine Wand" annehmen.
    if (state === 'none') {
      await sleep(round === 1 ? 2500 : 1200);
      ({ state } = await dom(page, 'state'));
    }

    log(`Login-Wand Runde ${round}: ${state}`);

    if (state === 'none') return true;
    sawWall = true;

    if (state === 'skip') {
      await humanClick(page, { kind: 'skip' });
      log('Ueberspringen geklickt');
    } else if (state === 'age') {
      await fillAgeGate(page, log, rng);
    }

    await sleep(randomInt(400, 1200));
  }

  const final = await dom(page, 'state');
  if (final.state === 'none') return true;
  log(sawWall ? 'Login-Wand steht nach allen Runden noch' : 'Unbekannter Zustand');
  return false;
}

async function waitForVideoFrame(page, log) {
  const start = Date.now();
  while (Date.now() - start < 6000) {
    const v = await dom(page, 'video');
    if (v.ready) break;
    await sleep(300);
  }
  await dom(page, 'video-pause');
  const v = await dom(page, 'video');
  log(`Video: vorhanden=${v.has}, Frame=${v.ready}`);
  return v;
}

/**
 * Strategie B: Login-Wand durchklicken, dann Player-Element clippen.
 */
async function captureViaLoginWall(page, navigateUrl, log, rng) {
  await page.setViewport(DESKTOP_VIEWPORT);
  await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

  try {
    await page.waitForFunction(
      () => document.querySelector('video') || document.querySelector('[data-e2e="login-modal"]') ||
        document.querySelector('[class*="DivSkip"]'),
      { timeout: 10000 }
    );
  } catch (e) {
    log('Weder Video noch Login-Wand nach 10s');
  }

  await declineCookieBanner(page, log);

  const wallGone = await passLoginWall(page, log, rng);
  if (!wallGone) {
    const removed = await dom(page, 'remove-wall');
    log(`Harter Fallback: ${removed} Element(e) entfernt`);
    await sleep(500);
  }

  const video = await waitForVideoFrame(page, log);
  if (!video.has) {
    throw new Error('TikTok V2: kein Video-Element gefunden');
  }

  const rect = await dom(page, 'player-rect');
  if (rect) {
    const viewportBottom = DESKTOP_VIEWPORT.height - rect.y;
    const clip = {
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      width: Math.min(rect.width, DESKTOP_VIEWPORT.width - Math.max(0, rect.x)),
      height: Math.max(1, Math.min(rect.height, MAX_SCREENSHOT_HEIGHT, viewportBottom))
    };
    log(`Player-Clip ${Math.round(clip.width)}x${Math.round(clip.height)}`);
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 85, clip });
    return { screenshotBuffer };
  }

  log('Fallback: Viewport-Clip');
  const screenshotBuffer = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    clip: { x: 0, y: 0, width: DESKTOP_VIEWPORT.width, height: MAX_SCREENSHOT_HEIGHT }
  });
  return { screenshotBuffer };
}

/**
 * Video-ID aus einer TikTok-URL (lang, mobil, mit Query, Player-URL).
 * Kurzlinks liefern null und muessen vorher per Redirect aufgeloest werden.
 */
function parseTikTokVideoId(url) {
  if (!url) return null;
  const match = String(url).match(/\/(?:video|player\/v1|embed\/v2)\/(\d{8,25})/);
  return match ? match[1] : null;
}

function isTikTokShortLink(url) {
  return /^https?:\/\/(?:vm|vt)\.tiktok\.com\//i.test(url) ||
    /^https?:\/\/(?:www\.)?tiktok\.com\/t\//i.test(url);
}

/**
 * Kurzlink per Redirect auf die lange URL aufloesen (bis zu 3 Spruenge).
 * Gibt bei Fehlern die Ausgangs-URL zurueck.
 */
async function resolveTikTokShortLink(url, fetchImpl = fetch) {
  let current = url;
  for (let i = 0; i < 3; i += 1) {
    if (parseTikTokVideoId(current)) return current;
    try {
      const res = await fetchImpl(current, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      const location = res.headers && res.headers.get && res.headers.get('location');
      if (!location) return current;
      current = new URL(location, current).toString();
    } catch (e) {
      return current;
    }
  }
  return current;
}

/**
 * DOM-Helfer fuer den Embed-Player (self-contained wegen page.evaluate).
 *
 * ops:
 *   'cover' -> { has, loaded }   Cover-Bild vorhanden und fertig geladen
 *   'gate'  -> true/false        Login-Modal im Player
 *   'clean' -> Anzahl ausgeblendeter Overlays
 *
 * 'clean' blendet alles Absolute/Fixed ausser Cover, dessen Vorfahren und
 * Elementen mit Hintergrundbild (Blur-Hintergrund) aus. Unabhaengig von den
 * styled-components-Klassennamen.
 */
function embedPlayerDom(op) {
  function cover() {
    return document.querySelector('img[alt="Video Cover"]') ||
      Array.from(document.querySelectorAll('img')).sort(
        (a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight)
      )[0] || null;
  }

  if (op === 'cover') {
    const img = cover();
    return { has: !!img, loaded: !!img && img.complete && img.naturalWidth > 0 };
  }

  if (op === 'gate') {
    return !!document.querySelector('[data-e2e="login-modal"], [role="dialog"]');
  }

  if (op === 'clean') {
    const img = cover();
    if (!img) return 0;
    const keep = new Set();
    for (let n = img; n; n = n.parentElement) keep.add(n);

    let hidden = 0;
    document.querySelectorAll('body *').forEach((el) => {
      if (keep.has(el) || img.contains(el)) return;
      if (Array.from(keep).some((k) => el.contains(k))) return;
      const style = window.getComputedStyle(el);
      const isBackdrop = style.backgroundImage && style.backgroundImage !== 'none';
      const isOverlay = style.position === 'fixed' || style.position === 'absolute';
      if (el.tagName === 'TIKTOK-COOKIE-BANNER' || (isOverlay && !isBackdrop)) {
        el.style.setProperty('display', 'none', 'important');
        hidden += 1;
      }
    });
    return hidden;
  }

  return null;
}

const embedDom = (page, op) => page.evaluate(embedPlayerDom, op);

/**
 * Strategie A: Embed-Player (tiktok.com/player/v1/<ID>). Keine Login-Wand.
 * Der Player zeigt das Cover im Viewport; ein 9:16-Viewport laesst es die
 * ganze Flaeche fuellen, Overlays (Autor, Steuerung, Buttons) werden entfernt.
 */
async function captureViaEmbed(page, navigateUrl, log, fetchImpl) {
  let longUrl = navigateUrl;
  if (!parseTikTokVideoId(longUrl) && isTikTokShortLink(longUrl)) {
    longUrl = await resolveTikTokShortLink(longUrl, fetchImpl);
    log(`Kurzlink aufgeloest: ${longUrl}`);
  }
  const videoId = parseTikTokVideoId(longUrl);
  if (!videoId) throw new Error('Keine Video-ID in der URL');

  const playerUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=0&music_info=0&description=0`;
  log(`Embed-Player: ${playerUrl}`);

  await page.setViewport(EMBED_VIEWPORT);
  await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

  try {
    await page.waitForFunction(
      () => {
        const img = document.querySelector('img[alt="Video Cover"]');
        return !!img && img.complete && img.naturalWidth > 0;
      },
      { timeout: 12000 }
    );
  } catch (e) {
    const gate = await embedDom(page, 'gate').catch(() => false);
    throw new Error(gate ? 'Embed-Player zeigt Login-Gate' : 'Cover im Embed-Player nicht geladen');
  }

  if (await embedDom(page, 'gate')) throw new Error('Embed-Player zeigt Login-Gate');

  const hidden = await embedDom(page, 'clean');
  log(`Embed-Player: ${hidden} Overlay(s) ausgeblendet`);
  await sleep(300);

  const screenshotBuffer = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    clip: { x: 0, y: 0, width: EMBED_VIEWPORT.width, height: Math.min(EMBED_VIEWPORT.height, MAX_SCREENSHOT_HEIGHT) }
  });
  log('Embed-Screenshot erstellt');
  return { screenshotBuffer };
}

/**
 * Kompletter V2-Lauf auf einer Page mit Desktop-Profil:
 * erst Embed-Player, bei Fehler Login-Wand-Klicker. Wirft, wenn beides scheitert
 * (der Aufrufer faellt dann auf das alte V1 zurueck).
 *
 * @param {import('puppeteer').Page} page
 * @param {string} navigateUrl
 * @param {Object} [opts]
 * @param {Function} [opts.log]    (msg) fuer Diagnose
 * @param {Function} [opts.rng]    Zufallsquelle (Tests)
 * @param {Function} [opts.fetch]  fetch-Ersatz fuer Kurzlink-Aufloesung (Tests)
 * @returns {Promise<{screenshotBuffer: Buffer, strategy: 'embed'|'login-wall'}>}
 */
async function captureTikTokV2(page, navigateUrl, opts = {}) {
  const log = (msg) => (opts.log || console.log)(`TikTok V2: ${msg}`);
  const rng = opts.rng || Math.random;

  try {
    const { screenshotBuffer } = await captureViaEmbed(page, navigateUrl, log, opts.fetch || fetch);
    return { screenshotBuffer, strategy: 'embed' };
  } catch (e) {
    log(`Embed fehlgeschlagen (${e.message}) - versuche Login-Wand`);
  }

  const { screenshotBuffer } = await captureViaLoginWall(page, navigateUrl, log, rng);
  return { screenshotBuffer, strategy: 'login-wall' };
}

/** Env-Schalter: TIKTOK_SCREENSHOT_V2=off schaltet V2 ab. */
function isTikTokV2Enabled(env = process.env) {
  return String(env.TIKTOK_SCREENSHOT_V2 || '').toLowerCase() !== 'off';
}

module.exports = {
  captureTikTokV2,
  isTikTokV2Enabled,
  randomBirthdate,
  loginWallDom,
  embedPlayerDom,
  parseTikTokVideoId,
  isTikTokShortLink,
  resolveTikTokShortLink,
  DESKTOP_VIEWPORT,
  EMBED_VIEWPORT
};
