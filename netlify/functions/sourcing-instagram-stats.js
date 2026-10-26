// Netlify Function: sourcing-instagram-stats
// Holt Instagram-Daten fuer eine Sourcing-Zeile und schreibt Name, Follower,
// Views-Schnitte und die CPM-Werte in public.creator_auswahl_items
// (Haekchen-Button neben dem Instagram-Link).
//
// Die Tabelle zeigt nicht cpm_ig_*, sondern rechnet ig_views_* mit dem TKP der
// Liste (creator_auswahl.tkp). cpm_ig_* bleiben als Referenzwert bei 25 EUR.
//
// POST { item_id: '<uuid>', force?: boolean }
// POST { preview: true, link: '<instagram-url>' }
//   -> preview schreibt keine Casting-Zeile. Der Drawer zeigt die Felder, bevor
//      der Eintrag existiert. Pool und Meta laufen wie beim Haekchen.
//   -> Vor dem Meta-Abruf wird public.sourcing_creator gefragt: derselbe
//      Creator steckt oft in mehreren Listen. Ist der Handle dort bekannt,
//      werden die Werte aus dem Pool in die Zeile kopiert und Meta bleibt
//      unangetastet (kein Quota-Verbrauch, keine Dubletten-Pflege).
//   -> force: true erzwingt den Meta-Abruf und aktualisiert den Pool. Das
//      Frontend schickt das beim zweiten Klick (Refresh-Zustand des Buttons).
//      Ebenso erzwingt eine veraltete ig_stats.calc_version einen neuen Abruf.
//   -> Meta-Abruf: Profil + bis zu 150 Medien (drei Seiten a 50), filtert Reels
//      mit Werbe-Kennzeichnung und alles juenger als 4 Tage weg und berechnet
//      daraus den Views-Schnitt aus genau 8 bzw. 30 sauberen Reels plus den
//      zugehoerigen CPM-Preis. Ausreisser werden nicht abgezogen, sondern durch
//      den naechst-aelteren organischen Reel ersetzt.
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
const { normalizeUsername, isValidUsername, storeImagePair } = require('./_shared/instagram-graph');
const { engagementFuerProfil, kartenPosts } = require('./_shared/instagram-engagement');
const { computeInstagramCpm, CALC_VERSION } = require('./_shared/instagram-cpm');
const { verifyAuth, authErrorBody } = require('./_shared/verify-auth');
const {
  jsonResponse,
  fetchProfileWithMedia,
  statsFromPool,
  emitCpmDebug,
  buildItemUpdate,
  vorschauAntwort,
  resolveBenutzerId,
  speicherePostBilder,
  bauePoolRecord
} = require('./_shared/sourcing-instagram-apply');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const preview = body.preview === true;
  const itemId = body.item_id;
  if (!preview && !itemId) {
    return jsonResponse(400, { error: 'item_id fehlt' });
  }
  if (preview && !String(body.link || '').trim()) {
    return jsonResponse(400, { error: 'link fehlt' });
  }

  const force = body.force === true;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let item;
  if (preview) {
    item = {
      name: null,
      link_instagram: String(body.link).trim(),
      email: null,
      telefon: null,
      wohnort: null,
      notiz: null
    };
  } else {
    const { data, error: loadError } = await supabase
      .from('creator_auswahl_items')
      .select('id, name, link_instagram, email, telefon, wohnort, notiz, sourcing_creator_id')
      .eq('id', itemId)
      .single();
    if (loadError || !data) {
      return jsonResponse(404, { error: 'Sourcing-Eintrag nicht gefunden' });
    }
    item = data;
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
  // Aeltere Pool-Staende haben keine Engagement-Rate und keine Reel-Kacheln.
  // Ein Klick holt sie einmal nach, danach reicht der Pool wieder.
  const profilUnvollstaendig = pool?.ig_stats && !Object.prototype.hasOwnProperty.call(pool.ig_stats, 'engagement_rate');

  // Creator schon im Pool: Werte uebernehmen statt Meta zu fragen. Erst ein
  // ausdruecklicher Refresh (force) holt neue Zahlen.
  if (pool?.ig_fetched_at && !force && !bildNachholen && !logikVeraltet && !profilUnvollstaendig) {
    if (preview) return vorschauAntwort(pool, item, { username, source: 'pool' });

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

    return jsonResponse(200, {
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
    });
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
      if (preview) return vorschauAntwort(pool, item, { username, source: 'pool' });
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

      return jsonResponse(200, {
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
      });
    }

    if (!preview) {
      await supabase
        .from('creator_auswahl_items')
        .update({ ig_fetch_error: res.error, ig_fetched_at: new Date().toISOString() })
        .eq('id', itemId);
    }

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
  const engagement = engagementFuerProfil(res.media, p.followers_count);
  const karten = kartenPosts(res.media, engagement.trialIds, !!stats.trial_gate?.aktiv);

  // Pfad haengt am Handle, nicht an der Zeile: so liegt das Bildpaar pro
  // Creator nur einmal im Storage und Pool-Treffer kommen ohne Meta an ein Bild.
  // Die Kacheln laufen parallel zum Profilbild.
  const jetzt = new Date().toISOString();
  const [bild, mapPost] = await Promise.all([
    storeImagePair(supabase, p.profile_picture_url, `sourcing/pool/${username}/profil`),
    speicherePostBilder(supabase, username, karten.anzeige)
  ]);
  const { poolRecord, bildFehler } = bauePoolRecord({
    username, profile: p, stats, engagement, karten, mapPost, bild, pool, item, jetzt
  });
  if (bildFehler) {
    console.warn(`⚠️ sourcing-instagram-stats: Profilbild @${username} fehlt:`, bildFehler);
  }

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

  if (preview) return vorschauAntwort(poolRow, item, { username, source: 'meta' });

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
      videos_available: stats.videos_available,
      skipped_too_recent: stats.skipped_too_recent,
      skipped_ads: stats.skipped_ads,
      skipped_trials: stats.skipped_trials
    },
    ...(debug ? { debug } : {})
  });
};
