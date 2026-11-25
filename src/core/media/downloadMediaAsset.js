import { resolveStreamUrl } from './mediaSrc.js';
import { lookupFor } from './player/mediaIdentity.js';
import { icon } from '../../core/icons/IconSystem.js';

export const DOWNLOAD_ICON = `${icon('download')}`;

/**
 * Startet einen echten Datei-Download per programmatischem Anchor-Klick.
 * Der SharePoint-Leselink liefert die Datei als Attachment (Content-Disposition) aus,
 * daher laedt der Browser herunter ohne wegzunavigieren. Funktioniert cross-origin ohne
 * CORS, auch fuer grosse Dateien (Browser streamt).
 */
function triggerHiddenDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename; // cross-origin ignoriert, aber harmlos
  a.rel = 'noopener';
  // target=_blank verhindert, dass ein evtl. Navigations-Fallback das aktuelle
  // Popup/die Seite verlaesst.
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Blob-Download mit erzwungenem Dateinamen: ueber den Stream-Link fetchen und als Blob
 * speichern. Genau eine Datei im RAM, ObjectURL wird danach revoked.
 * @returns {Promise<boolean>} true bei Erfolg
 */
async function tryNamedBlobDownload(lookup, filename) {
  const streamUrl = await resolveStreamUrl(lookup);
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
 * Mit filename: Blob-Weg, damit der Wunsch-Name greift (scheitert bei fremden Hosts an CORS,
 * dann wie ohne filename). Ohne filename: Leselink bzw. externer Link direkt.
 *
 * @param {{ file_path?: string|null, file_url?: string|null }} asset
 * @param {string} [filename]
 * @param {{ silent?: boolean, typ?: 'video'|'story'|'still'|'bild'|'roh' }} [opts]
 *        silent: keine eigenen Toasts (Bulk-Downloads); typ: Pflicht fuer SharePoint-Dateien
 * @returns {Promise<boolean>} true, wenn ein Download angestossen wurde
 */
export async function downloadMediaAsset(asset, filename, opts = {}) {
  const toast = opts.silent ? () => {} : (msg, type) => window.toastSystem?.show(msg, type);

  if (!asset || (!asset.file_path && !asset.file_url)) {
    toast('Datei kann nicht heruntergeladen werden.', 'error');
    return false;
  }

  toast('Download wird vorbereitet...', 'info');
  const lookup = lookupFor(asset, opts.typ);

  if (filename) {
    const ok = await tryNamedBlobDownload(lookup, filename);
    if (ok) {
      toast('Download gestartet', 'success');
      return true;
    }
  }

  const url = await resolveStreamUrl(lookup);
  if (!url) {
    toast('Datei kann nicht heruntergeladen werden.', 'error');
    return false;
  }
  triggerHiddenDownload(url, filename);
  toast('Download gestartet', 'success');
  return true;
}
