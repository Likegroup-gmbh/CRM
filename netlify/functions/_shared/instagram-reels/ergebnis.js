// _shared/instagram-reels/ergebnis.js
// Dataset-Items des Actors apify/instagram-reel-scraper fuer die Admin-Seite Instagram-CPM:
// Reels normalisieren und vorfiltern. Was hier faellt, landet in `gefiltert` mit Grund und
// zaehlt nie mit; alles andere ist Kandidat fuers Grid, neueste zuerst.
//
// Vorfilter-Regeln (ADR 0087):
// - angepinnt: auch wenn der Actor sie schon ueberspringt
// - collab: Co-Autor-Reel mit einem fremden Account, auch ohne Werbung. Die Reichweite
//   beider Accounts laeuft zusammen und sagt nichts ueber den Creator allein.
// - werbung_verlinkt: Werbe-Kennzeichnung (Caption oder Paid-Partnership-Label) UND ein
//   fremder Account ist verlinkt (@mention, Tag, Sponsor, Co-Autor). Steht nur "Anzeige"
//   ohne Verlinkung da, zaehlt das Reel mit und bekommt nur ein Badge.
// Eine Altersregel gibt es bewusst nicht: auch das neueste Reel ist Kandidat.

const { istWerbePost } = require('../instagram-cpm');
const { bildPfad } = require('./bildSignatur');

const zahlOderNull = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const textOderNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const name = (v) => (typeof v === 'string' ? v : v?.username)?.trim().replace(/^@/, '').toLowerCase() || null;
// Mentions im Text, ohne E-Mail-Adressen (name@domain)
const CAPTION_MENTION_RE = /(?<![\w.])@([A-Za-z0-9._]{1,30})/g;

const FILTER_TEXT = {
  kein_video: 'Kein Video',
  keine_views: 'Keine Views',
  angepinnt: 'Angepinnt',
  collab: 'Collab mit anderem Account',
  werbung_verlinkt: 'Werbung mit Verlinkung',
};

function namen(liste) {
  return (Array.isArray(liste) ? liste : []).map(name).filter(Boolean);
}

function captionMentions(caption) {
  return [...String(caption || '').matchAll(CAPTION_MENTION_RE)].map((m) => m[1].replace(/\.+$/, '').toLowerCase());
}

const fremde = (liste, owner) => [...new Set(liste)].filter((n) => n && n !== owner);

function istVideo(item) {
  return item.type === 'Video' || item.productType === 'clips';
}

function filterGrund(item, reel) {
  if (!istVideo(item)) return 'kein_video';
  if (reel.views == null) return 'keine_views';
  if (item.isPinned === true) return 'angepinnt';
  if (reel.collab.length) return 'collab';
  if (reel.werbung && reel.verlinkt.length) return 'werbung_verlinkt';
  return null;
}

/** Ein Dataset-Item als Reel fuers Grid. env liefert den Schluessel fuer die Bild-Signatur. */
function reelAusItem(item, env = process.env) {
  const owner = name(item.ownerUsername);
  const caption = typeof item.caption === 'string' ? item.caption : '';
  const collab = fremde(namen(item.coauthorProducers), owner);
  const verlinkt = fremde([
    ...namen(item.mentions),
    ...captionMentions(caption),
    ...namen(item.taggedUsers),
    ...namen(item.sponsors),
    ...collab,
  ], owner);
  const shortCode = textOderNull(item.shortCode);
  const views = zahlOderNull(item.videoPlayCount) ?? zahlOderNull(item.videoViewCount);
  const reel = {
    id: String(item.id || shortCode || ''),
    shortCode,
    url: shortCode ? `https://www.instagram.com/reel/${shortCode}/` : textOderNull(item.url),
    datum: textOderNull(item.timestamp),
    views,
    viewsAlt: zahlOderNull(item.videoViewCount),
    likes: zahlOderNull(item.likesCount),
    kommentare: zahlOderNull(item.commentsCount),
    dauer: zahlOderNull(item.videoDuration),
    bild: bildPfad(textOderNull(item.displayUrl) || textOderNull(item.images?.[0]), env),
    caption,
    werbung: istWerbePost(caption) || (item.paidPartnership === true ? 'paid partnership' : null),
    verlinkt,
    collab,
    filter: null,
    filterText: null,
  };
  reel.filter = filterGrund(item, reel);
  reel.filterText = reel.filter ? FILTER_TEXT[reel.filter] : null;
  return reel;
}

// Fehler-Items tragen error (z. B. no_items, not_found) und keine id
const istFehlerItem = (item) => !!textOderNull(item.error) && !item.id;

function fehlerZeile(item) {
  return {
    eingabe: textOderNull(item.input) || textOderNull(item.inputUrl) || textOderNull(item.url),
    code: String(item.error),
    text: textOderNull(item.errorDescription) || String(item.error),
  };
}

const zeit = (reel) => Date.parse(reel.datum || '') || 0;

/**
 * @returns {{ profil: object|null, reels: object[], gefiltert: object[], fehler: object[] }}
 * reels sind die Kandidaten, neueste zuerst; gefiltert hat filter und filterText.
 */
function auswerten(items, env = process.env) {
  const reels = [];
  const gefiltert = [];
  const fehler = [];
  const gesehen = new Set();
  let profil = null;
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (istFehlerItem(item)) {
      fehler.push(fehlerZeile(item));
      return;
    }
    const reel = reelAusItem(item, env);
    if (gesehen.has(reel.id)) return;
    gesehen.add(reel.id);
    (reel.filter ? gefiltert : reels).push(reel);
    const owner = name(item.ownerUsername);
    if (!profil && owner) {
      profil = { name: owner, vollName: textOderNull(item.ownerFullName), url: `https://www.instagram.com/${owner}/` };
    }
  });
  const neuesteZuerst = (a, b) => zeit(b) - zeit(a);
  return { profil, reels: reels.sort(neuesteZuerst), gefiltert: gefiltert.sort(neuesteZuerst), fehler };
}

module.exports = { FILTER_TEXT, captionMentions, reelAusItem, fehlerZeile, auswerten };
