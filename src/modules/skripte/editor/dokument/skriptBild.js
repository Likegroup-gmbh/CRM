// skriptBild.js
// Bilder im Skript-Dokument: pruefen (Typ, 5 MB) und clientseitig auf die
// lange Kante 1600 px verkleinern, bevor sie in den Bucket skript-bilder gehen.

export const SKRIPT_BILDER_BUCKET = 'skript-bilder';
export const SKRIPT_BILD_TYPEN = ['image/png', 'image/jpeg', 'image/webp'];
export const SKRIPT_BILD_MAX_BYTES = 5 * 1024 * 1024;
export const SKRIPT_BILD_MAX_KANTE = 1600;

/** Oeffentliche URL eines Bildpfads im Bucket (db = Supabase-Client). */
export function skriptBildPublicUrl(db, pfad) {
  if (!pfad) return '';
  return db?.storage?.from(SKRIPT_BILDER_BUCKET).getPublicUrl(pfad)?.data?.publicUrl || '';
}

/** Fehlertext oder null. */
export function pruefeSkriptBild(file) {
  if (!file) return 'Keine Datei ausgewählt.';
  if (!SKRIPT_BILD_TYPEN.includes(file.type)) return `${file.name || 'Datei'}: nur PNG, JPG oder WebP.`;
  if (file.size > SKRIPT_BILD_MAX_BYTES) return `${file.name || 'Bild'} ist größer als 5 MB.`;
  return null;
}

/** Zielmasse bei gleichem Seitenverhaeltnis; nie hochskalieren. */
export function zielMasse(breite, hoehe, maxKante = SKRIPT_BILD_MAX_KANTE) {
  const b = Math.max(1, Number(breite) || 1);
  const h = Math.max(1, Number(hoehe) || 1);
  const faktor = Math.min(1, maxKante / Math.max(b, h));
  return { breite: Math.max(1, Math.round(b * faktor)), hoehe: Math.max(1, Math.round(h * faktor)) };
}

/** Bilddateien aus einem DataTransfer (Drop oder Paste). */
export function bildDateienAus(dataTransfer) {
  if (!dataTransfer) return [];
  const dateien = [...(dataTransfer.files || [])];
  if (!dateien.length && dataTransfer.items) {
    for (const item of dataTransfer.items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) dateien.push(file);
      }
    }
  }
  return dateien.filter((f) => f.type?.startsWith('image/'));
}

function ladeBild(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden.')); };
    img.src = url;
  });
}

function alsBlob(canvas, typ, qualitaet) {
  return new Promise((resolve) => canvas.toBlob(resolve, typ, qualitaet));
}

/**
 * Verkleinert auf maxKante und kodiert als WebP (Fallback JPEG, wenn der
 * Browser kein WebP schreibt). PNG mit Transparenz bleibt bei WebP erhalten.
 */
export async function verkleinereBild(file, { maxKante = SKRIPT_BILD_MAX_KANTE, qualitaet = 0.85 } = {}) {
  const bild = await ladeBild(file);
  const { breite, hoehe } = zielMasse(bild.width, bild.height, maxKante);
  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  canvas.getContext('2d').drawImage(bild, 0, 0, breite, hoehe);
  bild.close?.();

  let blob = await alsBlob(canvas, 'image/webp', qualitaet);
  if (!blob || blob.type !== 'image/webp') blob = await alsBlob(canvas, 'image/jpeg', qualitaet);
  if (!blob) throw new Error('Bild konnte nicht verarbeitet werden.');
  if (blob.size > SKRIPT_BILD_MAX_BYTES) throw new Error('Bild ist nach dem Verkleinern noch größer als 5 MB.');
  return { blob, breite, hoehe };
}
