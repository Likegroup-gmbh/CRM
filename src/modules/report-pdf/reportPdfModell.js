// reportPdfModell.js
// View-Model des Report-PDF aus dem Modell der Auswertung (baueModell): Kennzahlen fürs Deckblatt
// und je bestätigtem Post eine Kachel, nach Aufrufen sortiert. Alle Werte kommen fertig formatiert
// heraus, damit die Vorlage in der Function ohne Formatierer auskommt.
// Kosten stehen nie darin: das Report-PDF geht an den Kunden.

import { KENNZAHLEN, PLATTFORMEN } from '../auswertung/auswertungKonfig.js';
import { bestaetigtePosts, interaktionen } from '../auswertung/auswertungKennzahlen.js';
import { STANDARD_SORT, sortiertePosts } from '../auswertung/auswertungGruppen.js';
import { KACHELN, kachelSub, kachelWert as deckblattWert } from '../auswertung/auswertungKacheln.js';
import { postDatei } from '../auswertung/auswertungTabelle.js';
import { datum, kompakt, plural, wertNachArt } from '../auswertung/auswertungFormat.js';

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const FEED_WERTE = ['views', 'likes', 'comments', 'interaktionen'];

/** Vier Kennzahlen je Plattform, in dieser Reihenfolge auf der Kachel. */
export const KACHEL_WERTE = {
  ig_reel: FEED_WERTE,
  ig_post: FEED_WERTE,
  tiktok: FEED_WERTE,
  ig_story: ['views', 'reach', 'linkClicks', 'stickerTaps']
};

/** Kennzahlen des Deckblatts: dieselben Kacheln wie im Report, ohne Kosten. */
const DECKBLATT = KACHELN.filter(k => !k.preis);

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function monatVon(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  return m ? { jahr: Number(m[1]), monat: Number(m[2]) - 1 } : null;
}

/** „Nov 2026“, „Okt – Nov 2026“ oder „Dez 2025 – Jan 2026“ aus den Postdaten, sonst ''. */
export function zeitraumText(posts) {
  const monate = (posts || []).map(p => monatVon(p.postedAt)).filter(Boolean)
    .sort((a, b) => a.jahr - b.jahr || a.monat - b.monat);
  if (!monate.length) return '';
  const von = monate[0];
  const bis = monate[monate.length - 1];
  const voll = (m) => `${MONATE[m.monat]} ${m.jahr}`;
  if (von.jahr === bis.jahr && von.monat === bis.monat) return voll(von);
  if (von.jahr === bis.jahr) return `${MONATE[von.monat]} – ${voll(bis)}`;
  return `${voll(von)} – ${voll(bis)}`;
}

function kachelWert(post, key) {
  if (key === 'interaktionen') return { label: 'Interaktionen', wert: kompakt(interaktionen(post)) };
  return { label: KENNZAHLEN[key]?.label || key, wert: kompakt(zahl(post.metrics?.[key])) };
}

const mitAt = (handle) => (handle ? `@${String(handle).replace(/^@/, '')}` : '');

function kachel(post, einheit, posterUrls) {
  const datei = postDatei(einheit, post);
  const unterzeile = [mitAt(post.accountHandle || einheit?.creator?.handle), post.postedAt ? datum(post.postedAt) : '']
    .filter(Boolean).join(' · ');
  return {
    id: post.id,
    plattform: PLATTFORMEN[post.plattform]?.label || 'Post',
    creator: einheit?.creator?.name || 'Ohne Creator',
    unterzeile,
    posterUrl: (datei && posterUrls?.get(datei.id)) || null,
    werte: (KACHEL_WERTE[post.plattform] || FEED_WERTE).map(key => kachelWert(post, key))
  };
}

/**
 * Datei je bestätigtem Post, wie poster-urls sie erwartet: dateiId → { typ, id } (Asset-ID).
 * @param {object} modell - baueModell
 */
export function posterRefs(modell) {
  const refs = new Map();
  bestaetigtePosts(modell?.posts).forEach((post) => {
    const datei = postDatei(modell.einheitenById.get(post.einheitId), post);
    const item = datei?.item;
    const asset = item?.asset || item;
    if (item?.type && asset?.id) refs.set(datei.id, { typ: item.type, id: asset.id });
  });
  return refs;
}

function introText(anzahl, creator, zeitraum) {
  if (!anzahl) return 'Noch keine bestätigten Posts.';
  const wann = zeitraum ? `, gepostet ${zeitraum}` : '';
  return `${plural(anzahl, 'Post', 'Posts')} von ${plural(creator, 'Creator', 'Creatorn')}${wann}.`;
}

/**
 * @param {object} modell - baueModell
 * @param {{ titel?: string, untertitel?: string, kunde?: { name?: string, logoUrl?: string|null }|null,
 *   posterUrls?: Map<string, string> }} [kontext] - posterUrls: dateiId → https- oder data-URL
 */
export function reportPdfVm(modell, { titel = '', untertitel = '', kunde = null, posterUrls = new Map() } = {}) {
  const posts = sortiertePosts(modell?.posts || [], STANDARD_SORT);
  const einheit = (p) => modell.einheitenById.get(p.einheitId);
  const creator = new Set(posts.map(p => einheit(p)?.creator?.id || einheit(p)?.creator?.name || p.einheitId));
  const zeitraum = zeitraumText(posts);
  const k = modell?.kennzahlen || {};
  return {
    titel: titel || modell?.titel || 'Report',
    untertitel,
    kunde: kunde ? { name: kunde.name || '', logoUrl: kunde.logoUrl || null } : null,
    zeitraum,
    intro: introText(posts.length, creator.size, zeitraum),
    kennzahlen: posts.length
      ? DECKBLATT.map(d => ({ label: d.label, wert: wertNachArt(d.art, deckblattWert(d, k)), sub: kachelSub(d, k) }))
      : [],
    kacheln: posts.map(p => kachel(p, einheit(p), posterUrls))
  };
}
