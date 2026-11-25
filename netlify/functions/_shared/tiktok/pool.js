// _shared/tiktok/pool.js
// TikTok-Pool (sourcing_creator_tiktok): ein Eintrag je Handle, geteilt ueber alle Listen, wie
// sourcing_creator fuer Instagram. Ein Pool-Treffer spart den Apify-Lauf (Zeit und Geld).
// itemUpdateAusPool ist die einzige Stelle, die Pool-Werte auf eine Casting-Zeile abbildet:
// Pool-Treffer und frischer Lauf schreiben dieselbe Form.

const { CALC_VERSION } = require('../instagram-cpm');
const { notizNachAbruf } = require('../instagram-engagement');
const { extractEmail, extractPhone, extractCity } = require('../bio-extract');

const POOL_TABELLE = 'sourcing_creator_tiktok';

const leer = (wert) => !String(wert ?? '').trim();
const profilLink = (username) => `https://www.tiktok.com/@${username}`;

async function ladePool(supabase, username) {
  const { data, error } = await supabase
    .from(POOL_TABELLE)
    .select('*')
    .eq('tt_username', username)
    .maybeSingle();
  if (error) throw new Error(`TikTok-Pool nicht lesbar: ${error.message}`);
  return data || null;
}

/** Pool-Stand reicht, solange kein frischer Abruf verlangt ist und die Rechenlogik dieselbe ist. */
function poolReicht(pool, force = false) {
  if (force || !pool?.tt_fetched_at) return false;
  return Number(pool.tt_stats?.calc_version || 0) >= CALC_VERSION;
}

/**
 * Pool-Zeile aus einem fertigen Lauf. Kontaktdaten aus der Bio nur, wenn weder Pool noch
 * Zeile etwas haben: was von Hand dasteht, ist verlaesslicher als die Heuristik.
 */
function bauePoolRecord({ username, profil, kennzahlen, bild, pool, item = {}, jetzt }) {
  const bio = profil.bio || '';
  return {
    tt_username: username,
    link_tiktok: profilLink(username),
    name: profil.nickName || pool?.name || null,
    profile_image_url: bild?.url || pool?.profile_image_url || null,
    profile_image_thumb_url: bild?.thumbUrl || pool?.profile_image_thumb_url || null,
    follower_tiktok: profil.follower ?? null,
    tt_views_12: kennzahlen.views_12,
    tt_views_30: kennzahlen.views_30,
    tt_stats: {
      username,
      nickname: profil.nickName || null,
      biography: profil.bio || null,
      bio_link: profil.bioLink || null,
      video_count: profil.videos ?? null,
      likes_total: profil.likes ?? null,
      verifiziert: !!profil.verifiziert,
      ...kennzahlen.stats,
    },
    email: pool?.email || (leer(item.email) ? extractEmail(bio) : item.email) || null,
    telefon: pool?.telefon || (leer(item.telefon) ? extractPhone(bio) : item.telefon) || null,
    wohnort: pool?.wohnort || (leer(item.wohnort) ? extractCity(bio) : item.wohnort) || null,
    tt_fetched_at: jetzt,
    tt_fetch_error: null,
    updated_at: jetzt,
  };
}

async function speicherePool(supabase, record) {
  const { data, error } = await supabase
    .from(POOL_TABELLE)
    .upsert(record, { onConflict: 'tt_username' })
    .select()
    .single();
  if (error) throw new Error(`TikTok-Pool konnte nicht geschrieben werden: ${error.message}`);
  return data;
}

/**
 * Pool -> Casting-Zeile. TikTok-Werte werden ueberschrieben. Name, Bild, Kontakt und
 * Kurzbeschreibung nur, wenn die Zeile dort nichts hat: Instagram und Handarbeit haben Vorrang.
 */
function itemUpdateAusPool(pool, item = {}) {
  const update = {
    link_tiktok: pool.link_tiktok,
    follower_tiktok: pool.follower_tiktok,
    tt_views_12: pool.tt_views_12,
    tt_views_30: pool.tt_views_30,
    tt_stats: pool.tt_stats || {},
    tt_fetched_at: pool.tt_fetched_at,
    tt_fetch_error: null,
  };
  if (leer(item.name) && pool.name) update.name = pool.name;
  if (!item.profile_image_url && pool.profile_image_url) {
    update.profile_image_url = pool.profile_image_url;
    update.profile_image_thumb_url = pool.profile_image_thumb_url || null;
  }
  if (leer(item.email) && pool.email) update.email = pool.email;
  if (leer(item.telefon) && pool.telefon) update.telefon = pool.telefon;
  if (leer(item.wohnort) && pool.wohnort) update.wohnort = pool.wohnort;
  const notiz = notizNachAbruf(item.notiz, pool.tt_stats?.biography);
  if (notiz) update.notiz = notiz;
  return update;
}

module.exports = {
  POOL_TABELLE,
  profilLink,
  ladePool,
  poolReicht,
  bauePoolRecord,
  speicherePool,
  itemUpdateAusPool,
};
