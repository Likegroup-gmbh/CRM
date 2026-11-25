// pdfImage.js
// Bilder fuer jsPDF vorbereiten: laden, als JPEG verkleinern, Format bestimmen.
// jsPDF legt PNG unkomprimiert in voller Pixelzahl ab und kann kein AVIF -
// deshalb geht jedes Bild durchs Canvas.

const DEFAULT_MAX_EDGE = 256;
const JPEG_QUALITY = 0.85;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Bild konnte nicht gelesen werden'));
    reader.readAsDataURL(blob);
  });
}

/** PNG/JPEG-Data-URL des Bildes oder null (keine URL, CORS, SVG, Tests). */
export async function loadCustomerLogoPng(url) {
  if (!url || typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type || '';
    if (type.includes('svg') || type === 'image/svg+xml') return null;
    const dataUrl = await blobToDataUrl(blob);
    return typeof dataUrl === 'string' && dataUrl.startsWith('data:image/') ? dataUrl : null;
  } catch {
    return null;
  }
}

/** Format-Kennung fuer doc.addImage. */
export function imageFormat(dataUrl) {
  if (String(dataUrl).startsWith('data:image/jpeg')) return 'JPEG';
  if (String(dataUrl).startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

/**
 * Bild als JPEG, laengste Kante max. maxEdge (Default 256 fuer Logos), plus
 * Pixelmasse fuers Seitenverhaeltnis. Ohne Canvas wird das Bild ausgelassen.
 * @param {string} dataUrl
 * @param {{ maxEdge?: number }} [opts]
 * @returns {Promise<{ dataUrl: string, width: number, height: number }|null>}
 */
export function toPdfImageDataUrl(dataUrl, { maxEdge = DEFAULT_MAX_EDGE } = {}) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return Promise.resolve(null);
  const canRaster = typeof OffscreenCanvas !== 'undefined'
    && typeof Image !== 'undefined'
    && typeof document !== 'undefined';
  if (!canRaster) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          resolve(null);
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
        const width = Math.max(1, Math.round(srcW * scale));
        const height = Math.max(1, Math.round(srcH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        if (typeof jpeg !== 'string' || !jpeg.startsWith('data:image/jpeg')) {
          resolve(null);
          return;
        }
        resolve({ dataUrl: jpeg, width, height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
