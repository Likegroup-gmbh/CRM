// socialLink.js
// Social-Links in Tabellenzellen lesbar machen. Eine Roh-URL wie
// https://www.instagram.com/reel/DABC123/?igsh=xyz ist in einer Zelle wertlos -
// sichtbar bleibt nur "https://www.instagra". Stattdessen zeigt die Zelle
// "Reel · @handle" und haelt die URL im Input darunter.
//
// Zwei Arten von Links kommen vor:
//   Beitrag - Live-Link der Kooperationen-Videos (/reel/CODE)
//   Profil  - Creator-Link im Sourcing (/paulinemary)
//
// Das Shortcode-Parsing spiegelt netlify/functions/kooperation-video-stats.js
// (extractShortcode), erweitert um den Typ: Reels laufen je nach Herkunft unter
// /reel/, /reels/, /p/ oder /tv/, und bei Profil-Permalinks steckt noch ein
// Segment davor (/username/reel/CODE).

import { normalizeUrl } from '../UrlHelper.js';

const INSTAGRAM_PATTERN = /instagram\.com\/(?:[^/?#]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]+)/i;
const TIKTOK_PATTERN = /tiktok\.com\/(?:@[^/?#]+\/)?(video|photo)\/(\d+)/i;

// Zeichenvorrat und Laenge wie isValidUsername in
// netlify/functions/_shared/instagram-graph.js, damit Frontend und Abruf
// denselben Handle-Begriff haben. Kein weiteres Pfad-Segment danach: bei
// /paulinemary/tagged/ ist der Handle nicht mehr die Aussage der URL.
const INSTAGRAM_PROFILE = /instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#]|$)/i;
const TIKTOK_PROFILE = /tiktok\.com\/@([A-Za-z0-9._]{1,30})\/?(?:[?#]|$)/i;

// Diese Pfade sehen wie ein Handle aus, sind aber Instagram-eigene Seiten.
const RESERVIERTE_PFADE = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'direct', 'accounts', 'about'
]);

const TYPE_LABELS = {
  reel: 'Reel',
  post: 'Post',
  tv: 'IGTV',
  video: 'Video',
  photo: 'Foto'
};

function normalizeInstagramType(raw) {
  const type = String(raw || '').toLowerCase();
  if (type === 'reel' || type === 'reels') return 'reel';
  if (type === 'p') return 'post';
  if (type === 'tv') return 'tv';
  return null;
}

function extractHost(url) {
  const match = String(url).match(/^(?:https?:)?\/\/([^/?#]+)/i);
  if (!match) return null;
  return match[1].replace(/^www\./i, '').toLowerCase();
}

function matchProfile(raw, pattern) {
  const match = raw.match(pattern);
  if (!match) return null;
  const handle = match[1];
  if (RESERVIERTE_PFADE.has(handle.toLowerCase())) return null;
  return handle;
}

/**
 * Zerlegt einen Social-Link in Plattform, Art, Shortcode und Handle.
 * Beitrags-Muster gehen vor: /paulinemary/reel/CODE ist ein Reel, kein Profil.
 * Unbekannte URLs liefern nur den Host, damit die Zelle trotzdem etwas
 * Lesbares anzeigen kann.
 */
export function parseSocialLink(url) {
  const raw = String(url || '').trim();
  const empty = { platform: null, type: null, shortcode: null, handle: null, host: null };
  if (!raw) return empty;

  const host = extractHost(raw);

  const instagram = raw.match(INSTAGRAM_PATTERN);
  if (instagram) {
    return {
      platform: 'instagram',
      type: normalizeInstagramType(instagram[1]),
      shortcode: instagram[2],
      handle: null,
      host: host || 'instagram.com'
    };
  }

  const tiktok = raw.match(TIKTOK_PATTERN);
  if (tiktok) {
    return {
      platform: 'tiktok',
      type: tiktok[1].toLowerCase(),
      shortcode: tiktok[2],
      handle: null,
      host: host || 'tiktok.com'
    };
  }

  const igProfile = matchProfile(raw, INSTAGRAM_PROFILE);
  if (igProfile) {
    return {
      platform: 'instagram',
      type: 'profile',
      shortcode: null,
      handle: igProfile,
      host: host || 'instagram.com'
    };
  }

  const ttProfile = matchProfile(raw, TIKTOK_PROFILE);
  if (ttProfile) {
    return {
      platform: 'tiktok',
      type: 'profile',
      shortcode: null,
      handle: ttProfile,
      host: host || 'tiktok.com'
    };
  }

  if (/instagram\.com/i.test(raw)) {
    return { ...empty, platform: 'instagram', host: host || 'instagram.com' };
  }
  if (/tiktok\.com/i.test(raw)) {
    return { ...empty, platform: 'tiktok', host: host || 'tiktok.com' };
  }

  return { ...empty, host };
}

const BARE_HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;
const PROFILE_BASE = {
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/@'
};

/**
 * Absolute, klickbare URL fuer einen gespeicherten Social-Wert.
 * In der DB steht mal eine URL, mal nur ein Handle ("elnimabella", "@name").
 * Ein Handle als href waere ein relativer Link: ein Klick oeffnet dann
 * /castings/elnimabella in der App statt das Profil. Nicht-http(s)-Schemas
 * (javascript:, data:) werden verworfen.
 * @param {string} value URL oder Handle
 * @param {'instagram'|'tiktok'} platform Plattform fuer reine Handles
 * @returns {string} absolute URL oder '' wenn unbrauchbar
 */
export function socialHref(value, platform) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const looksLikeUrl = /^https?:\/\//i.test(raw) || /instagram\.com|tiktok\.com|^www\.|\//i.test(raw);
  if (!looksLikeUrl && BARE_HANDLE.test(raw) && PROFILE_BASE[platform]) {
    return `${PROFILE_BASE[platform]}${raw.replace(/^@/, '')}`;
  }
  return normalizeUrl(raw);
}

/**
 * Beschriftung des Link-Chips. Der Handle des Creators ist die nuetzlichere
 * zweite Haelfte, weil man beim Ueberfliegen der Tabelle sehen will, wessen
 * Reel da haengt. Ohne Handle bleibt der Shortcode als Unterscheidungsmerkmal.
 *
 * "Reel · @paulinemary" / "Reel · DABC123" / "@paulinemary" (Profil) /
 * "instagram.com" / "" (kein Link)
 */
export function formatLinkLabel(url, handle) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const { type, shortcode, handle: urlHandle, host } = parseSocialLink(raw);
  const kind = TYPE_LABELS[type] || null;
  const cleanHandle = String(handle || '').trim().replace(/^@+/, '') || urlHandle || '';
  const detail = cleanHandle ? `@${cleanHandle}` : shortcode || null;

  // Ein Profil-Link ist der Handle - "instagram.com · @name" waere doppelt.
  if (type === 'profile' && detail) return detail;

  if (kind && detail) return `${kind} · ${detail}`;
  if (kind) return kind;
  if (host && detail) return `${host} · ${detail}`;
  if (host) return host;
  return raw;
}
