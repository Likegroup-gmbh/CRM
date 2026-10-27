// Pool, Meta-Abruf und Reel-Kacheln fuer sourcing-instagram-stats.
// Die Function selbst bleibt der Ablauf: Auth, Pool-Treffer, Speichern.

const {
  graphGet,
  isRateLimitError,
  storeImagePair
} = require('./instagram-graph');
const { notizNachAbruf } = require('./instagram-engagement');
const {
  formatCpmDebug,
  formatCpmReport,
  classifyVideos,
  WINDOW_LONG
} = require('./instagram-cpm');
const { extractEmail, extractPhone, extractCity } = require('./bio-extract');

// Kill-Switch: nach dem Testen auf false – kein Server-Log, kein debug in Response
const IG_CPM_DEBUG = true;

const PAGE_SIZE = 50;
const MAX_PAGES = 3;   // 26s Function-Timeout, mehr ist nicht drin

// Reserve ueber das 30er-Fenster hinaus. Faellt ein Reel als Ausreisser oder
// Trial-Duplikat durch, rueckt der naechste nach - ohne Reserve bliebe das
// Fenster unterbesetzt. Fuenfzehn deckt auch Creator mit mehreren Ausreissern
// und Trial-Paaren ab und kostet meist keinen zusaetzlichen Request, weil
// PAGE_SIZE bei 50 liegt.
const PUFFER_NACHRUECKER = 15;

const PROFILE_FIELDS = 'username,name,followers_count,media_count,profile_picture_url,biography,website';
// Bewusst ohne media_product_type und is_shared_to_feed: fuer Business
// Discovery sind diese Felder nicht verfuegbar (Fehlercode 100) und ein
// abgelehntes Feld laesst den ganzen Call scheitern. Zum Trennen von Reels
// und Bildern reicht media_type.
// caption ist dagegen oeffentlich und die einzige Quelle fuer die
// Werbe-Erkennung, siehe istWerbePost in _shared/instagram-cpm.js.
const MEDIA_FIELDS = 'id,media_type,view_count,like_count,'
  + 'comments_count,timestamp,permalink,caption,thumbnail_url';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

/**
 * Reels, die es wirklich in die Rechnung schaffen koennen.
 *
 * Werbe-Reels, Trial-Duplikate und zu frische Reels zaehlen nicht mit: sonst
 * bricht das Paging zu frueh ab und dem Fenster fehlen Nachruecker fuer die
 * Ausreisser-Ersetzung, obwohl weiter hinten genug organische Reels liegen.
 * Laueft ueber classifyVideos, damit Paging und Rechnung dieselbe Logik
 * teilen - ein Trial-Paar, das die Rechnung nicht sieht, darf das Paging
 * auch nicht stoppen.
 */
function zaehleVerwertbar(media, now = Date.now()) {
  return classifyVideos(media, now).included.length;
}

/**
 * Profil + Medien laden. Da zwischen den Reels auch Bilder und Karussells
 * liegen, reicht eine Seite oft nicht fuer 30 auswertbare Videos - dann wird
 * ueber den after-Cursor nachgeladen.
 *
 * Geladen wird bis WINDOW_LONG + PUFFER_NACHRUECKER verwertbare Reels
 * zusammenkommen, damit pickWindow genug Ersatz fuer Ausreisser hat.
 */
async function fetchProfileWithMedia(username) {
  const igUserId = process.env.META_IG_USER_ID;
  let profile = null;
  let media = [];
  let after = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const edge = after
      ? `media.limit(${PAGE_SIZE}).after(${after}){${MEDIA_FIELDS}}`
      : `media.limit(${PAGE_SIZE}){${MEDIA_FIELDS}}`;

    // Profilfelder nur auf der ersten Seite - danach zaehlt nur noch media
    const fields = page === 0 ? `${PROFILE_FIELDS},${edge}` : edge;

    let data;
    try {
      data = await graphGet(igUserId, {
        fields: `business_discovery.username(${username}){${fields}}`
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

    after = bd.media?.paging?.cursors?.after || null;
    if (!after || zaehleVerwertbar(media) >= WINDOW_LONG + PUFFER_NACHRUECKER) break;
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

/** Stats-Objekt aus Pool-Zeile fuer formatCpmDebug (gleiche Form wie computeInstagramCpm) */
function statsFromPool(pool) {
  const ig = pool.ig_stats || {};
  return {
    views_8: pool.ig_views_8,
    views_30: pool.ig_views_30,
    cpm_8: pool.cpm_ig_8,
    cpm_30: pool.cpm_ig_30,
    sample_8: ig.sample_8,
    sample_30: ig.sample_30,
    // Bewusst ohne Default: fehlt das Feld (alter Pool-Eintrag), soll
    // formatCpmDebug in den permalink-Fallback laufen statt ein leeres
    // Fenster zu melden.
    used_8: ig.used_8,
    used_30: ig.used_30,
    outliers_8: ig.outliers_8 || [],
    outliers_30: ig.outliers_30 || [],
    ohne_trials: ig.ohne_trials ?? null,
    trial_gate: ig.trial_gate ?? null,
    videos_available: ig.videos_available,
    skipped_too_recent: ig.skipped_too_recent,
    skipped_ads: ig.skipped_ads ?? null,
    skipped_trials: ig.skipped_trials ?? null,
    skipped_trial_views: ig.skipped_trial_views ?? null,
    non_video_skipped: ig.non_video_skipped ?? null,
    videos: ig.videos || [],
    skipped_videos: ig.skipped_videos || []
  };
}

function emitCpmDebug(username, stats, meta) {
  if (!IG_CPM_DEBUG) return null;
  const debug = formatCpmDebug(username, stats, meta);
  // Menschenlesbarer Report ins Log (Regeln, Gate, Verdict je Reel, duale
  // Summary) - identisch zum Output von scripts/instagram-media-debug.mjs,
  // damit sich Zeilen stichprobenartig gegen das eingeloggte Grid pruefen
  // lassen. Der JSON-Payload bleibt fuer die Response.
  console.log(formatCpmReport(username, stats, meta));
  return debug;
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
    cpm_ig_8: pool.cpm_ig_8,
    cpm_ig_30: pool.cpm_ig_30,
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

  // Die Instagram-Bio als Startpunkt fuer eine leere Kurzbeschreibung.
  // Ein vorhandener Text (Vorschlagsgrund, Handnotiz) bleibt stehen.
  const bio = pool.ig_stats?.biography;
  const notiz = notizNachAbruf(item.notiz, bio);
  if (notiz) update.notiz = notiz;

  return update;
}

function vorschauAntwort(pool, item, { username, source }) {
  return jsonResponse(200, {
    ok: true,
    preview: true,
    username,
    source,
    pool_fetched_at: pool.ig_fetched_at || null,
    fields: buildItemUpdate(pool, item)
  });
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

async function speicherePostBilder(supabase, username, anzeige) {
  const postBilder = await Promise.all((anzeige || []).map((m, i) => {
    return storeImagePair(supabase, m.thumbnail_url || null, `sourcing/pool/${username}/post-${i}`);
  }));
  const bildByPermalink = new Map(
    (anzeige || []).map((m, i) => [m.permalink, postBilder[i]]).filter(([link]) => link)
  );
  return (m) => {
    const gespeichert = bildByPermalink.get(m.permalink);
    return {
      caption: m.caption ? String(m.caption).slice(0, 500) : null,
      media_type: m.media_type || null,
      permalink: m.permalink || null,
      like_count: m.like_count ?? null,
      comments_count: m.comments_count ?? null,
      view_count: m.view_count ?? null,
      timestamp: m.timestamp || null,
      thumbnail_path: gespeichert?.url || null,
      thumbnail_thumb_path: gespeichert?.thumbUrl || null
    };
  };
}

function bauePoolRecord({ username, profile: p, stats, engagement, karten, mapPost, bild, pool, item, jetzt }) {
  const bildFehler = bild?.url
    ? null
    : (bild?.error || (p.profile_picture_url ? 'Upload lieferte keine URL' : 'Meta lieferte kein Profilbild'));
  const bio = p.biography || '';

  const poolRecord = {
    ig_username: username,
    link_instagram: `https://www.instagram.com/${username}/`,
    name: p.name || pool?.name || null,
    profile_image_url: bild?.url || pool?.profile_image_url || null,
    profile_image_thumb_url: bild?.thumbUrl || pool?.profile_image_thumb_url || null,
    // Merker nur setzen, solange wirklich kein Bild vorliegt - ein Altbestand
    // aus einem frueheren Lauf zaehlt als Erfolg und darf nicht blockiert werden
    ig_image_failed_at: (bild?.url || pool?.profile_image_url) ? null : jetzt,
    follower_instagram: p.followers_count ?? null,
    // Der 30er-Wert ist die belastbarste Groesse; hat der Creator dafuer zu
    // wenige Reels, greift der 8er-Wert
    reichweite_instagram: formatReach(stats.views_30 ?? stats.views_8),
    ig_views_8: stats.views_8,
    ig_views_30: stats.views_30,
    cpm_ig_8: stats.cpm_8,
    cpm_ig_30: stats.cpm_30,
    ig_fetched_at: jetzt,
    ig_fetch_error: null,
    updated_at: jetzt,
    ig_stats: {
      username,
      biography: p.biography || null,
      website: p.website || null,
      media_count: p.media_count ?? null,
      calc_version: stats.calc_version,
      sample_8: stats.sample_8,
      sample_30: stats.sample_30,
      used_8: stats.used_8,
      used_30: stats.used_30,
      outliers_8: stats.outliers_8,
      outliers_30: stats.outliers_30,
      videos_available: stats.videos_available,
      skipped_too_recent: stats.skipped_too_recent,
      skipped_ads: stats.skipped_ads,
      skipped_trials: stats.skipped_trials,
      skipped_trial_views: stats.skipped_trial_views,
      non_video_skipped: stats.non_video_skipped,
      ohne_trials: stats.ohne_trials,
      trial_gate: stats.trial_gate,
      videos: stats.videos,
      skipped_videos: stats.skipped_videos,
      engagement_rate: engagement.engagement_rate,
      engagement_rate_clean: engagement.engagement_rate_clean,
      recent_posts: karten.raw.map(mapPost),
      recent_posts_clean: karten.clean ? karten.clean.map(mapPost) : null
    }
  };

  // Kontaktdaten aus der Bio: Business Discovery liefert weder E-Mail noch
  // Telefon oder Standort als Feld, viele Creator schreiben sie aber in die
  // Bio. Was im Pool oder von Hand in der Zeile steht, ist verlaesslicher als
  // die Heuristik und bleibt darum stehen.
  poolRecord.email = pool?.email || (leer(item.email) ? extractEmail(bio) : item.email) || null;
  poolRecord.telefon = pool?.telefon || (leer(item.telefon) ? extractPhone(bio) : item.telefon) || null;
  poolRecord.wohnort = pool?.wohnort || (leer(item.wohnort) ? extractCity(bio) : item.wohnort) || null;

  return { poolRecord, bildFehler };
}

module.exports = {
  jsonResponse,
  fetchProfileWithMedia,
  statsFromPool,
  emitCpmDebug,
  buildItemUpdate,
  vorschauAntwort,
  resolveBenutzerId,
  speicherePostBilder,
  bauePoolRecord
};
