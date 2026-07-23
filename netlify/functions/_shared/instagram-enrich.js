// Shared: Instagram-Profil-Anreicherung fuer den Creator-Pool
// Business Discovery (Meta Graph API) -> Engagement Rate + Brand-Mentions +
// Claude-Tagging (topics, geschaetztes Alter) -> Upsert nach instagram_creators.
//
// Wird von instagram-backfill-background.js und instagram-harvest-background.js
// genutzt. Erwartet einen Supabase-Client mit Service-Role (RLS-Bypass fuer Writes).

const { callClaude, extractJson, MODELS } = require('./anthropic');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Business Discovery: Profil + letzte 25 Posts (mit Engagement-Zahlen)
const DISCOVERY_FIELDS = 'username,name,followers_count,media_count,'
  + 'profile_picture_url,biography,website,'
  + 'media.limit(25){caption,like_count,comments_count,media_type,media_url,thumbnail_url,permalink,timestamp}';

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

/** Engagement Rate = Durchschnitt (Likes + Kommentare) / Follower ueber die geladenen Posts */
function computeEngagementRate(mediaData, followers) {
  if (!followers || followers <= 0 || !mediaData?.length) return null;
  let sum = 0;
  let counted = 0;
  for (const m of mediaData) {
    const likes = Number(m.like_count) || 0;
    const comments = Number(m.comments_count) || 0;
    if (m.like_count === undefined && m.comments_count === undefined) continue;
    sum += likes + comments;
    counted += 1;
  }
  if (counted === 0) return null;
  const avgInteractions = sum / counted;
  return Number(((avgInteractions / followers) * 100).toFixed(3)); // in Prozent
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
  // Nach Haeufigkeit sortiert, max 20
  return [...brands.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([handle]) => handle);
}

/** Claude Haiku: Bio + Captions -> topics[] + estimated_age_range */
async function tagWithClaude(profile, mediaData) {
  const captions = (mediaData || [])
    .map((m) => m.caption)
    .filter(Boolean)
    .slice(0, 15)
    .join('\n---\n')
    .slice(0, 4000);

  const systemBlocks = [{
    text: 'Du bist ein Analyst fuer Influencer-Marketing. Du erhaeltst Bio und Post-Captions '
      + 'eines Instagram-Creators und gibst NUR ein JSON-Objekt zurueck mit:\n'
      + '- "topics": Array aus 3-8 kurzen deutschen Themen-Tags in Kleinbuchstaben '
      + '(z.B. "hunde", "fitness", "reisen", "beauty", "familie", "food"). Nutze generische, '
      + 'gut filterbare Begriffe, keine Hashtags, keine Markennamen.\n'
      + '- "estimated_age_range": grobe Alters-Schaetzung des Creators als String '
      + '("18-24", "25-34", "35-44", "45+") oder null wenn nicht ableitbar. '
      + 'Das ist eine unsichere Schaetzung.\n'
      + 'Antworte ausschliesslich mit dem JSON-Objekt, ohne Erklaerung.'
  }];

  const userPrompt = `Username: ${profile.username}\nName: ${profile.name || '-'}\n`
    + `Bio:\n${profile.biography || '-'}\n\nCaptions:\n${captions || '-'}`;

  try {
    const { text } = await callClaude({
      model: MODELS.edit_fast,
      systemBlocks,
      userPrompt,
      maxTokens: 512
    });
    const json = extractJson(text);
    const topics = Array.isArray(json.topics)
      ? json.topics.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 8)
      : [];
    const age = typeof json.estimated_age_range === 'string' ? json.estimated_age_range : null;
    return { topics, estimated_age_range: age };
  } catch (err) {
    console.warn(`⚠️ Claude-Tagging fehlgeschlagen fuer @${profile.username}:`, err.message);
    return { topics: [], estimated_age_range: null };
  }
}

/**
 * Ein Instagram-Profil via Business Discovery laden.
 * @returns {Promise<{ok: boolean, profile?: object, media?: array, error?: string, error_code?: number}>}
 */
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

// Brand-Cache: Logos aelter als 14 Tage neu holen (Instagram-CDN-Links laufen ab)
const BRAND_REFRESH_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const BRAND_LOOKUP_DELAY_MS = 1100;

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Brand-Handles in instagram_brands cachen (Name + Profilbild via Business Discovery).
 * Ueberspringt frische Eintraege und bereits als nicht-aufloesbar markierte Handles.
 * @param {object} supabase Service-Role-Client
 * @param {string[]} handles Brand-Usernames (lowercase)
 * @returns {Promise<{looked_up: number, cached: number, failed: number}>}
 */
async function cacheBrands(supabase, handles) {
  const result = { looked_up: 0, cached: 0, failed: 0 };
  const unique = [...new Set((handles || []).map(normalizeUsername).filter(isValidUsername))];
  if (unique.length === 0) return result;

  const { data: existing } = await supabase
    .from('instagram_brands')
    .select('username, last_fetched_at, lookup_error')
    .in('username', unique);
  const existingMap = new Map((existing || []).map((b) => [b.username, b]));

  const now = Date.now();
  for (const handle of unique) {
    const cached = existingMap.get(handle);
    if (cached) {
      // Nicht aufloesbare Handles nicht endlos neu versuchen
      if (cached.lookup_error) continue;
      // Frisch genug -> ueberspringen
      if (cached.last_fetched_at && (now - new Date(cached.last_fetched_at).getTime()) < BRAND_REFRESH_AFTER_MS) continue;
    }

    result.looked_up += 1;
    const res = await fetchProfile(handle);
    if (res.ok) {
      const p = res.profile;
      await supabase.from('instagram_brands').upsert({
        username: handle,
        name: p.name || null,
        profile_picture_url: p.profile_picture_url || null,
        followers_count: p.followers_count ?? null,
        lookup_error: null,
        last_fetched_at: new Date().toISOString()
      }, { onConflict: 'username' });
      result.cached += 1;
    } else {
      await supabase.from('instagram_brands').upsert({
        username: handle,
        lookup_error: res.error,
        last_fetched_at: new Date().toISOString()
      }, { onConflict: 'username' });
      result.failed += 1;
    }
    await sleepMs(BRAND_LOOKUP_DELAY_MS);
  }
  return result;
}

/**
 * Ein Profil vollstaendig anreichern und in instagram_creators upserten.
 * @param {object} supabase Service-Role-Client
 * @param {string} rawUsername
 * @param {object} extra { source, crm_creator_id, found_via_hashtag }
 * @returns {Promise<{ok: boolean, username: string, error?: string, skipped?: boolean}>}
 */
async function enrichAndUpsert(supabase, rawUsername, extra = {}) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) {
    return { ok: false, username: rawUsername, error: 'ungueltiger Username' };
  }

  const res = await fetchProfile(username);
  if (!res.ok) {
    // Fehler protokollieren, aber Zeile trotzdem anlegen/aktualisieren (damit wir es nicht endlos neu versuchen)
    await supabase.from('instagram_creators').upsert({
      username,
      source: extra.source || 'crm',
      crm_creator_id: extra.crm_creator_id || null,
      found_via_hashtag: extra.found_via_hashtag || null,
      enrich_error: res.error,
      last_enriched_at: new Date().toISOString()
    }, { onConflict: 'username' });
    return { ok: false, username, error: res.error };
  }

  const p = res.profile;
  const media = res.media;
  const engagement_rate = computeEngagementRate(media, p.followers_count);
  const brand_mentions = extractBrandMentions(media);
  const { topics, estimated_age_range } = await tagWithClaude(p, media);

  const recent_media = media.slice(0, 12).map((m) => ({
    caption: m.caption || null,
    media_type: m.media_type || null,
    media_url: m.media_url || null,
    thumbnail_url: m.thumbnail_url || null,
    permalink: m.permalink || null,
    like_count: m.like_count ?? null,
    comments_count: m.comments_count ?? null,
    timestamp: m.timestamp || null
  }));

  const row = {
    username,
    ig_id: p.id || null,
    name: p.name || null,
    biography: p.biography || null,
    website: p.website || null,
    followers_count: p.followers_count ?? null,
    media_count: p.media_count ?? null,
    engagement_rate,
    topics,
    brand_mentions,
    estimated_age_range,
    profile_picture_url: p.profile_picture_url || null,
    recent_media,
    enrich_error: null,
    last_enriched_at: new Date().toISOString()
  };
  if (extra.source) row.source = extra.source;
  if (extra.crm_creator_id) row.crm_creator_id = extra.crm_creator_id;
  if (extra.found_via_hashtag) row.found_via_hashtag = extra.found_via_hashtag;

  const { error } = await supabase.from('instagram_creators').upsert(row, { onConflict: 'username' });
  if (error) return { ok: false, username, error: error.message };

  // Brand-Logos fuer die Kooperations-Bubbles nachziehen (gecacht, nur neue/veraltete Handles)
  if (brand_mentions.length) {
    try {
      await cacheBrands(supabase, brand_mentions);
    } catch (err) {
      console.warn(`⚠️ Brand-Cache fuer @${username} fehlgeschlagen:`, err.message);
    }
  }

  return { ok: true, username };
}

module.exports = {
  enrichAndUpsert,
  cacheBrands,
  fetchProfile,
  normalizeUsername,
  isValidUsername,
  computeEngagementRate,
  extractBrandMentions
};
