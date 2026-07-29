// logo.js
// Laedt den besten Logo-Kandidaten und rendert ihn mit sharp zu PNG. Wichtig
// vor allem fuer SVG-Logos, die im Browser-Uploader sonst durchfallen.
//
// Keine Groessen-Feinarbeit hier: clientseitig laeuft die Datei ohnehin durch
// compressImage() (UnternehmenService.uploadLogo), das auf WebP unter 200 KB
// drueckt. Diese Funktion muss nur ein valides, nicht zu grosses PNG liefern.

const sharp = require('sharp');

const FETCH_TIMEOUT_MS = 8000;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 512;
const MIN_EDGE = 32;
const MAX_PHOTO_EDGE = 800;
const MAX_CANDIDATES = 5;
// Der Uploader im Formular nimmt maximal 200 KB an (siehe FormConfig
// logo_file). Wir bleiben mit Reserve darunter, sonst weist er das Logo ab.
const MAX_PNG_BYTES = 180 * 1024;

// Kein AVIF anfragen: manche CDNs liefern es dann aus, und libvips kann es in
// der Lambda-Umgebung nicht dekodieren.
const IMAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8'
};

async function downloadImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: IMAGE_HEADERS, redirect: 'follow', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Manche CDNs antworten auf fehlende Bilder mit 200 und einer Textseite
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType && !/^(image\/|application\/octet-stream)/.test(contentType)) {
      throw new Error(`Kein Bild (${contentType.split(';')[0]})`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error('Leere Datei');
    if (buffer.length > MAX_SOURCE_BYTES) throw new Error('Datei zu gross');
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Konvertiert beliebige Bilddaten zu PNG. `density` sorgt dafuer, dass SVGs
 * nicht als 16px-Briefmarke rasterisiert werden.
 */
async function toPng(buffer) {
  const image = sharp(buffer, { density: 300, failOn: 'none' });
  const meta = await image.metadata();

  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width && height && Math.max(width, height) < MIN_EDGE) {
    throw new Error(`Zu klein (${width}x${height})`);
  }
  // Logos sind praktisch nie grosse JPEGs. Filtert Pressefotos aus, die im
  // Markup faelschlich als Logo-Kandidat auftauchen.
  if (meta.format === 'jpeg' && Math.max(width, height) > MAX_PHOTO_EDGE) {
    throw new Error(`Sieht nach Foto aus (JPEG ${width}x${height})`);
  }

  const png = await encodePng(buffer);
  return { buffer: png, width, height, format: meta.format };
}

/**
 * Skaliert und kodiert zu PNG unter MAX_PNG_BYTES. Palette-Quantisierung ist
 * bei Logos praktisch verlustfrei, weil sie ohnehin wenige Farben haben.
 */
async function encodePng(buffer) {
  const variants = [
    { edge: MAX_EDGE, options: { compressionLevel: 9 } },
    { edge: MAX_EDGE, options: { compressionLevel: 9, palette: true } },
    { edge: 256, options: { compressionLevel: 9, palette: true } }
  ];

  let last = null;
  for (const { edge, options } of variants) {
    last = await sharp(buffer, { density: 300, failOn: 'none' })
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .png(options)
      .toBuffer();
    if (last.length <= MAX_PNG_BYTES) return last;
  }

  if (last.length > MAX_PNG_BYTES) {
    throw new Error(`PNG zu gross (${Math.round(last.length / 1024)} KB)`);
  }
  return last;
}

/**
 * Zieht ein <symbol> aus einer SVG-Sprite-Datei und macht daraus ein
 * eigenstaendiges SVG. Sprite-Dateien haben am Wurzelelement meist keine oder
 * eine 0x0-Groesse, sharp kann sie deshalb nicht direkt rendern.
 */
function extractSymbol(svgText, symbolId) {
  const re = new RegExp(`<symbol\\b[^>]*\\bid\\s*=\\s*["']${symbolId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)<\\/symbol>`, 'i');
  const match = svgText.match(re);
  if (!match) return null;

  const viewBox = (match[0].match(/viewBox\s*=\s*["']([^"']+)["']/i) || [])[1];
  if (!viewBox) return null;

  const defs = (svgText.match(/<defs\b[\s\S]*?<\/defs>/i) || [''])[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}">${defs}${match[1]}</svg>`;
}

/**
 * Probiert die Kandidaten der Reihe nach durch. Ein Kandidat traegt entweder
 * eine `url` (optional mit `symbolId` fuer Sprite-Dateien) oder - bei
 * Inline-SVG - das Markup in `svg`.
 * @param {Array<{url?: string, svg?: string, symbolId?: string, score: number, reason: string}>} candidates
 * @returns {Promise<{ base64: string, mimeType: string, filename: string, sourceUrl: string|null, sourceSvg: string|null }|null>}
 */
async function pickLogo(candidates = []) {
  for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
    const label = candidate.url || `inline SVG (${candidate.svg.length} Zeichen)`;
    try {
      let source = candidate.svg ? Buffer.from(candidate.svg, 'utf8') : await downloadImage(candidate.url);
      let svgMarkup = candidate.svg || null;
      if (candidate.symbolId) {
        const standalone = extractSymbol(source.toString('utf8'), candidate.symbolId);
        if (standalone) {
          source = Buffer.from(standalone, 'utf8');
          svgMarkup = standalone;
        }
      }
      const png = await toPng(source);
      console.log(`🖼️ site-extract: Logo uebernommen (${candidate.reason}, Quelle ${png.format} ${png.width}x${png.height}, PNG ${Math.round(png.buffer.length / 1024)} KB) ${label}`);
      return {
        base64: png.buffer.toString('base64'),
        mimeType: 'image/png',
        filename: 'logo.png',
        sourceUrl: candidate.url || null,
        sourceSvg: svgMarkup
      };
    } catch (err) {
      console.log(`⚠️ site-extract: Logo-Kandidat verworfen (${err.message}) ${label}`);
    }
  }
  return null;
}

module.exports = { pickLogo, toPng, downloadImage };
