// instagram-graph.js
// Geteilte Helfer fuer Meta Business Discovery (instagram-connect,
// sourcing-instagram-stats). Der Meta-Token bleibt serverseitig.

const sharp = require('sharp');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const STORAGE_BUCKET = 'instagram-media';
const IMAGE_WIDTH = 640;   // Hauptbild
const THUMB_WIDTH = 128;   // Projekt-Standard, siehe backfill-thumbnails.js
const AVIF_QUALITY = 55;   // visuell etwa aequivalent zu WebP q78
// effort 2 statt des sharp-Defaults 4: bei 640px kostet effort 4 rund das
// Fuenffache an Encode-Zeit, und instagram-connect verarbeitet bis zu
// 14 Bilder in einem Lauf gegen ein 26s-Timeout
const AVIF_EFFORT = 2;

// Meta-Fehlercodes, die auf Rate-Limiting/transiente Probleme hindeuten
// (4 = App-Limit, 17 = User-Limit, 32 = Page-Limit, 613 = Custom Rate Limit)
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

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

function isRateLimitError(meta) {
  if (!meta) return false;
  if (RATE_LIMIT_CODES.has(Number(meta.code))) return true;
  return meta.is_transient === true;
}

/**
 * Ein Instagram-Profil via Business Discovery laden.
 * `fields` beschreibt den inneren Block der business_discovery-Expansion.
 */
async function fetchProfile(username, fields) {
  const igUserId = process.env.META_IG_USER_ID;
  try {
    const data = await graphGet(igUserId, {
      fields: `business_discovery.username(${username}){${fields}}`
    });
    const bd = data.business_discovery || {};
    return { ok: true, profile: bd, media: bd.media?.data || [], raw: bd };
  } catch (err) {
    return {
      ok: false,
      error: err.meta?.message || err.message,
      error_code: err.meta?.code ?? null,
      rate_limited: isRateLimitError(err.meta)
    };
  }
}

async function uploadAvif(supabase, storagePath, buffer, cacheBuster) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'image/avif',
      cacheControl: '3600',
      upsert: true
    });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  // Cache-Buster: gleicher Pfad wird beim Refresh ueberschrieben
  return `${data.publicUrl}?v=${cacheBuster}`;
}

/**
 * Bild von Metas CDN laden und in zwei AVIF-Groessen in den Storage legen:
 * das Hauptbild (640px) und ein Thumbnail (128px) fuer Avatare und Listen.
 *
 * `basePath` kommt ohne Endung herein, die Endungen setzt diese Funktion
 * (`<basePath>.avif` und `<basePath>_thumb.avif`). Beide Groessen entstehen aus
 * einem einzigen Download und werden parallel encodiert und hochgeladen.
 *
 * @returns {Promise<{url: string, path: string, thumbUrl: string, thumbPath: string}|null>}
 *   null, wenn irgendwas schiefgeht - ein fehlendes Bild darf den Abruf nie kippen.
 */
async function storeImagePair(supabase, sourceUrl, basePath, options = {}) {
  if (!sourceUrl) return null;
  const { width = IMAGE_WIDTH, thumbWidth = THUMB_WIDTH } = options;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());

    const encode = (w) => sharp(original)
      .resize({ width: w, withoutEnlargement: true })
      .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
      .toBuffer();

    const [full, thumb] = await Promise.all([encode(width), encode(thumbWidth)]);

    const path = `${basePath}.avif`;
    const thumbPath = `${basePath}_thumb.avif`;
    const cacheBuster = Date.now();
    const [url, thumbUrl] = await Promise.all([
      uploadAvif(supabase, path, full, cacheBuster),
      uploadAvif(supabase, thumbPath, thumb, cacheBuster)
    ]);

    return { url, path, thumbUrl, thumbPath };
  } catch (err) {
    console.warn(`⚠️ instagram-graph: Bild ${basePath} fehlgeschlagen:`, err.message);
    return null;
  }
}

module.exports = {
  GRAPH_BASE,
  STORAGE_BUCKET,
  IMAGE_WIDTH,
  THUMB_WIDTH,
  graphGet,
  normalizeUsername,
  isValidUsername,
  isRateLimitError,
  fetchProfile,
  storeImagePair
};
