// socialLink.js
// Live-Links der Kooperationen-Videos lesbar machen. Eine Roh-URL wie
// https://www.instagram.com/reel/DABC123/?igsh=xyz ist in einer Tabellenzelle
// wertlos - sichtbar bleibt nur "https://www.instagra". Stattdessen zeigt die
// Zelle "Reel · @handle" und haelt die URL im Input darunter.
//
// Das Shortcode-Parsing spiegelt netlify/functions/kooperation-video-stats.js
// (extractShortcode), erweitert um den Typ: Reels laufen je nach Herkunft unter
// /reel/, /reels/, /p/ oder /tv/, und bei Profil-Permalinks steckt noch ein
// Segment davor (/username/reel/CODE).

const INSTAGRAM_PATTERN = /instagram\.com\/(?:[^/?#]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]+)/i;
const TIKTOK_PATTERN = /tiktok\.com\/(?:@[^/?#]+\/)?(video|photo)\/(\d+)/i;

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

/**
 * Zerlegt einen Live-Link in Plattform, Beitragsart und Shortcode.
 * Unbekannte URLs liefern nur den Host, damit die Zelle trotzdem etwas
 * Lesbares anzeigen kann.
 */
export function parseSocialLink(url) {
  const raw = String(url || '').trim();
  const empty = { platform: null, type: null, shortcode: null, host: null };
  if (!raw) return empty;

  const host = extractHost(raw);

  const instagram = raw.match(INSTAGRAM_PATTERN);
  if (instagram) {
    return {
      platform: 'instagram',
      type: normalizeInstagramType(instagram[1]),
      shortcode: instagram[2],
      host: host || 'instagram.com'
    };
  }

  const tiktok = raw.match(TIKTOK_PATTERN);
  if (tiktok) {
    return {
      platform: 'tiktok',
      type: tiktok[1].toLowerCase(),
      shortcode: tiktok[2],
      host: host || 'tiktok.com'
    };
  }

  if (/instagram\.com/i.test(raw)) {
    return { platform: 'instagram', type: null, shortcode: null, host: host || 'instagram.com' };
  }
  if (/tiktok\.com/i.test(raw)) {
    return { platform: 'tiktok', type: null, shortcode: null, host: host || 'tiktok.com' };
  }

  return { ...empty, host };
}

/**
 * Beschriftung des Link-Chips. Der Handle des Creators ist die nuetzlichere
 * zweite Haelfte, weil man beim Ueberfliegen der Tabelle sehen will, wessen
 * Reel da haengt. Ohne Handle bleibt der Shortcode als Unterscheidungsmerkmal.
 *
 * "Reel · @paulinemary" / "Reel · DABC123" / "instagram.com" / "" (kein Link)
 */
export function formatLinkLabel(url, handle) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const { type, shortcode, host } = parseSocialLink(raw);
  const kind = TYPE_LABELS[type] || null;
  const cleanHandle = String(handle || '').trim().replace(/^@+/, '');
  const detail = cleanHandle ? `@${cleanHandle}` : shortcode || null;

  if (kind && detail) return `${kind} · ${detail}`;
  if (kind) return kind;
  if (host && detail) return `${host} · ${detail}`;
  if (host) return host;
  return raw;
}
