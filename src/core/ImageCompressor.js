/**
 * Client-seitige Bildkomprimierung via Canvas API.
 * Spart ~30-60% Dateigröße bei Logos/Profilbildern ohne sichtbaren Qualitätsverlust.
 *
 * Zum Format: AVIF encodieren derzeit nur Chromium-Browser. Firefox und Safari
 * geben bei einem nicht unterstuetzten Typ still ein PNG zurueck - ohne Fehler,
 * ohne Warnung. Ein PNG waere hier das Gegenteil des Ziels (meist groesser als
 * das Original), deshalb wird nach jedem Encode blob.type geprueft und bei
 * Bedarf auf fallbackFormat ausgewichen.
 */

const DEFAULTS = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.82,
  format: 'image/webp',
  fallbackFormat: null
};

const EXTENSIONS = {
  'image/avif': 'avif',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

/** Dateiendung zu einem MIME-Type, Fallback webp. */
export function extensionForType(type) {
  return EXTENSIONS[type] || 'webp';
}

/**
 * Encodiert und prueft, ob der Browser wirklich das gewuenschte Format
 * geliefert hat.
 * @returns {Promise<Blob|null>} null, wenn still auf PNG ausgewichen wurde
 */
async function encode(canvas, type, quality) {
  const blob = await canvas.convertToBlob({ type, quality });
  return blob?.type === type ? blob : null;
}

// Ein fehlgeschlagener Encode kostet die volle Rechenzeit, bevor das PNG
// zurueckkommt. Die Probe auf 1x1 klaert das einmal pro Sitzung.
const supportCache = new Map();

function supportsType(type) {
  if (!supportCache.has(type)) {
    const probe = encode(new OffscreenCanvas(1, 1), type, 0.5)
      .then(blob => !!blob)
      .catch(() => false);
    supportCache.set(type, probe);
  }
  return supportCache.get(type);
}

/**
 * Komprimiert eine Bilddatei und skaliert sie optional herunter.
 * @param {File} file - Die Original-Bilddatei (PNG/JPEG/WebP/AVIF)
 * @param {Object} [options]
 * @param {number} [options.maxWidth=800]
 * @param {number} [options.maxHeight=800]
 * @param {number} [options.quality=0.82]
 * @param {string} [options.format='image/webp']
 * @param {string} [options.fallbackFormat] - genutzt, wenn format nicht encodierbar ist
 * @returns {Promise<File>} Komprimierte Datei; type und Endung nennen das
 *          Format, das tatsaechlich herauskam
 */
export async function compressImage(file, options = {}) {
  const { maxWidth, maxHeight, quality, format, fallbackFormat } = { ...DEFAULTS, ...options };

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = (await supportsType(format)) ? await encode(canvas, format, quality) : null;
  let zielTyp = format;

  if (!blob && fallbackFormat && fallbackFormat !== format) {
    // AVIF und WebP bewerten dieselbe Zahl unterschiedlich: was in AVIF
    // hochwertig ist, waere in WebP zu grob. Deshalb hier bewusst hoeher.
    blob = await encode(canvas, fallbackFormat, Math.min(1, quality + 0.2));
    zielTyp = fallbackFormat;
  }

  if (!blob) {
    // Weder Ziel- noch Ersatzformat: PNG ist immer erlaubt und bleibt gueltig.
    blob = await canvas.convertToBlob({ type: 'image/png' });
    zielTyp = blob.type || 'image/png';
  }

  const newName = file.name.replace(/\.\w+$/, `.${extensionForType(zielTyp)}`);
  return new File([blob], newName, { type: zielTyp });
}

/**
 * Erzeugt eine kleine Thumbnail-Variante (Standard: 128x128, WebP) aus einer
 * Bilddatei. Für Listenansichten mit Avatar-Bubbles gedacht, wo das Original
 * (bis 800px) zu groß wäre.
 * @param {File} file - Original-Bilddatei
 * @param {Object} [options]
 * @param {number} [options.size=128] - Kantenlänge (Longest-Edge)
 * @param {number} [options.quality=0.85]
 * @returns {Promise<File>} Thumbnail-Datei (WebP)
 */
export async function createThumbnail(file, options = {}) {
  const size = options.size ?? 128;
  return compressImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: options.quality ?? 0.85,
    format: 'image/webp'
  });
}
