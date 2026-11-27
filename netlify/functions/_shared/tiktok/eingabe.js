// _shared/tiktok/eingabe.js
// Eingaben der Admin-Seite TikTok-API pruefen und in den Input des Apify-Actors
// clockworks/tiktok-scraper uebersetzen. Ungueltige Zeilen blockieren den Lauf, damit kein
// halber Lauf Geld kostet. Datumsfilter bleiben aus: die rechnet der Actor extra ab.
// profilName und actorInput nutzt auch der Profilabruf im Casting (profil-abruf.js).

const MAX_VIDEOS = 20;
const MAX_PROFILE = 5;
const ANZAHL_STANDARD = 10;
const ANZAHL_MAX = 30;

const USERNAME_RE = /^[a-z0-9._]{2,24}$/;
const VIDEO_PFAD_RE = /^\/@[A-Za-z0-9._]{2,24}\/(video|photo)\/\d{8,25}\/?$/;
const KURZ_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com']);
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);

function zeilen(wert) {
  const liste = Array.isArray(wert) ? wert : String(wert || '').split(/[\n,;]+/);
  return liste.map((z) => String(z || '').trim()).filter(Boolean);
}

function alsUrl(text) {
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

/** Kanonischer Video-Link oder null. Kurzlinks bleiben Kurzlinks, der Actor folgt ihnen. */
function videoLink(text) {
  const url = alsUrl(text);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (KURZ_HOSTS.has(host)) {
    const code = url.pathname.replace(/\/+$/, '');
    return /^\/[A-Za-z0-9]{5,20}$/.test(code) ? `https://${host}${code}/` : null;
  }
  if (!TIKTOK_HOSTS.has(host) || !VIDEO_PFAD_RE.test(url.pathname)) return null;
  return `https://www.tiktok.com${url.pathname.replace(/\/+$/, '')}`;
}

/** Username aus @name, name oder Profil-Link, sonst null. */
function profilName(text) {
  const roh = String(text || '').trim();
  let name = roh;
  if (/tiktok\.com/i.test(roh)) {
    const url = alsUrl(roh);
    const treffer = url && TIKTOK_HOSTS.has(url.hostname.toLowerCase())
      ? url.pathname.match(/^\/@([^/]+)\/?$/)
      : null;
    if (!treffer) return null;
    name = treffer[1];
  }
  name = name.replace(/^@/, '').toLowerCase();
  return USERNAME_RE.test(name) ? name : null;
}

function aufteilen(eintraege, pruefen) {
  const gueltig = [];
  const ungueltig = [];
  eintraege.forEach((e) => {
    const wert = pruefen(e);
    if (!wert) ungueltig.push(e);
    else if (!gueltig.includes(wert)) gueltig.push(wert);
  });
  return { gueltig, ungueltig };
}

function anzahlAus(wert) {
  const n = Math.floor(Number(wert));
  if (!Number.isFinite(n) || n < 1) return ANZAHL_STANDARD;
  return Math.min(n, ANZAHL_MAX);
}

/** ohneAngepinnte: angepinnte Videos sind alt und stark, im Views-Schnitt verzerren sie nur */
function actorInput({ videos, profile, anzahl }, { ohneAngepinnte = false } = {}) {
  return {
    postURLs: videos,
    profiles: profile,
    resultsPerPage: anzahl,
    profileScrapeSections: ['videos'],
    profileSorting: 'latest',
    excludePinnedPosts: ohneAngepinnte,
    scrapeRelatedVideos: false,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
  };
}

const auflisten = (liste) => liste.slice(0, 3).map((e) => `„${e.slice(0, 80)}“`).join(', ')
  + (liste.length > 3 ? ` und ${liste.length - 3} weitere` : '');

/**
 * @param {{ videos?: string|string[], profile?: string|string[], anzahl?: number }} body
 * @returns {{ ok: true, videos: string[], profile: string[], anzahl: number, input: object } | { ok: false, fehler: string }}
 */
function pruefeEingabe(body = {}) {
  const v = aufteilen(zeilen(body.videos), videoLink);
  const p = aufteilen(zeilen(body.profile), profilName);
  if (v.ungueltig.length) return { ok: false, fehler: `Kein TikTok-Video-Link: ${auflisten(v.ungueltig)}` };
  if (p.ungueltig.length) return { ok: false, fehler: `Kein TikTok-Profil: ${auflisten(p.ungueltig)}` };
  if (!v.gueltig.length && !p.gueltig.length) return { ok: false, fehler: 'Mindestens einen Video-Link oder ein Profil angeben.' };
  if (v.gueltig.length > MAX_VIDEOS) return { ok: false, fehler: `Höchstens ${MAX_VIDEOS} Video-Links pro Lauf.` };
  if (p.gueltig.length > MAX_PROFILE) return { ok: false, fehler: `Höchstens ${MAX_PROFILE} Profile pro Lauf.` };

  const anzahl = anzahlAus(body.anzahl);
  const auswahl = { videos: v.gueltig, profile: p.gueltig, anzahl };
  return { ok: true, ...auswahl, input: actorInput(auswahl) };
}

module.exports = {
  MAX_VIDEOS,
  MAX_PROFILE,
  ANZAHL_STANDARD,
  ANZAHL_MAX,
  videoLink,
  profilName,
  anzahlAus,
  actorInput,
  pruefeEingabe,
};
