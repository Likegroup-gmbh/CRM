import { resolveStreamUrl } from './mediaSrc.js';
import { proxyPost } from '../VideoUploadUtils.js';

export const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/**
 * Wandelt einen Dropbox-Shared-Link in einen Force-Download-Link (dl=1).
 * Direkte dropboxusercontent-Links unterstuetzen den Parameter nicht zuverlaessig
 * und liefern null zurueck (-> Fallback ueber shared-link/file_path).
 * @param {string|null} fileUrl
 * @returns {string|null}
 */
function toDownloadUrl(fileUrl) {
  if (!fileUrl) return null;
  if (/dropboxusercontent\.com/i.test(fileUrl)) return null;
  if (!/dropbox\.com/i.test(fileUrl)) return null;
  try {
    const u = new URL(fileUrl);
    u.searchParams.delete('raw');
    u.searchParams.set('dl', '1');
    return u.toString();
  } catch {
    return fileUrl.replace(/([?&])(?:dl|raw)=\d\b/gi, '$1dl=1');
  }
}

/**
 * Ermittelt einen Force-Download-Link (www.dropbox.com ...?dl=1) fuer das Asset.
 * 1) wenn file_path vorhanden: frischen Shared-Link erzeugen und dl=1 erzwingen
 *    (zuverlaessigster Force-Download, umgeht /s/-Legacy-/rlkey-Links ohne dl=1)
 * 2) sonst vorhandenen Shared-Link (file_url) auf dl=1 umschreiben
 */
async function resolveDownloadUrl(asset) {
  if (asset?.file_path) {
    try {
      const { url } = await proxyPost({ action: 'shared-link', path: asset.file_path });
      const dl = toDownloadUrl(url);
      if (dl) return dl;
    } catch (err) {
      console.warn('Shared-Link fuer Download konnte nicht erstellt werden:', err);
    }
  }
  return toDownloadUrl(asset?.file_url);
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)(?:\?|#|$)/i;

function looksLikeImage(asset, filename) {
  return IMAGE_EXT.test(filename || '') || IMAGE_EXT.test(asset?.file_path || '') || IMAGE_EXT.test(asset?.file_url || '');
}

/**
 * Startet einen echten Datei-Download per programmatischem Anchor-Klick.
 * Dropbox liefert bei dl=1 die Datei als Attachment (Content-Disposition) aus,
 * daher laedt der Browser herunter ohne wegzunavigieren und ohne neuen Tab.
 * Funktioniert cross-origin ohne CORS, auch fuer grosse Dateien (Browser streamt).
 */
function triggerHiddenDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename; // cross-origin ignoriert, aber harmlos
  a.rel = 'noopener';
  // target=_blank verhindert, dass ein evtl. Navigations-Fallback das aktuelle
  // Popup/die Seite verlaesst; dl=1 laedt trotzdem als Attachment.
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Laedt die aktuell angezeigte Datei direkt herunter (echter Datei-Download).
 * Primaer ueber Dropbox dl=1 (Force-Download), Fallback ueber Blob-Fetch.
 *
 * @param {{ file_path?: string|null, file_url?: string|null }} asset
 * @param {string} [filename]
 */
export async function downloadMediaAsset(asset, filename) {
  if (!asset || (!asset.file_path && !asset.file_url)) {
    window.toastSystem?.show('Datei kann nicht heruntergeladen werden.', 'error');
    return;
  }

  window.toastSystem?.show('Download wird vorbereitet...', 'info');

  const downloadUrl = await resolveDownloadUrl(asset);
  if (downloadUrl) {
    triggerHiddenDownload(downloadUrl, filename);
    window.toastSystem?.show('Download gestartet', 'success');
    return;
  }

  // Fallback: Stream-Link aufloesen. Bei grossen Videos KEIN Blob-Fetch (laedt
  // sonst die komplette Datei in den Speicher) -> direkt dl=1-Anchor erzwingen.
  // Nur fuer Bilder lohnt der Blob-Weg (klein, sauberer Dateiname).
  const streamUrl = await resolveStreamUrl({
    file_path: asset.file_path || null,
    file_url: asset.file_url || null,
  });
  if (!streamUrl) {
    window.toastSystem?.show('Datei kann nicht heruntergeladen werden.', 'error');
    return;
  }

  if (looksLikeImage(asset, filename)) {
    try {
      const res = await fetch(streamUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = String(filename || 'download').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
      window.toastSystem?.show('Download gestartet', 'success');
      return;
    } catch (err) {
      console.warn('Blob-Download fehlgeschlagen, erzwinge Download per dl=1:', err);
    }
  }

  const forced = streamUrl + (streamUrl.includes('?') ? '&' : '?') + 'dl=1';
  triggerHiddenDownload(forced, filename);
  window.toastSystem?.show('Download gestartet', 'success');
}
