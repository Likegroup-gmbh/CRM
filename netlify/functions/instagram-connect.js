// Netlify Function: instagram-connect
// Holt Instagram-Daten fuer einen CRM-Creator via Meta Business Discovery
// und schreibt sie direkt in public.creator (Connect-/Refresh-Button im Aktionsmenue).
//
// POST { creator_id: '<uuid>' }
//   -> laedt Profil + letzte 25 Posts (Engagement-Berechnung),
//      speichert Bio, Follower (exakt), Post-Anzahl, Engagement-Rate,
//      Brand-Mentions (#werbung/#ad-Heuristik) und die letzten 5 Posts.
//      Profilbild + Post-Thumbnails werden als WebP (~640px) nach
//      Supabase Storage (instagram-media/{creator_id}/) kopiert, da Metas
//      CDN-URLs nach wenigen Tagen ablaufen. Refresh ueberschreibt die Dateien.
//
// Auth: Supabase Bearer-Token. Meta-Token bleibt serverseitig.

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_KEY = SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const STORAGE_BUCKET = 'instagram-media';
const SAVED_POSTS = 5;
const THUMB_WIDTH = 640;
const WEBP_QUALITY = 78;

// Profil + letzte 25 Posts (mit Engagement-Zahlen fuer die ER-Berechnung)
const DISCOVERY_FIELDS = 'username,name,followers_count,media_count,'
  + 'profile_picture_url,biography,website,'
  + 'media.limit(25){caption,like_count,comments_count,media_type,media_url,thumbnail_url,permalink,timestamp}';

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

/** Graph-GET mit Access Token; wirft bei Meta-Fehlern ein Error mit .meta */
async function graphGet(path, params = {}) {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', process.env.META_ACCESS_TOKEN);

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Graph API HTTP ${res.status}`);
    err.meta = data.error || null;
    throw err;
  }
  return data;
}

/** Username normalisieren: @, URL-Reste weg, lowercase */
function normalizeUsername(input) {
  return String(input || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

function isValidUsername(u) {
  return /^[a-z0-9._]{1,30}$/.test(u);
}

/** Engagement Rate = Durchschnitt (Likes + Kommentare) / Follower ueber die geladenen Posts, in Prozent */
function computeEngagementRate(mediaData, followers) {
  if (!followers || followers <= 0 || !mediaData?.length) return null;
  let sum = 0;
  let counted = 0;
  for (const m of mediaData) {
    if (m.like_count === undefined && m.comments_count === undefined) continue;
    sum += (Number(m.like_count) || 0) + (Number(m.comments_count) || 0);
    counted += 1;
  }
  if (counted === 0) return null;
  return Number((((sum / counted) / followers) * 100).toFixed(3));
}

/** Brand-Mentions aus Captions: @handles in Posts mit Werbe-Kennzeichnung */
function extractBrandMentions(mediaData) {
  const AD_MARKERS = /#(werbung|anzeige|ad|sponsored|paidpartnership|bezahltepartnerschaft)\b/i;
  const brands = new Map(); // handle -> count
  for (const m of mediaData || []) {
    const caption = m.caption || '';
    const isAd = AD_MARKERS.test(caption) || /paid partnership/i.test(caption);
    if (!isAd) continue;
    const mentions = caption.match(/@([a-z0-9._]{2,30})/gi) || [];
    for (const raw of mentions) {
      const handle = raw.slice(1).toLowerCase();
      brands.set(handle, (brands.get(handle) || 0) + 1);
    }
  }
  return [...brands.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([handle]) => handle);
}

/** Ein Instagram-Profil via Business Discovery laden */
async function fetchProfile(username) {
  const igUserId = process.env.META_IG_USER_ID;
  try {
    const data = await graphGet(igUserId, {
      fields: `business_discovery.username(${username}){${DISCOVERY_FIELDS}}`
    });
    const bd = data.business_discovery || {};
    return { ok: true, profile: bd, media: bd.media?.data || [] };
  } catch (err) {
    return { ok: false, error: err.meta?.message || err.message, error_code: err.meta?.code ?? null };
  }
}

/**
 * Bild von Metas CDN laden, zu WebP (~640px) komprimieren und in den
 * Storage-Bucket hochladen. Gibt die public URL (mit Cache-Buster) zurueck,
 * oder null wenn irgendwas schiefgeht (Connect soll daran nicht scheitern).
 */
async function storeImage(supabase, sourceUrl, storagePath) {
  if (!sourceUrl) return null;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());

    const webp = await sharp(original)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, webp, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: true
      });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    // Cache-Buster: gleicher Pfad wird beim Refresh ueberschrieben
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (err) {
    console.warn(`⚠️ instagram-connect: Bild ${storagePath} fehlgeschlagen:`, err.message);
    return null;
  }
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

  const creatorId = body.creator_id;
  if (!creatorId) {
    return jsonResponse(400, { error: 'creator_id fehlt' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: creator, error: loadError } = await supabase
    .from('creator')
    .select('id, instagram')
    .eq('id', creatorId)
    .single();
  if (loadError || !creator) {
    return jsonResponse(404, { error: 'Creator nicht gefunden' });
  }

  const username = normalizeUsername(creator.instagram);
  if (!isValidUsername(username)) {
    return jsonResponse(400, { error: 'Kein gültiger Instagram-Link am Creator hinterlegt' });
  }

  const res = await fetchProfile(username);
  if (!res.ok) {
    // Fehler am Creator vermerken (z.B. privates Profil / kein Business-Account)
    await supabase
      .from('creator')
      .update({ ig_username: username, ig_last_error: res.error })
      .eq('id', creatorId);
    return jsonResponse(502, {
      error: res.error,
      error_code: res.error_code,
      hint: res.error_code === 190
        ? 'META_ACCESS_TOKEN ist abgelaufen oder ungültig – neuen Long-Lived Token hinterlegen.'
        : 'Profil nicht abrufbar – vermutlich privat oder kein Business-/Creator-Account.'
    });
  }

  const p = res.profile;
  const media = res.media;
  const engagementRate = computeEngagementRate(media, p.followers_count);
  const brandMentions = extractBrandMentions(media);

  // Profilbild + Thumbnails der letzten 5 Posts nach Storage kopieren
  const profilbildUrl = await storeImage(
    supabase,
    p.profile_picture_url,
    `${creatorId}/profil.webp`
  );

  const postsToSave = media.slice(0, SAVED_POSTS);
  const recentPosts = [];
  for (let i = 0; i < postsToSave.length; i += 1) {
    const m = postsToSave[i];
    // Bei Videos/Reels liefert media_url die Videodatei -> Thumbnail nehmen
    const imageSource = m.media_type === 'VIDEO'
      ? (m.thumbnail_url || null)
      : (m.media_url || m.thumbnail_url || null);
    const thumbnailPath = await storeImage(supabase, imageSource, `${creatorId}/post-${i}.webp`);

    recentPosts.push({
      caption: m.caption || null,
      media_type: m.media_type || null,
      permalink: m.permalink || null,
      like_count: m.like_count ?? null,
      comments_count: m.comments_count ?? null,
      timestamp: m.timestamp || null,
      thumbnail_path: thumbnailPath
    });
  }

  const update = {
    ig_username: username,
    ig_biography: p.biography || null,
    ig_media_count: p.media_count ?? null,
    ig_engagement_rate: engagementRate,
    ig_brand_mentions: brandMentions,
    ig_recent_posts: recentPosts,
    instagram_follower: p.followers_count ?? null,
    ig_connected_at: new Date().toISOString(),
    ig_last_error: null
  };
  if (profilbildUrl) update.profilbild_url = profilbildUrl;

  const { error: updateError } = await supabase
    .from('creator')
    .update(update)
    .eq('id', creatorId);
  if (updateError) {
    return jsonResponse(500, { error: `Speichern fehlgeschlagen: ${updateError.message}` });
  }

  return jsonResponse(200, {
    ok: true,
    creator_id: creatorId,
    username,
    followers_count: p.followers_count ?? null,
    media_count: p.media_count ?? null,
    engagement_rate: engagementRate,
    brand_mentions: brandMentions,
    posts_saved: recentPosts.length,
    profilbild_url: profilbildUrl
  });
};
