import { resolveStreamUrl } from './mediaSrc.js';

export const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

function sanitizeFilename(name) {
  return String(name || 'download').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'download';
}

/**
 * Laedt die aktuell angezeigte Datei direkt herunter (echter Datei-Download).
 * Holt den Dropbox-Temp-Link via resolveStreamUrl, faellt bei CORS-/Fetch-
 * Fehlern auf das Oeffnen in einem neuen Tab zurueck.
 *
 * @param {{ file_path?: string|null, file_url?: string|null }} asset
 * @param {string} [filename]
 */
export async function downloadMediaAsset(asset, filename) {
  const url = await resolveStreamUrl({
    file_path: asset?.file_path || null,
    file_url: asset?.file_url || null,
  });

  if (!url) {
    window.toastSystem?.show('Datei kann nicht heruntergeladen werden.', 'error');
    return;
  }

  const name = sanitizeFilename(filename);
  window.toastSystem?.show('Download wird vorbereitet...', 'info');

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    window.toastSystem?.show('Download gestartet', 'success');
  } catch (err) {
    // CORS-/Netzwerkfehler -> Fallback: in neuem Tab oeffnen
    console.warn('Direkter Download fehlgeschlagen, oeffne in neuem Tab:', err);
    window.open(url, '_blank', 'noopener');
  }
}
