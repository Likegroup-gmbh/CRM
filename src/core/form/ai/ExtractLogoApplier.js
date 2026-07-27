// ExtractLogoApplier.js
// Legt ein von der Webseite geholtes Logo in den Uploader, als haette der
// Nutzer es selbst hineingezogen. Hochgeladen wird es erst beim Submit durch
// UnternehmenService.uploadLogo() - der Storage-Pfad braucht die Entity-ID,
// die vor dem Insert noch nicht existiert.

import { EXTRACT_SOURCE_MARKER } from '../fields/UploaderField.js';

const UPLOADER_SELECTOR = '.uploader[data-name="logo_file"]';

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * @param {HTMLFormElement} form
 * @param {Object} logo - { base64, mimeType, filename, sourceUrl }
 * @returns {boolean} true, wenn das Logo im Uploader gelandet ist
 */
export function applyExtractedLogo(form, logo) {
  if (!form || !logo?.base64) return false;

  const uploaderRoot = form.querySelector(UPLOADER_SELECTOR);
  const input = uploaderRoot?.querySelector('input[type="file"]');
  if (!input) {
    console.warn('⚠️ SITE-EXTRACT: Kein Logo-Uploader im Formular gefunden');
    return false;
  }

  // Ein bereits vom Nutzer gewaehltes Logo nicht ueberschreiben
  const instance = uploaderRoot.__uploaderInstance;
  if (instance?.files?.length) {
    console.log('ℹ️ SITE-EXTRACT: Logo bereits gesetzt, Webseiten-Logo verworfen');
    return false;
  }

  try {
    const mimeType = logo.mimeType || 'image/png';
    const blob = base64ToBlob(logo.base64, mimeType);
    const file = new File([blob], logo.filename || 'logo.png', { type: mimeType });
    // Bleibt an der Objekt-Referenz haften: handleFiles() gibt sie unveraendert weiter
    file[EXTRACT_SOURCE_MARKER] = logo.sourceUrl || 'website';

    // Ueber DataTransfer statt direkt in instance.files, damit der komplette
    // regulaere Pfad laeuft (Validierung, renderList, onFilesChanged).
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    console.log(`🖼️ SITE-EXTRACT: Logo in den Uploader gelegt (${Math.round(file.size / 1024)} KB)`);
    return true;
  } catch (error) {
    console.error('❌ SITE-EXTRACT: Logo konnte nicht uebernommen werden:', error);
    return false;
  }
}

/**
 * Entfernt ein zuvor automatisch uebernommenes Logo. Ein selbst hochgeladenes
 * Logo bleibt unangetastet, weil nur Dateien mit Marker entfernt werden.
 */
export function clearExtractedLogo(form) {
  const uploaderRoot = form?.querySelector(UPLOADER_SELECTOR);
  const instance = uploaderRoot?.__uploaderInstance;
  if (!instance?.files?.length) return;
  if (!instance.files.some((f) => f[EXTRACT_SOURCE_MARKER])) return;

  instance.files = instance.files.filter((f) => !f[EXTRACT_SOURCE_MARKER]);
  const input = uploaderRoot.querySelector('input[type="file"]');
  if (input) input.value = '';
  instance.renderList();
  instance.onFilesChanged(instance.files);
}
