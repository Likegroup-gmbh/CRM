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
//      Ebenso erzwingt eine veraltete ig_stats.calc_version einen neuen Abruf.
//   -> Meta-Abruf: ein Call, Profil plus die letzten 30 Beitraege. Reels mit
//      Werbe- oder Co-Post-Kennzeichnung, Trial-Duplikate und alles juenger
//      als 4 Tage fallen aus der Rechnung. Der Views-Schnitt kommt aus genau
//      8 bzw. 30 sauberen Reels dieser 30 Beitraege. Reicht der Rest nicht,
//      bleibt der betroffene Schnitt leer. Ausreisser werden nicht abgezogen,
//      sondern durch den naechst-aelteren organischen Reel in dieser Menge
//      ersetzt.
//      Das Profilbild wird in zwei AVIF-Groessen (640px + 128px Thumbnail)
//      nach Supabase Storage kopiert, da Metas CDN-URLs nach wenigen Tagen
//      ablaufen.
//   -> zusaetzlich werden E-Mail, Telefon und Standort aus der Bio gelesen
//      (siehe _shared/bio-extract.js). Die API kennt diese Felder nicht,
//      Creator hinterlegen sie aber oft im Bio-Freitext. Die Bio selbst landet
//      als Startpunkt in der Kurzbeschreibung, solange die noch leer ist.
//
// Auth: Supabase Bearer-Token. Meta-Token bleibt serverseitig.

const { createClient } = require('@supabase/supabase-js');
const {
  graphGet,
  getLastUsage,
  normalizeUsername,
  isValidUsername,
  isRateLimitError,
  storeImagePair
} = require('./_shared/instagram-graph');
const {
  sanitizeUsage,
  budgetDecision
} = require('./_shared/instagram-budget');
const {
  computeInstagramCpm,
  formatCpmDebug,
  formatCpmReport,
  CALC_VERSION
} = require('./_shared/instagram-cpm');
const { extractEmail, extractPhone, extractCity } = require('./_shared/bio-extract');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Kill-Switch: nach dem Testen auf false – kein Server-Log, kein debug in Response
const IG_CPM_DEBUG = true;

// Genau die letzten 30 Beitraege, eine Seite, ein Graph-Call. Weiterblaettern
// wuerde das Stundenkontingent pro Creator vervielfachen.
const MEDIA_LIMIT = 30;

const PROFILE_FIELDS = 'username,name,followers_count,media_count,profile_picture_url,biography,website';
// Bewusst ohne media_product_type und is_shared_to_feed: fuer Business
// Discovery sind diese Felder nicht verfuegbar (Fehlercode 100) und ein
// abgelehntes Feld laesst den ganzen Call scheitern. Zum Trennen von Reels
// und Bildern reicht media_type.
// caption ist dagegen oeffentlich und die einzige Quelle fuer die
// Werbe-Erkennung, siehe istWerbePost in _shared/instagram-cpm.js.
const MEDIA_FIELDS = 'id,media_type,view_count,like_count,'
  + 'comments_count,timestamp,permalink,caption';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

/** meta_usage an die Response, damit der naechste Creator das Kontingent kennt. */
function withUsage(statusCode, body, echoedUsage) {
  const usage = getLastUsage() || echoedUsage || null;
  return jsonResponse(statusCode, usage ? { ...body, meta_usage: usage } : body);
}

/**
 * Profil plus die letzten 30 Beitraege. Ein Graph-Call.
 * Werbe- und Co-Posts filtert erst die Rechnung (computeInstagramCpm),
 * nicht dieser Abruf.
 */
async function fetchProfileWithMedia(username) {
  const igUserId = process.env.META_IG_USER_ID;
  const fields = `${PROFILE_FIELDS},media.limit(${MEDIA_LIMIT}){${MEDIA_FIELDS}}`;

  let data;
  try {
    data = await graphGet(igUserId, {
      fields: `business_discovery.username(${username}){${fields}}`
    });
  } catch (err) {
    return {
      ok: false,
      error: err.meta?.message || err.message,
      error_code: err.meta?.code ?? null,
      rate_limited: isRateLimitError(err.meta)
    };
  }

  const profile = data.business_discovery || null;
  if (!profile) {
    return { ok: false, error: 'Profil konnte nicht geladen werden', error_code: null, rate_limited: false };
  }
  return { ok: true, profile, media: profile.media?.data || [] };
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

  // Die Instagram-Bio als Startpunkt fuer die Kurzbeschreibung. Nur wenn dort
  // noch nichts steht - ein Refresh darf keine Handarbeit ueberschreiben.
  const bio = pool.ig_stats?.biography;
  if (leer(item.notiz) && !leer(bio)) update.notiz = bio;

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
  const echoedUsage = sanitizeUsage(body.usage);

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

  // Fehlt im Pool das Profilbild, ist der Eintrag unvollstaendig: einmal bei
  // Meta nachfassen statt den lueckenhaften Cache weiterzureichen. Hat Meta
  // schon mal keins geliefert, haelt ig_image_failed_at weitere Versuche auf,
  // sonst kostet jeder Klick auf so einen Creator erneut Quota.
  const bildNachholen = !pool?.profile_image_url && !pool?.ig_image_failed_at;

  // Werte aus einer aelteren Rechenlogik sind nicht mehr vergleichbar (andere
  // Ausreisser-Regel, kein Feed-Filter). Der Pool liefert sie nicht weiter aus,
  // sondern holt einmalig frisch bei Meta - so aktualisiert sich der Bestand
  // beim naechsten Klick von selbst, ohne Massen-Refresh von Hand.
  const logikVeraltet = Number(pool?.ig_stats?.calc_version || 0) < CALC_VERSION;

  // Creator schon im Pool: Werte uebernehmen statt Meta zu fragen. Erst ein
  // ausdruecklicher Refresh (force) holt neue Zahlen.
  if (pool?.ig_fetched_at && !force && !bildNachholen && !logikVeraltet) {
    const { data: updated, error: copyError } = await supabase
      .from('creator_auswahl_items')
      .update(buildItemUpdate(pool, item))
      .eq('id', itemId)
      .select()
      .single();
    if (copyError) {
      return jsonResponse(500, { error: `Speichern fehlgeschlagen: ${copyError.message}` });
    }

    const debug = emitCpmDebug(username, statsFromPool(pool), {
      source: 'pool',
      pool_fetched_at: pool.ig_fetched_at,
      follower: pool.follower_instagram,
      image_error: pool.profile_image_url
        ? null
        : 'kein Bild im Pool, letzter Versuch erfolglos (force erzwingt neuen Versuch)'
    });

    return withUsage(200, {
      ok: true,
      item_id: itemId,
      username,
      source: 'pool',
      pool_fetched_at: pool.ig_fetched_at,
      item: updated,
      stats: {
        views_8: pool.ig_views_8,
        views_30: pool.ig_views_30
      },
      ...(debug ? { debug } : {})
    }, echoedUsage);
  }

  // Kontingent fast voll: veraltete Pool-Staende nicht mehr nachziehen und
  // unbekannte Creator nicht anfragen. Der Fehlversuch wuerde das Fenster
  // nur verlaengern, die Zeile bekaeme trotzdem keine Zahlen.
  const decision = budgetDecision({
    usage: echoedUsage,
    hasPool: !!pool?.ig_fetched_at,
    force
  });
  if (decision === 'pool') {
    const { data: updated, error: copyError } = await supabase
      .from('creator_auswahl_items')
      .update(buildItemUpdate(pool, item))
      .eq('id', itemId)
      .select()
      .single();
    if (copyError) {
      return jsonResponse(500, { error: `Speichern fehlgeschlagen: ${copyError.message}` });
    }
    const debug = emitCpmDebug(username, statsFromPool(pool), {
      source: 'pool',
      pool_fetched_at: pool.ig_fetched_at,
      follower: pool.follower_instagram,
      image_error: 'Meta-Kontingent voll – Pool-Stand statt neuem Abruf'
    });
    return withUsage(200, {
      ok: true,
      item_id: itemId,
      username,
      source: 'pool',
      rate_limited: true,
      pool_fetched_at: pool.ig_fetched_at,
      item: updated,
      stats: {
        views_8: pool.ig_views_8,
        views_30: pool.ig_views_30
      },
      ...(debug ? { debug } : {})
    }, echoedUsage);
  }
  if (decision === 'defer') {
    return withUsage(429, {
      error: 'Meta-Kontingent voll',
      error_code: null,
      retryable: true,
      hint: 'Meta-Rate-Limit erreicht – später erneut versuchen.'
    }, echoedUsage);
  }

  if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
    return jsonResponse(500, { error: 'Meta-Env fehlt (META_ACCESS_TOKEN / META_IG_USER_ID)' });
  }

  const res = await fetchProfileWithMedia(username);
  if (!res.ok) {
    // Der Abruf lief nur wegen des fehlenden Bildes: die Zahlen im Pool sind
    // brauchbar, also lieber ohne Bild ausliefern als den Klick scheitern lassen
    if (bildNachholen && pool?.ig_fetched_at && !force) {
      console.warn(`⚠️ sourcing-instagram-stats: Bild-Nachzug @${username} fehlgeschlagen:`, res.error);
      const { data: updated } = await supabase
        .from('creator_auswahl_items')
        .update(buildItemUpdate(pool, item))
        .eq('id', itemId)
        .select()
        .single();

      const debug = emitCpmDebug(username, statsFromPool(pool), {
        source: 'pool',
        pool_fetched_at: pool.ig_fetched_at,
        follower: pool.follower_instagram,
        image_error: `Bild-Nachzug fehlgeschlagen: ${res.error}`
      });

      return withUsage(200, {
        ok: true,
        item_id: itemId,
        username,
        source: 'pool',
        rate_limited: res.rate_limited === true,
        pool_fetched_at: pool.ig_fetched_at,
        item: updated,
        stats: {
          views_8: pool.ig_views_8,
          views_30: pool.ig_views_30
        },
        ...(debug ? { debug } : {})
      }, echoedUsage);
    }

    // Veraltete Rechnung sollte frisch geholt werden. Liegt Meta am Limit,
    // sind die vorhandenen Zahlen brauchbarer als eine leere Zeile.
    if (res.rate_limited && pool?.ig_fetched_at && !force) {
      const { data: updated } = await supabase
        .from('creator_auswahl_items')
        .update(buildItemUpdate(pool, item))
        .eq('id', itemId)
        .select()
        .single();
      if (updated) {
        const debug = emitCpmDebug(username, statsFromPool(pool), {
          source: 'pool',
          pool_fetched_at: pool.ig_fetched_at,
          follower: pool.follower_instagram,
          image_error: `Meta-Limit, Pool-Stand behalten: ${res.error}`
        });
        return withUsage(200, {
          ok: true,
          item_id: itemId,
          username,
          source: 'pool',
          rate_limited: true,
          pool_fetched_at: pool.ig_fetched_at,
          item: updated,
          stats: {
            views_8: pool.ig_views_8,
            views_30: pool.ig_views_30
          },
          ...(debug ? { debug } : {})
        }, echoedUsage);
      }
    }

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
      return withUsage(429, {
        error: res.error,
        error_code: res.error_code,
        retryable: true,
        hint: 'Meta-Rate-Limit erreicht – später erneut versuchen.'
      }, echoedUsage);
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

  // Ein fehlendes Bild kippt den Abruf nicht, blieb bisher aber voellig
  // unsichtbar - deshalb Grund festhalten und mit ausgeben.
  const bildFehler = bild?.url
    ? null
    : (bild?.error || (p.profile_picture_url ? 'Upload lieferte keine URL' : 'Meta lieferte kein Profilbild'));
  if (bildFehler) {
    console.warn(`⚠️ sourcing-instagram-stats: Profilbild @${username} fehlt:`, bildFehler);
  }

  const jetzt = new Date().toISOString();
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
      skipped_videos: stats.skipped_videos
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

  const debug = emitCpmDebug(username, stats, {
    source: 'meta',
    pool_fetched_at: poolRow.ig_fetched_at,
    follower: p.followers_count ?? null,
    media_total: res.media.length,
    image_error: bildFehler
  });

  return withUsage(200, {
    ok: true,
    item_id: itemId,
    username,
    source: 'meta',
    pool_fetched_at: poolRow.ig_fetched_at,
    item: updated,
    stats: {
      views_8: stats.views_8,
      views_30: stats.views_30,
      videos_available: stats.videos_available,
      skipped_too_recent: stats.skipped_too_recent,
      skipped_ads: stats.skipped_ads,
      skipped_trials: stats.skipped_trials
    },
    ...(debug ? { debug } : {})
  }, echoedUsage);
};
