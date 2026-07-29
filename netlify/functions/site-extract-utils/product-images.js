// product-images.js
// Zieht Produktbilder aus einer Shop-Seite, konvertiert sie zu AVIF und legt
// sie im Storage-Bucket "produkte" unter _temp/{extractId}/ ab.
//
// Warum ueber den Storage und nicht als base64 in der Response: fuenf Fotos
// als base64 sprengen jedes vernuenftige Response-Budget. Das Formular bekommt
// nur Pfad und URL und uebernimmt die Bilder beim Speichern per move() in den
// endgueltigen Produktordner. Was liegen bleibt, raeumt
// cleanup-temp-produktbilder.js nach 24 Stunden.

const sharp = require('sharp');
const { extractJsonLd, extractMeta, resolveUrl } = require('./html-distill');
const { downloadImage } = require('./logo');

const BUCKET = 'produkte';
const TEMP_PREFIX = '_temp';
const MAX_EDGE = 1200;
// AVIF-Qualitaet ist nicht mit der WebP-Skala vergleichbar: 58 entspricht in
// etwa WebP 82, bei rund einem Drittel weniger Bytes.
const AVIF_QUALITY = 58;
// effort steuert die Suchtiefe des Encoders. libaom ist deutlich langsamer als
// libwebp, und die Function teilt sich ihr Zeitbudget mit der Textextraktion -
// hoehere Stufen kosten Sekunden und bringen nur wenige Prozent.
const AVIF_EFFORT = 2;
const MAX_IMAGE_BYTES = 900 * 1024;
const MIN_EDGE = 200;
// Mehr Kandidaten als Zielbilder: erfahrungsgemaess fallen einige durch
const MAX_CANDIDATES = 14;

// Bilder, die auf Produktseiten regelmaessig mitgeliefert werden, aber nie das
// Produkt zeigen: Zahlungsarten, Siegel, Trust-Badges, Lifestyle-Banner.
const NOISE_WORDS = /logo|icon|favicon|sprite|placeholder|spacer|pixel|1x1|payment|bezahl|paypal|klarna|visa|mastercard|versand|shipping|dhl|dpd|hermes|trust|siegel|badge|award|zertifi|bewertung|review|stars?|flag|avatar|instagram|facebook|tiktok|youtube/i;
const GALLERY_WORDS = /product|produkt|gallery|galerie|media|slider|carousel|thumb|zoom|main-?image|featured/i;

/**
 * Kandidaten nach Verlaesslichkeit sortiert.
 * @returns {Array<{url: string, score: number, reason: string}>}
 */
function findProductImageCandidates(html, baseUrl) {
  const candidates = [];
  const seen = new Set();

  const add = (href, score, reason) => {
    const url = resolveUrl(href, baseUrl);
    if (!url) return;
    // Query-Parameter variieren oft nur die Groesse desselben Bildes
    const key = url.split('?')[0];
    if (seen.has(key)) return;
    if (/^data:/i.test(url)) return;
    if (/\.(svg|ico|gif)(\?|#|$)/i.test(url)) return;
    if (NOISE_WORDS.test(url)) return;
    seen.add(key);
    candidates.push({ url, score, reason });
  };

  // 1. JSON-LD Product.image - wenn gepflegt, sind das genau die Produktbilder
  for (const href of jsonLdProductImages(extractJsonLd(html))) {
    add(href, 100, 'json-ld');
  }

  // 2. Social-Preview - zeigt bei Produktseiten fast immer das Produkt
  const meta = extractMeta(html);
  for (const key of ['og:image', 'og:image:secure_url', 'twitter:image']) {
    if (meta[key]) add(meta[key], 70, key);
  }

  // 3. <img> aus Galerie-Kontexten
  const imgRe = /<img\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const attrs = parseImgAttributes(m[1]);
    const src = bestSource(attrs);
    if (!src) continue;

    const signals = `${src} ${attrs.alt || ''} ${attrs.class || ''} ${attrs.id || ''}`;
    const declared = Math.max(parseInt(attrs.width, 10) || 0, parseInt(attrs.height, 10) || 0);
    if (declared && declared < MIN_EDGE) continue;

    let score = GALLERY_WORDS.test(signals) ? 50 : 10;
    // Der Kontext um das Bild verraet die Galerie auch dann, wenn das <img>
    // selbst nur generische Klassen hat
    if (GALLERY_WORDS.test(html.slice(Math.max(0, m.index - 300), m.index))) score += 25;
    if (NOISE_WORDS.test(signals)) continue;
    if (score >= 35) add(src, score, 'img');
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
}

function jsonLdProductImages(nodes = []) {
  const out = [];
  const collect = (value) => {
    if (!value) return;
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (typeof value === 'object') collect(value.url || value.contentUrl);
  };
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    if (!/product/i.test(String(node['@type'] || ''))) continue;
    collect(node.image);
  }
  return out;
}

function parseImgAttributes(tagInner) {
  const attrs = {};
  const re = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(tagInner)) !== null) {
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || '';
    attrs[m[1].toLowerCase()] = value.trim();
  }
  return attrs;
}

/** Aus srcset die groesste Variante nehmen, sonst src bzw. Lazy-Attribute. */
function bestSource(attrs) {
  const srcset = attrs.srcset || attrs['data-srcset'];
  if (srcset) {
    const best = srcset
      .split(',')
      .map((part) => {
        const [url, descriptor] = part.trim().split(/\s+/);
        const width = descriptor && descriptor.endsWith('w') ? parseInt(descriptor, 10) : 0;
        return { url, width };
      })
      .filter((c) => c.url)
      .sort((a, b) => b.width - a.width)[0];
    if (best) return best.url;
  }
  return attrs.src || attrs['data-src'] || attrs['data-original'] || null;
}

/**
 * Beliebige Bilddaten zu AVIF unter MAX_IMAGE_BYTES.
 *
 * Zwei Stufen statt drei: AVIF unterschreitet das Byte-Limit bei Produktfotos
 * praktisch immer schon im ersten Anlauf, und jeder weitere Encode kostet hier
 * spuerbar mehr Zeit als frueher mit WebP.
 */
async function toAvif(buffer) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width && height && Math.max(width, height) < MIN_EDGE) {
    throw new Error(`Zu klein (${width}x${height})`);
  }

  const variants = [
    { edge: MAX_EDGE, quality: AVIF_QUALITY },
    { edge: 900, quality: 45 }
  ];

  let last = null;
  for (const variant of variants) {
    last = await sharp(buffer, { failOn: 'none' })
      .resize({ width: variant.edge, height: variant.edge, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: variant.quality, effort: AVIF_EFFORT })
      .toBuffer();
    if (last.length <= MAX_IMAGE_BYTES) return { buffer: last, width, height, format: meta.format };
  }

  throw new Error(`AVIF zu gross (${Math.round(last.length / 1024)} KB)`);
}

/**
 * Laedt die Kandidaten der Reihe nach, konvertiert sie und schiebt sie in den
 * Temp-Ordner. Bricht ab, wenn das Zeitbudget knapp wird - die Textfelder sind
 * wichtiger als die Bilder.
 *
 * @param {Array} candidates - Ergebnis von findProductImageCandidates
 * @param {Object} options
 * @param {Object} options.supabase - Client mit Service-Role
 * @param {string} options.extractId - Ordnername unter _temp/
 * @param {number} options.limit - maximale Anzahl uebernommener Bilder
 * @param {Function} options.remaining - liefert das Restbudget in Millisekunden
 * @param {number} options.minRemainingMs - darunter wird abgebrochen
 * @returns {Promise<Array<{storage_pfad: string, url: string, quelle_url: string}>>}
 */
async function collectProductImages(candidates = [], options) {
  const { supabase, extractId, limit = 5, remaining = () => Infinity, minRemainingMs = 0 } = options;
  const result = [];

  for (const candidate of candidates) {
    if (result.length >= limit) break;
    if (remaining() < minRemainingMs) {
      console.log('⏱️ site-extract: Bildpipeline wegen Zeitlimit abgebrochen');
      break;
    }

    try {
      const source = await downloadImage(candidate.url);
      const bild = await toAvif(source);

      const pfad = `${TEMP_PREFIX}/${extractId}/${result.length + 1}.avif`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(pfad, bild.buffer, { contentType: 'image/avif', upsert: true });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(pfad);
      result.push({ storage_pfad: pfad, url: data?.publicUrl || null, quelle_url: candidate.url });

      console.log(`🖼️ site-extract: Produktbild ${result.length} (${candidate.reason}, ${bild.format} ${bild.width}x${bild.height} -> ${Math.round(bild.buffer.length / 1024)} KB)`);
    } catch (err) {
      console.log(`⚠️ site-extract: Produktbild verworfen (${err.message}) ${candidate.url}`);
    }
  }

  return result;
}

module.exports = {
  findProductImageCandidates,
  collectProductImages,
  toAvif,
  BUCKET,
  TEMP_PREFIX
};
