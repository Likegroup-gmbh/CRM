// Netlify Function: kooperation-video-stats
// Holt Views, Likes und Kommentare zu einem veroeffentlichten Kampagnen-Video
// und schreibt sie in public.kooperation_videos (Haekchen-Button neben dem
// Live-Link in der Kooperationen-Video-Tabelle).
//
// POST { video_id: '<uuid>' }
//   -> Business Discovery kennt keine Suche per Permalink: der Einstieg ist
//      immer ein Username. Deshalb kommt der Handle vom Creator der Kooperation
//      (creator.instagram) und der Shortcode aus dem Live-Link; gematcht wird
//      ueber den permalink der Media-Liste.
//   -> Frisch gepostete Videos stehen ganz oben, der Normalfall ist also ein
//      einziger Graph-Call. Erst wenn der Shortcode dort fehlt, wird ueber den
//      after-Cursor nachgeladen.
//   -> Kein Cache: die Zahlen wachsen laufend, jeder Klick holt frisch.
//
// Saves gibt es hier nicht: Metas Insights-Endpoint liefert "saved" nur fuer
// Medien auf Accounts, fuer die wir einen Page-Token haben.
//
// Auth: Supabase Bearer-Token. Meta-Token bleibt serverseitig.

const { createClient } = require('@supabase/supabase-js');
const {
  graphGet,
  normalizeUsername,
  isValidUsername,
  isRateLimitError
} = require('./_shared/instagram-graph');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAGE_SIZE = 50;
// 300 Beitraege: die media-Edge liefert chronologisch, gepinnte Posts stehen im
// Grid oben, koennen aber deutlich aelter sein. Sechs sequentielle Graph-Calls
// bleiben klar unter dem 26s-Function-Timeout.
const MAX_PAGES = 6;

// Identisch zu sourcing-instagram-stats: media_product_type und
// is_shared_to_feed sind fuer Business Discovery nicht verfuegbar und lassen
// den ganzen Call scheitern (Fehlercode 100).
const MEDIA_FIELDS = 'id,media_type,view_count,like_count,'
  + 'comments_count,timestamp,permalink';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

/**
 * Shortcode aus einem Instagram-Link ziehen.
 * https://www.instagram.com/reel/DABC123/?igsh=... -> 'DABC123'
 * Reels laufen je nach Herkunft unter /reel/, /reels/, /p/ oder /tv/.
 */
function extractShortcode(link) {
  const raw = String(link || '').trim();
  if (!raw) return null;
  const match = raw.match(/instagram\.com\/(?:[^/]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

/** Steckt der Shortcode in diesem permalink? */
function matchesShortcode(permalink, shortcode) {
  return extractShortcode(permalink) === shortcode;
}

/**
 * Media-Liste des Creators durchgehen, bis der Shortcode auftaucht.
 * Abbruch nach dem Treffer - der Normalfall kostet damit einen Graph-Call.
 */
async function findMediaByShortcode(username, shortcode) {
  const igUserId = process.env.META_IG_USER_ID;
  let after = null;
  let gesehen = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const edge = after
      ? `media.limit(${PAGE_SIZE}).after(${after}){${MEDIA_FIELDS}}`
      : `media.limit(${PAGE_SIZE}){${MEDIA_FIELDS}}`;

    let data;
    try {
      data = await graphGet(igUserId, {
        fields: `business_discovery.username(${username}){${edge}}`
      });
    } catch (err) {
      // Fehler auf Folgeseiten: mit dem arbeiten was da ist, statt den ganzen
      // Abruf zu kippen - der Treffer kann auf einer frueheren Seite liegen
      if (page > 0) {
        console.warn(`⚠️ kooperation-video-stats: Seite ${page} @${username} fehlgeschlagen:`, err.message);
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
    error: `Video nicht in den letzten ${gesehen} Beitraegen von @${username} gefunden`,
    error_code: null,
    rate_limited: false
  };
}

/** Fehler an der Zeile vermerken, damit der Button den Grund anzeigen kann */
async function markError(supabase, videoId, message) {
  await supabase
    .from('kooperation_videos')
    .update({ stats_error: message })
    .eq('id', videoId);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse(500, { error: 'Supabase-Env fehlt (SUPABASE_URL / SUPABASE_SERVICE_KEY)' });
  }

  const auth = await verifyAuth(event);
  if (!auth.user) {
    return jsonResponse(401, authErrorBody(auth));
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Ungültiger JSON-Body' });
  }

  const videoId = body.video_id;
  if (!videoId) {
    return jsonResponse(400, { error: 'video_id fehlt' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: video, error: loadError } = await supabase
    .from('kooperation_videos')
    .select('id, link_live, kooperation_id')
    .eq('id', videoId)
    .single();
  if (loadError || !video) {
    return jsonResponse(404, { error: 'Video nicht gefunden' });
  }

  const shortcode = extractShortcode(video.link_live);
  if (!shortcode) {
    const msg = 'Kein gültiger Instagram-Link hinterlegt (erwartet /reel/, /p/ oder /tv/)';
    await markError(supabase, videoId, msg);
    return jsonResponse(400, { error: msg });
  }

  // Business Discovery braucht einen Username als Einstieg - der Reel-Link
  // allein gibt ihn nicht her, also kommt er vom Creator der Kooperation.
  const { data: koop } = await supabase
    .from('kooperationen')
    .select('id, creator_id, creator:creator_id(id, instagram)')
    .eq('id', video.kooperation_id)
    .maybeSingle();

  const username = normalizeUsername(koop?.creator?.instagram);
  if (!isValidUsername(username)) {
    const msg = 'Beim Creator ist kein Instagram-Profil hinterlegt – Zahlen bitte von Hand eintragen';
    await markError(supabase, videoId, msg);
    return jsonResponse(400, { error: msg, hint: msg });
  }

  if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
    return jsonResponse(500, { error: 'Meta-Env fehlt (META_ACCESS_TOKEN / META_IG_USER_ID)' });
  }

  const res = await findMediaByShortcode(username, shortcode);
  if (!res.ok) {
    await markError(supabase, videoId, res.error);

    if (res.rate_limited) {
      return jsonResponse(429, {
        error: res.error,
        error_code: res.error_code,
        retryable: true,
        hint: 'Meta-Rate-Limit erreicht – später erneut versuchen.'
      });
    }

    return jsonResponse(502, {
      error: res.error,
      error_code: res.error_code,
      hint: res.not_found
        ? `Bei @${username} taucht es nicht auf: entweder liegt es unter einem anderen Profil (z.B. Collab mit der Marke) oder es ist ein gepinnter, chronologisch aelterer Beitrag. Zahlen dann von Hand eintragen.`
        : (res.error_code === 190
          ? 'META_ACCESS_TOKEN ist abgelaufen oder ungültig – neuen Long-Lived Token hinterlegen.'
          : 'Profil nicht via API abrufbar – kein Business-/Creator-Account oder Handle falsch.')
    });
  }

  const m = res.media;
  const { data: updated, error: updateError } = await supabase
    .from('kooperation_videos')
    .update({
      stats_views: m.view_count ?? null,
      stats_likes: m.like_count ?? null,
      stats_comments: m.comments_count ?? null,
      stats_fetched_at: new Date().toISOString(),
      stats_error: null,
      stats_raw: {
        media_id: m.id,
        media_type: m.media_type || null,
        permalink: m.permalink || null,
        timestamp: m.timestamp || null,
        username,
        shortcode
      }
    })
    .eq('id', videoId)
    .select('id, link_live, stats_views, stats_likes, stats_comments, stats_fetched_at, stats_error')
    .single();
  if (updateError) {
    return jsonResponse(500, { error: `Speichern fehlgeschlagen: ${updateError.message}` });
  }

  return jsonResponse(200, {
    ok: true,
    video_id: videoId,
    username,
    shortcode,
    video: updated,
    stats: {
      views: updated.stats_views,
      likes: updated.stats_likes,
      comments: updated.stats_comments
    }
  });
};
