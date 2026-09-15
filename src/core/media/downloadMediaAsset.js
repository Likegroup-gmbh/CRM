import { resolveStreamUrl } from './mediaSrc.js';
import { proxyPost } from '../VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

export const DOWNLOAD_ICON = `${icon('download')}`;

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
 * Blob-Download mit erzwungenem Dateinamen. Dropbox dl=1 ignoriert das
 * download-Attribut (Content-Disposition mit Dropbox-Namen), daher wird bei
 * gesetztem filename ueber den Stream-Link gefetcht und als Blob gespeichert.
 * Genau eine Datei im RAM, ObjectURL wird danach revoked.
 * @returns {Promise<boolean>} true bei Erfolg
 */
async function tryNamedBlobDownload(asset, filename) {
  const streamUrl = await resolveStreamUrl({
    file_path: asset.file_path || null,
    file_url: asset.file_url || null,
  });
  if (!streamUrl) return false;
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
    return true;
  } catch (err) {
    console.warn('Blob-Download fehlgeschlagen:', err);
    return false;
  }
}

/**
 * Laedt die aktuell angezeigte Datei direkt herunter (echter Datei-Download).
 * Mit filename: Blob-Weg, damit der Wunsch-Name auch bei Dropbox-Altdateien
 * greift. Ohne filename: Dropbox dl=1 (Force-Download), kein RAM-Verbrauch.
 *
 * @param {{ file_path?: string|null, file_url?: string|null }} asset
 * @param {string} [filename]
 * @param {{ silent?: boolean }} [opts] - silent: keine eigenen Toasts (Bulk-Downloads)
 * @returns {Promise<boolean>} true, wenn ein Download angestossen wurde
 */
export async function downloadMediaAsset(asset, filename, opts = {}) {
  const toast = opts.silent ? () => {} : (msg, type) => window.toastSystem?.show(msg, type);

  if (!asset || (!asset.file_path && !asset.file_url)) {
    toast('Datei kann nicht heruntergeladen werden.', 'error');
    return false;
  }

  toast('Download wird vorbereitet...', 'info');

  if (filename) {
    const ok = await tryNamedBlobDownload(asset, filename);
    if (ok) {
      toast('Download gestartet', 'success');
      return true;
    }
    // Fallback: dl=1 mit Dropbox-Namen (besser als kein Download).
  }

  const downloadUrl = await resolveDownloadUrl(asset);
  if (downloadUrl) {
    triggerHiddenDownload(downloadUrl, filename);
    toast('Download gestartet', 'success');
    return true;
  }

  // Fallback: Stream-Link aufloesen und dl=1 erzwingen.
  const streamUrl = await resolveStreamUrl({
    file_path: asset.file_path || null,
    file_url: asset.file_url || null,
  });
  if (!streamUrl) {
    toast('Datei kann nicht heruntergeladen werden.', 'error');
    return false;
  }

  if (!filename && looksLikeImage(asset, filename)) {
    const ok = await tryNamedBlobDownload(asset, 'download');
    if (ok) {
      toast('Download gestartet', 'success');
      return true;
    }
  }

  const forced = streamUrl + (streamUrl.includes('?') ? '&' : '?') + 'dl=1';
  triggerHiddenDownload(forced, filename);
  toast('Download gestartet', 'success');
  return true;
}
