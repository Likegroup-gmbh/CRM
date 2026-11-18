// auswertungBildVerkleinern.js
// Insights-Screenshots vor dem Upload verkleinern (ADR 0078): längste Kante 1568 px, JPEG. Mehr
// nutzt Claude ohnehin nicht, der Upload bleibt klein, und die Function braucht kein natives
// Bildmodul (sharp), das auf einem fremd gebauten Deploy schon beim Laden bricht.

export const MAX_KANTE = 1568;
const QUALITAET = 0.9;
// Unverkleinert nur, was die KI noch annimmt (5 MB je Bild, base64 ein Drittel mehr)
export const MAX_ORIGINAL_BYTES = 3.5 * 1024 * 1024;

function leinwand(breite, hoehe) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(breite, hoehe);
  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  return canvas;
}

function alsJpeg(canvas) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITAET });
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Canvas lieferte kein Bild'))), 'image/jpeg', QUALITAET);
  });
}

/**
 * JPEG mit höchstens MAX_KANTE. Bringt das nichts (kleines Bild, schon kompakt), bleibt das
 * Original. Scheitert das Verkleinern, geht das Original, solange die KI es noch annimmt.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function verkleinere(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const faktor = Math.min(1, MAX_KANTE / Math.max(bitmap.width, bitmap.height));
    const breite = Math.max(1, Math.round(bitmap.width * faktor));
    const hoehe = Math.max(1, Math.round(bitmap.height * faktor));
    const canvas = leinwand(breite, hoehe);
    const ctx = canvas.getContext('2d');
    // Transparenz würde im JPEG schwarz
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, breite, hoehe);
    ctx.drawImage(bitmap, 0, 0, breite, hoehe);
    bitmap.close?.();
    const blob = await alsJpeg(canvas);
    if (faktor === 1 && blob.size >= file.size) return file;
    const name = `${String(file.name || 'screenshot').replace(/\.[^.]+$/, '')}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (error) {
    if (file.size <= MAX_ORIGINAL_BYTES) {
      console.warn('Auswertung: Screenshot nicht verkleinert, das Original geht hoch', error?.message || error);
      return file;
    }
    throw new Error('Der Screenshot ließ sich nicht verkleinern und ist für die KI zu groß. Bitte als PNG oder JPG unter 3,5 MB einfügen.');
  }
}
