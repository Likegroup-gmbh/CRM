/**
 * Client-seitige Bildkomprimierung via Canvas API -> WebP.
 * Spart ~30-60% Dateigröße bei Logos/Profilbildern ohne sichtbaren Qualitätsverlust.
 */

const DEFAULTS = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.82,
  format: 'image/webp'
};

/**
 * Komprimiert eine Bilddatei zu WebP und skaliert sie optional herunter.
 * @param {File} file - Die Original-Bilddatei (PNG/JPEG/WebP)
 * @param {Object} [options]
 * @param {number} [options.maxWidth=800]
 * @param {number} [options.maxHeight=800]
 * @param {number} [options.quality=0.82] - WebP-Qualität (0-1)
 * @param {string} [options.format='image/webp']
 * @returns {Promise<File>} Komprimierte Datei
 */
export async function compressImage(file, options = {}) {
  const { maxWidth, maxHeight, quality, format } = { ...DEFAULTS, ...options };

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

  const blob = await canvas.convertToBlob({ type: format, quality });

  const newName = file.name.replace(/\.\w+$/, '.webp');
  return new File([blob], newName, { type: format });
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
