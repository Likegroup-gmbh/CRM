// sourcingProfilPlattformen.js
// Wo der Profilabruf im Casting je Plattform seine Felder hat. Zelle, Hover-Toolbar, Drawer und
// das Abruf-Mixin (CastingDetailProfilAbruf.js) lesen nur hier: Instagram und TikTok laufen durch
// denselben Code, nur die Feldnamen und Texte unterscheiden sich. Dazu die Erkennung, in welches
// Feld ein eingefuegter Link gehoert (linkZiel).

import { parseSocialLink } from '../../core/format/socialLink.js';

export const PROFIL_PLATTFORMEN = Object.freeze({
  instagram: Object.freeze({
    plattform: 'instagram',
    name: 'Instagram',
    linkFeld: 'link_instagram',
    fehlerFeld: 'ig_fetch_error',
    standFeld: 'ig_fetched_at',
    statsFeld: 'ig_stats',
    toolbar: 'sourcing-instagram',
    platzhalter: 'IG Link...',
    handler: 'handleInstagramFetch',
  }),
  tiktok: Object.freeze({
    plattform: 'tiktok',
    name: 'TikTok',
    linkFeld: 'link_tiktok',
    fehlerFeld: 'tt_fetch_error',
    standFeld: 'tt_fetched_at',
    statsFeld: 'tt_stats',
    toolbar: 'sourcing-tiktok',
    platzhalter: 'TT Link...',
    handler: 'handleTiktokFetch',
  }),
});

export function profilPlattform(plattform) {
  const p = PROFIL_PLATTFORMEN[plattform];
  if (!p) throw new Error(`Unbekannte Plattform: ${plattform}`);
  return p;
}

/** Bestaetigter Handle aus dem letzten Abruf vor dem aus dem Link: der Pfad einer getippten URL kann veraltet sein. */
export function profilHandle(item, plattform) {
  const p = profilPlattform(plattform);
  return item?.[p.statsFeld]?.username || parseSocialLink(item?.[p.linkFeld]).handle || '';
}

export const formatStand = (wert) => new Date(wert).toLocaleString('de-DE');

/** Plattform eines Link-Feldes ('link_instagram' -> 'instagram'), sonst null */
export function plattformDesFelds(feld) {
  return Object.values(PROFIL_PLATTFORMEN).find(p => p.linkFeld === feld)?.plattform || null;
}

/** Profil-URL, wie Schnelleingabe und Link-Zelle sie speichern */
export function profilUrl(plattform, handle) {
  const name = String(handle || '').replace(/^@/, '').toLowerCase();
  return plattform === 'tiktok' ? `https://www.tiktok.com/@${name}` : `https://www.instagram.com/${name}/`;
}

// Video- und Share-Links tragen den Handle im Pfad: tiktok.com/@name/video/123?_r=1
const TIKTOK_AUTOR = /tiktok\.com\/@([\w.]+)/i;

/**
 * Wohin ein eingetragener Link gehoert. Ein TikTok-Link im Instagram-Feld landet bei TikTok und
 * umgekehrt. Profil-Links (bei TikTok auch Video-Links) werden zur Profil-URL, denn der Abruf
 * braucht das Profil. Reine Handles und unbekannte Links bleiben, wie sie eingegeben wurden.
 * @returns {{ feld: string, wert: string|null, plattform: string|null }}
 */
export function linkZiel(feld, wert) {
  const eigene = plattformDesFelds(feld);
  if (!eigene || !wert) return { feld, wert, plattform: eigene };
  const parsed = parseSocialLink(wert);
  const ziel = PROFIL_PLATTFORMEN[parsed.platform];
  if (!ziel) return { feld, wert, plattform: eigene };
  const handle = parsed.type === 'profile'
    ? parsed.handle
    : parsed.platform === 'tiktok' && String(wert).match(TIKTOK_AUTOR)?.[1];
  return { feld: ziel.linkFeld, wert: handle ? profilUrl(ziel.plattform, handle) : wert, plattform: ziel.plattform };
}

/**
 * Abrufzustand einer Zeile: leer (kein Link), fehler, abgerufen oder offen.
 * @returns {{ zustand: 'leer'|'fehler'|'abgerufen'|'offen', fehler: string|null, stand: string|null }}
 */
export function abrufZustand(item, plattform) {
  const p = profilPlattform(plattform);
  const fehler = item?.[p.fehlerFeld] || null;
  const stand = item?.[p.standFeld] || null;
  if (!item?.[p.linkFeld]) return { zustand: 'leer', fehler, stand };
  if (fehler) return { zustand: 'fehler', fehler, stand };
  return { zustand: stand ? 'abgerufen' : 'offen', fehler: null, stand };
}
