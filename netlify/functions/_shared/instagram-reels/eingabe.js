// _shared/instagram-reels/eingabe.js
// Eingabe der Admin-Seite Instagram-CPM pruefen und in den Input des Apify-Actors
// apify/instagram-reel-scraper uebersetzen. Ein Profil pro Lauf.
//
// Angepinnte und Trial-Reels ueberspringt der Actor selbst. Die Einstellungen in der
// Apify-Konsole gelten fuer API-Laeufe nicht, deshalb stehen beide Flags hier.
// Die Anzahl liegt ueber 30, damit nach dem Vorfilter und abgewaehlten Ausreissern noch
// genug Reels zum Nachruecken da sind.

const ANZAHL_STANDARD = 50;
const ANZAHL_MIN = 12;
const ANZAHL_MAX = 60;

const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
// Erste Pfadsegmente, die kein Profil sind
const KEIN_PROFIL = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct']);

function alsUrl(text) {
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

/** Username aus @name, name oder Profil-Link (auch .../name/reels/), sonst null. */
function profilName(text) {
  const roh = String(text || '').trim();
  let name = roh;
  if (/instagram\.com/i.test(roh)) {
    const url = alsUrl(roh);
    if (!url || !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;
    const segment = url.pathname.split('/').filter(Boolean)[0] || '';
    if (KEIN_PROFIL.has(segment.toLowerCase())) return null;
    name = segment;
  }
  name = name.replace(/^@/, '').toLowerCase();
  return USERNAME_RE.test(name) && !/^\.|\.$|\.\./.test(name) ? name : null;
}

function anzahlAus(wert) {
  const n = Math.floor(Number(wert));
  if (!Number.isFinite(n) || n < 1) return ANZAHL_STANDARD;
  return Math.min(Math.max(n, ANZAHL_MIN), ANZAHL_MAX);
}

function actorInput({ profil, anzahl }) {
  return {
    username: [profil],
    resultsLimit: anzahl,
    skipPinnedPosts: true,
    skipTrialReels: true,
    includeSharesCount: false,
    includeTranscript: false,
    includeDownloadedVideo: false,
  };
}

/**
 * @param {{ profil?: string, anzahl?: number }} body
 * @returns {{ ok: true, profil: string, anzahl: number, input: object } | { ok: false, fehler: string }}
 */
function pruefeEingabe(body = {}) {
  const roh = String(body.profil || '').trim();
  if (!roh) return { ok: false, fehler: 'Ein Instagram-Profil angeben.' };
  const profil = profilName(roh);
  if (!profil) return { ok: false, fehler: `Kein Instagram-Profil: „${roh.slice(0, 80)}“` };
  const anzahl = anzahlAus(body.anzahl);
  return { ok: true, profil, anzahl, input: actorInput({ profil, anzahl }) };
}

module.exports = {
  ANZAHL_STANDARD,
  ANZAHL_MIN,
  ANZAHL_MAX,
  profilName,
  anzahlAus,
  actorInput,
  pruefeEingabe,
};
