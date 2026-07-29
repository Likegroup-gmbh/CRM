// Netlify Function: sourcing-instagram-stats
// Holt Instagram-Daten fuer eine Sourcing-Zeile und schreibt Name, Follower,
// Views-Schnitte und die CPM-Werte in public.creator_auswahl_items
// (Haekchen-Button neben dem Instagram-Link).
//
// Die Tabelle zeigt nicht cpm_ig_*, sondern rechnet ig_views_* mit dem TKP der
// Liste (creator_auswahl.tkp). cpm_ig_* bleiben als Referenzwert bei 25 EUR.
//
// POST { item_id: '<uuid>', force?: boolean }
//   -> Vor dem Meta-Abruf wird public.sourcing_creator gefragt: derselbe
//      Creator steckt oft in mehreren Listen. Ist der Handle dort bekannt,
//      werden die Werte aus dem Pool in die Zeile kopiert und Meta bleibt
//      unangetastet (kein Quota-Verbrauch, keine Dubletten-Pflege).
//   -> force: true erzwingt den Meta-Abruf und aktualisiert den Pool. Das
//      Frontend schickt das beim zweiten Klick (Refresh-Zustand des Buttons).
//   -> Meta-Abruf: Profil + bis zu 100 Medien (zwei Seiten a 50), filtert auf
//      Reels die aelter als 4 Tage sind und berechnet daraus den 8er-, 30er-
//      und getrimmten Views-Schnitt sowie den jeweiligen CPM-Preis.
//      Das Profilbild wird in zwei AVIF-Groessen (640px + 128px Thumbnail)
//      nach Supabase Storage kopiert, da Metas CDN-URLs nach wenigen Tagen
//      ablaufen.
//   -> zusaetzlich werden E-Mail, Telefon und Standort aus der Bio gelesen
//      (siehe _shared/bio-extract.js). Die API kennt diese Felder nicht,
//      Creator hinterlegen sie aber oft im Bio-Freitext.
//
// Auth: Supabase Bearer-Token. Meta-Token bleibt serverseitig.

const { createClient } = require('@supabase/supabase-js');
const {
  graphGet,
  normalizeUsername,
  isValidUsername,
  isRateLimitError,
  storeImagePair
} = require('./_shared/instagram-graph');
const { computeInstagramCpm, WINDOW_LONG } = require('./_shared/instagram-cpm');
const { extractEmail, extractPhone, extractCity } = require('./_shared/bio-extract');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAGE_SIZE = 50;
const MAX_PAGES = 2;   // 26s Function-Timeout, mehr ist nicht drin

const PROFILE_FIELDS = 'username,name,followers_count,media_count,profile_picture_url,biography,website';
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

function leer(value) {
  return !String(value ?? '').trim();
}

/**
 * Pool-Eintrag auf die Sourcing-Zeile mappen. Beide Wege (Pool-Treffer und
 * frischer Meta-Abruf) schreiben ueber diese Funktion, damit eine Zeile aus
 * dem Cache genau so aussieht wie eine frisch abgerufene.
 *
 * Objektive Instagram-Werte werden ueberschrieben, von Hand gepflegte
 * Kontaktdaten und Namen nur gefuellt wenn sie leer sind.
 */
function buildItemUpdate(pool, item) {
  const update = {
    sourcing_creator_id: pool.id,
    link_instagram: pool.link_instagram,
    follower_instagram: pool.follower_instagram,
    ig_views_8: pool.ig_views_8,
    ig_views_30: pool.ig_views_30,
    ig_views_trimmed: pool.ig_views_trimmed,
    cpm_ig_8: pool.cpm_ig_8,
    cpm_ig_30: pool.cpm_ig_30,
    cpm_ig_trimmed: pool.cpm_ig_trimmed,
    ig_stats: pool.ig_stats || {},
    ig_fetched_at: pool.ig_fetched_at,
    ig_fetch_error: null
  };

  if (leer(item.name) && pool.name) update.name = pool.name;
  if (pool.profile_image_url) update.profile_image_url = pool.profile_image_url;
  if (pool.profile_image_thumb_url) update.profile_image_thumb_url = pool.profile_image_thumb_url;
  if (leer(item.email) && pool.email) update.email = pool.email;
  if (leer(item.telefon) && pool.telefon) update.telefon = pool.telefon;
  if (leer(item.wohnort) && pool.wohnort) update.wohnort = pool.wohnort;

  return update;
}

/** benutzer.id zum eingeloggten Auth-User (created_by ist ein FK auf benutzer) */
async function resolveBenutzerId(supabase, authUserId) {
  if (!authUserId) return null;
  const { data } = await supabase
    .from('benutzer')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return data?.id || null;
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

  const itemId = body.item_id;
  if (!itemId) {
    return jsonResponse(400, { error: 'item_id fehlt' });
  }
  const force = body.force === true;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: item, error: loadError } = await supabase
    .from('creator_auswahl_items')
    .select('id, name, link_instagram, email, telefon, wohnort, sourcing_creator_id')
    .eq('id', itemId)
    .single();
  if (loadError || !item) {
    return jsonResponse(404, { error: 'Sourcing-Eintrag nicht gefunden' });
  }

  const username = normalizeUsername(item.link_instagram);
  if (!isValidUsername(username)) {
    return jsonResponse(400, { error: 'Kein gültiger Instagram-Link in der Zeile hinterlegt' });
  }

  const { data: pool } = await supabase
    .from('sourcing_creator')
    .select('*')
    .eq('ig_username', username)
    .maybeSingle();

  // Creator schon im Pool: Werte uebernehmen statt Meta zu fragen. Erst ein
  // ausdruecklicher Refresh (force) holt neue Zahlen.
  if (pool?.ig_fetched_at && !force) {
    const { data: updated, error: copyError } = await supabase
      .from('creator_auswahl_items')
      .update(buildItemUpdate(pool, item))
      .eq('id', itemId)
      .select()
      .single();
    if (copyError) {
      return jsonResponse(500, { error: `Speichern fehlgeschlagen: ${copyError.message}` });
    }

    return jsonResponse(200, {
      ok: true,
      item_id: itemId,
      username,
      source: 'pool',
      pool_fetched_at: pool.ig_fetched_at,
      item: updated,
      stats: {
        views_8: pool.ig_views_8,
        views_30: pool.ig_views_30,
        views_trimmed: pool.ig_views_trimmed
      }
    });
  }

  if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
    return jsonResponse(500, { error: 'Meta-Env fehlt (META_ACCESS_TOKEN / META_IG_USER_ID)' });
  }

  const res = await fetchProfileWithMedia(username);
  if (!res.ok) {
    await supabase
      .from('creator_auswahl_items')
      .update({ ig_fetch_error: res.error, ig_fetched_at: new Date().toISOString() })
      .eq('id', itemId);

    // Fehler auch am Pool vermerken, damit ein abgelaufenes Profil nicht in
    // jeder Liste erneut probiert werden muss
    if (pool) {
      await supabase
        .from('sourcing_creator')
        .update({ ig_fetch_error: res.error, updated_at: new Date().toISOString() })
        .eq('id', pool.id);
    }

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

  // Pfad haengt am Handle, nicht an der Zeile: so liegt das Bildpaar pro
  // Creator nur einmal im Storage und Pool-Treffer kommen ohne Meta an ein Bild
  const bild = await storeImagePair(
    supabase,
    p.profile_picture_url,
    `sourcing/pool/${username}/profil`
  );

  const jetzt = new Date().toISOString();
  const bio = p.biography || '';

  const poolRecord = {
    ig_username: username,
    link_instagram: `https://www.instagram.com/${username}/`,
    name: p.name || pool?.name || null,
    profile_image_url: bild?.url || pool?.profile_image_url || null,
    profile_image_thumb_url: bild?.thumbUrl || pool?.profile_image_thumb_url || null,
    follower_instagram: p.followers_count ?? null,
    reichweite_instagram: formatReach(stats.views_trimmed),
    ig_views_8: stats.views_8,
    ig_views_30: stats.views_30,
    ig_views_trimmed: stats.views_trimmed,
    cpm_ig_8: stats.cpm_8,
    cpm_ig_30: stats.cpm_30,
    cpm_ig_trimmed: stats.cpm_trimmed,
    ig_fetched_at: jetzt,
    ig_fetch_error: null,
    updated_at: jetzt,
    ig_stats: {
      username,
      biography: p.biography || null,
      website: p.website || null,
      media_count: p.media_count ?? null,
      sample_8: stats.sample_8,
      sample_30: stats.sample_30,
      trimmed_count: stats.trimmed_count,
      videos_available: stats.videos_available,
      skipped_too_recent: stats.skipped_too_recent,
      videos: stats.videos
    }
  };

  // Kontaktdaten aus der Bio: Business Discovery liefert weder E-Mail noch
  // Telefon oder Standort als Feld, viele Creator schreiben sie aber in die
  // Bio. Was im Pool oder von Hand in der Zeile steht, ist verlaesslicher als
  // die Heuristik und bleibt darum stehen.
  poolRecord.email = pool?.email || (leer(item.email) ? extractEmail(bio) : item.email) || null;
  poolRecord.telefon = pool?.telefon || (leer(item.telefon) ? extractPhone(bio) : item.telefon) || null;
  poolRecord.wohnort = pool?.wohnort || (leer(item.wohnort) ? extractCity(bio) : item.wohnort) || null;

  if (!pool) {
    poolRecord.created_by = await resolveBenutzerId(supabase, auth.user.id);
  }

  const { data: poolRow, error: poolError } = await supabase
    .from('sourcing_creator')
    .upsert(poolRecord, { onConflict: 'ig_username' })
    .select()
    .single();
  if (poolError) {
    return jsonResponse(500, { error: `Creator-Pool konnte nicht geschrieben werden: ${poolError.message}` });
  }

  const { data: updated, error: updateError } = await supabase
    .from('creator_auswahl_items')
    .update(buildItemUpdate(poolRow, item))
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
    source: 'meta',
    pool_fetched_at: poolRow.ig_fetched_at,
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
