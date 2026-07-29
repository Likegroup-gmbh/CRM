// Netlify Function: sourcing-instagram-stats
// Holt Instagram-Daten fuer eine Sourcing-Zeile via Meta Business Discovery
// und schreibt Name, Follower, Reichweite und die CPM-Werte direkt in
// public.creator_auswahl_items (Haekchen-Button neben dem Instagram-Link).
//
// POST { item_id: '<uuid>' }
//   -> laedt Profil + bis zu 100 Medien (zwei Seiten a 50), filtert auf Reels
//      die aelter als 4 Tage sind und berechnet daraus den 8er-, 30er- und
//      getrimmten Views-Schnitt sowie den jeweiligen CPM-Preis.
//      Das Profilbild wird als WebP nach Supabase Storage kopiert, da Metas
//      CDN-URLs nach wenigen Tagen ablaufen.
//
// Auth: Supabase Bearer-Token. Meta-Token bleibt serverseitig.

const { createClient } = require('@supabase/supabase-js');
const {
  graphGet,
  normalizeUsername,
  isValidUsername,
  isRateLimitError,
  storeImage
} = require('./_shared/instagram-graph');
const { computeInstagramCpm, WINDOW_LONG } = require('./_shared/instagram-cpm');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_KEY = SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const PAGE_SIZE = 50;
const MAX_PAGES = 2;   // 26s Function-Timeout, mehr ist nicht drin

const PROFILE_FIELDS = 'username,name,followers_count,media_count,profile_picture_url,biography';
// Bewusst ohne media_product_type: fuer Business Discovery ist das Feld nicht
// als public dokumentiert und ein abgelehntes Feld laesst den ganzen Call
// scheitern. Zum Trennen von Reels und Bildern reicht media_type.
const MEDIA_FIELDS = 'id,media_type,view_count,like_count,'
  + 'comments_count,timestamp,permalink,thumbnail_url';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

async function verifyAuth(event) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createClient(SUPABASE_URL, AUTH_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Profil + Medien laden. Da zwischen den Reels auch Bilder und Karussells
 * liegen, die keinen view_count haben, reicht eine Seite oft nicht fuer 30
 * auswertbare Videos - dann wird ueber den after-Cursor nachgeladen.
 */
async function fetchProfileWithMedia(username) {
  const igUserId = process.env.META_IG_USER_ID;
  let profile = null;
  let media = [];
  let after = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const mediaEdge = after
      ? `media.limit(${PAGE_SIZE}).after(${after}){${MEDIA_FIELDS}}`
      : `media.limit(${PAGE_SIZE}){${MEDIA_FIELDS}}`;
    // Profilfelder nur auf der ersten Seite - danach zaehlt nur noch media
    const inner = page === 0 ? `${PROFILE_FIELDS},${mediaEdge}` : mediaEdge;

    let data;
    try {
      data = await graphGet(igUserId, {
        fields: `business_discovery.username(${username}){${inner}}`
      });
    } catch (err) {
      // Fehler auf Folgeseiten sind nicht fatal: mit dem was da ist rechnen
      if (page > 0) {
        console.warn(`⚠️ sourcing-instagram-stats: Seite ${page} fehlgeschlagen:`, err.message);
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
    if (page === 0) profile = bd;
    media = media.concat(bd.media?.data || []);

    const videoCount = media.filter((m) => m?.media_type === 'VIDEO').length;
    after = bd.media?.paging?.cursors?.after || null;
    if (!after || videoCount >= WINDOW_LONG + 2) break;
  }

  if (!profile) {
    return { ok: false, error: 'Profil konnte nicht geladen werden', error_code: null, rate_limited: false };
  }
  return { ok: true, profile, media };
}

/** 12437 -> "12.4K" (Anzeigeformat fuer die Reichweite-Spalte) */
function formatReach(views) {
  if (views == null) return null;
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return String(Math.round(views));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse(500, { error: 'Supabase-Env fehlt (SUPABASE_URL / SUPABASE_SERVICE_KEY)' });
  }
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
    return jsonResponse(500, { error: 'Meta-Env fehlt (META_ACCESS_TOKEN / META_IG_USER_ID)' });
  }

  const user = await verifyAuth(event);
  if (!user) {
    return jsonResponse(401, { error: 'Nicht autorisiert' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Ungültiger JSON-Body' });
  }

  const itemId = body.item_id;
  if (!itemId) {
    return jsonResponse(400, { error: 'item_id fehlt' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: item, error: loadError } = await supabase
    .from('creator_auswahl_items')
    .select('id, name, link_instagram')
    .eq('id', itemId)
    .single();
  if (loadError || !item) {
    return jsonResponse(404, { error: 'Sourcing-Eintrag nicht gefunden' });
  }

  const username = normalizeUsername(item.link_instagram);
  if (!isValidUsername(username)) {
    return jsonResponse(400, { error: 'Kein gültiger Instagram-Link in der Zeile hinterlegt' });
  }

  const res = await fetchProfileWithMedia(username);
  if (!res.ok) {
    await supabase
      .from('creator_auswahl_items')
      .update({ ig_fetch_error: res.error, ig_fetched_at: new Date().toISOString() })
      .eq('id', itemId);

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
      hint: res.error_code === 190
        ? 'META_ACCESS_TOKEN ist abgelaufen oder ungültig – neuen Long-Lived Token hinterlegen.'
        : 'Profil nicht via API abrufbar – kein Business-/Creator-Account oder Handle falsch.'
    });
  }

  const p = res.profile;
  const stats = computeInstagramCpm(res.media);

  const profilbildUrl = await storeImage(
    supabase,
    p.profile_picture_url,
    `sourcing/${itemId}/profil.webp`
  );

  const update = {
    link_instagram: `https://www.instagram.com/${username}/`,
    follower_instagram: p.followers_count ?? null,
    reichweite_instagram: formatReach(stats.views_trimmed),
    ig_views_8: stats.views_8,
    ig_views_30: stats.views_30,
    ig_views_trimmed: stats.views_trimmed,
    cpm_ig_8: stats.cpm_8,
    cpm_ig_30: stats.cpm_30,
    cpm_ig_trimmed: stats.cpm_trimmed,
    ig_fetched_at: new Date().toISOString(),
    ig_fetch_error: null,
    ig_stats: {
      username,
      biography: p.biography || null,
      media_count: p.media_count ?? null,
      sample_8: stats.sample_8,
      sample_30: stats.sample_30,
      trimmed_count: stats.trimmed_count,
      videos_available: stats.videos_available,
      skipped_too_recent: stats.skipped_too_recent,
      videos: stats.videos
    }
  };
  // Manuell gepflegte Namen nicht ueberschreiben
  if (!item.name?.trim() && p.name) update.name = p.name;
  if (profilbildUrl) update.profile_image_url = profilbildUrl;

  const { data: updated, error: updateError } = await supabase
    .from('creator_auswahl_items')
    .update(update)
    .eq('id', itemId)
    .select()
    .single();
  if (updateError) {
    return jsonResponse(500, { error: `Speichern fehlgeschlagen: ${updateError.message}` });
  }

  return jsonResponse(200, {
    ok: true,
    item_id: itemId,
    username,
    item: updated,
    stats: {
      views_8: stats.views_8,
      views_30: stats.views_30,
      views_trimmed: stats.views_trimmed,
      videos_available: stats.videos_available,
      skipped_too_recent: stats.skipped_too_recent
    }
  });
};
