// Grenzen des Skript-Uploads (ADR 0073).

export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const UPLOAD_ACCEPT = '.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function uploadArt(file) {
  const name = String(file?.name || '');
  if (/\.docx$/i.test(name)) return 'docx';
  if (/\.pdf$/i.test(name) || file?.type === 'application/pdf') return 'pdf';
  return null;
}

export function titelAusDateiname(name) {
  const basis = String(name || '')
    .replace(/^.*[/\\]/, '')
    .replace(/\.docx$/i, '')
    .replace(/\.pdf$/i, '')
    .trim();
  return basis.slice(0, 200) || 'Skript';
}

export const DATEI_NICHT_LESBAR = 'Die Datei ließ sich nicht lesen. Ist sie noch in Word geöffnet oder '
  + 'synchronisiert OneDrive sie gerade? Datei schließen, kurz warten und erneut auswählen.';

/**
 * Inhalt sofort beim Auswählen in den Speicher holen: Ändern Word oder OneDrive die
 * Datei danach, kann der Browser die ursprüngliche Referenz nicht mehr lesen.
 */
export async function sichereDatei(file) {
  try {
    const bytes = await file.arrayBuffer();
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    throw new Error(DATEI_NICHT_LESBAR);
  }
}

export function pruefeUploadDatei(file) {
  const art = uploadArt(file);
  if (!art) return 'Es geht nur eine Word-Datei (.docx) oder ein PDF.';
  if (file.size > UPLOAD_MAX_BYTES) return 'Die Datei ist größer als 20 MB.';
  if (!file.size) return 'Die Datei ist leer.';
  return '';
}
