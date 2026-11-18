// _shared/instagram-post-abruf.js
// Zahlen eines Instagram-Beitrags über Meta Business Discovery (post-link-abruf).
//
// Business Discovery kennt keine Suche per Permalink: der Einstieg ist immer ein Username,
// gematcht wird über den Shortcode im permalink der Media-Liste. Frisch gepostete Beiträge
// stehen oben, der Normalfall ist also ein Graph-Call; erst wenn der Shortcode fehlt, wird über
// den after-Cursor nachgeladen. Kein Cache: die Zahlen wachsen laufend.
//
// Geliefert werden nur Aufrufe, Likes und Kommentare. Stories, Reichweite, Geteilt und
// Gespeichert gibt es hier nicht (Insights brauchen einen Page-Token des Creators); die kommen
// über den Screenshot (ADR 0078).

const { graphGet, isRateLimitError } = require('./instagram-graph');

const PAGE_SIZE = 50;
// 300 Beiträge: die media-Edge liefert chronologisch, gepinnte Posts stehen im Grid oben,
// können aber deutlich älter sein. Sechs sequentielle Graph-Calls bleiben klar unter dem
// 26s-Function-Timeout.
const MAX_PAGES = 6;

// media_product_type und is_shared_to_feed sind für Business Discovery nicht verfügbar und
// lassen den ganzen Call scheitern (Fehlercode 100).
const MEDIA_FIELDS = 'id,media_type,view_count,like_count,comments_count,timestamp,permalink';

/**
 * Shortcode aus einem Instagram-Link. Reels laufen je nach Herkunft unter /reel/, /reels/,
 * /p/ oder /tv/, bei Profil-Permalinks steht der Username davor.
 * https://www.instagram.com/reel/DABC123/?igsh=... -> 'DABC123'
 */
function extractShortcode(link) {
  const raw = String(link || '').trim();
  if (!raw) return null;
  const match = raw.match(/instagram\.com\/(?:[^/]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

const matchesShortcode = (permalink, shortcode) => extractShortcode(permalink) === shortcode;

/**
 * Media-Liste des Accounts durchgehen, bis der Shortcode auftaucht.
 * @param {(path: string, params: object) => Promise<object>} [graph] - für Tests
 */
async function findMediaByShortcode(username, shortcode, graph = graphGet) {
  const igUserId = process.env.META_IG_USER_ID;
  let after = null;
  let gesehen = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const edge = after
      ? `media.limit(${PAGE_SIZE}).after(${after}){${MEDIA_FIELDS}}`
      : `media.limit(${PAGE_SIZE}){${MEDIA_FIELDS}}`;

    let data;
    try {
      data = await graph(igUserId, { fields: `business_discovery.username(${username}){${edge}}` });
    } catch (err) {
      // Fehler auf Folgeseiten: mit dem arbeiten, was da ist; der Treffer kann früher liegen
      if (page > 0) {
        console.warn(`⚠️ instagram-post-abruf: Seite ${page} @${username} fehlgeschlagen:`, err.message);
        break;
      }
      return {
        ok: false,
        error: err.meta?.message || err.message,
        error_code: err.meta?.code ?? null,
        rate_limited: isRateLimitError(err.meta)
      };
    }

    const bd = data.business_discovery || {};
    const media = bd.media?.data || [];
    gesehen += media.length;

    const treffer = media.find((m) => matchesShortcode(m?.permalink, shortcode));
    if (treffer) return { ok: true, media: treffer, geprueft: gesehen };

    after = bd.media?.paging?.cursors?.after || null;
    if (!after) break;
  }

  return {
    ok: false,
    not_found: true,
    error: `Beitrag nicht in den letzten ${gesehen} Beiträgen von @${username} gefunden`,
    error_code: null,
    rate_limited: false
  };
}

/** Hinweis für die Oberfläche zu einem fehlgeschlagenen Abruf. */
function abrufHinweis(res, username) {
  if (res.rate_limited) return 'Meta-Rate-Limit erreicht – später erneut versuchen.';
  if (res.not_found) {
    return `Bei @${username} taucht der Beitrag nicht auf: entweder liegt er unter einem anderen Profil `
      + '(z. B. Collab mit der Marke, dann den Account am Post eintragen) oder es ist ein gepinnter, älterer Beitrag. '
      + 'Zahlen dann per Screenshot oder von Hand eintragen.';
  }
  if (res.error_code === 190) return 'META_ACCESS_TOKEN ist abgelaufen oder ungültig – neuen Long-Lived Token hinterlegen.';
  return 'Profil nicht über die API abrufbar – kein Business-/Creator-Account oder Handle falsch.';
}

/** Aufrufe, Likes, Kommentare aus dem Media-Objekt; was Meta nicht liefert, fehlt. */
function kennzahlenAusMedia(m) {
  const out = {};
  const setze = (key, wert) => { if (typeof wert === 'number' && Number.isFinite(wert)) out[key] = wert; };
  setze('views', m?.view_count);
  setze('likes', m?.like_count);
  setze('comments', m?.comments_count);
  return out;
}

/** Bild und Karussell sind Posts, alles andere (VIDEO) ein Reel. */
function plattformAusMedia(m, bisher) {
  if (m?.media_type === 'IMAGE' || m?.media_type === 'CAROUSEL_ALBUM') return 'ig_post';
  if (m?.media_type === 'VIDEO') return 'ig_reel';
  return bisher;
}

module.exports = {
  MEDIA_FIELDS,
  extractShortcode,
  findMediaByShortcode,
  abrufHinweis,
  kennzahlenAusMedia,
  plattformAusMedia
};
