// dropboxLinks.js
// Dropbox über den Netlify-Proxy: Upload, Ordner-Freigabe, Temp-Links und die
// Umrechnung zwischen Roh-, Vorschau- und Download-Links.

import { authorizedFetch } from './auth/getAccessToken.js';

export async function proxyPost(body) {
  const resp = await authorizedFetch('/.netlify/functions/dropbox-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    let errObj = {};
    try { errObj = JSON.parse(errText); } catch (_) {}
    throw new Error(errObj.error || `Proxy-Fehler (${resp.status})`);
  }
  return resp.json();
}

/**
 * Lädt eine Datei nach Dropbox hoch. Nutzt DropboxDirectUploader (direkt, parallel,
 * mit Retry und Proxy-Fallback). Kompatibler Drop-in-Ersatz für die alte Variante.
 *
 * @param {File|Blob} file
 * @param {string} dropboxPath
 * @param {string} token
 * @param {object} [opts]
 * @param {function} [opts.onProgress] - ({ loaded, total, phase }) => void
 * @param {AbortSignal} [opts.signal]
 * @param {function} [opts.getToken] - async ({ forceRefresh }) => string
 * @param {'overwrite'|'add'} [opts.mode]
 */
export async function uploadLargeFile(file, dropboxPath, token, opts = {}) {
  const { uploadFileDirect } = await import('./DropboxDirectUploader.js');
  return uploadFileDirect({
    file,
    dropboxPath,
    mode: opts.mode,
    token,
    getToken: opts.getToken,
    signal: opts.signal,
    onProgress: opts.onProgress,
  });
}

export async function createFolderSharedLink(token, folderPath) {
  try {
    const resp = await authorizedFetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: folderPath, token }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url || null;
  } catch (err) {
    console.warn('Ordner-Link konnte nicht erstellt werden:', err);
    return null;
  }
}

/**
 * Wandelt einen Dropbox-Shared-Link in einen direkt einbettbaren Roh-Link um.
 * Behandelt sowohl ?dl=0 als auch &dl=0 (rlkey-Links) und ergaenzt raw=1.
 * Bereits direkte dropboxusercontent-Links bleiben unveraendert.
 * @param {string} url
 * @returns {string}
 */
export function toRawDropboxUrl(url) {
  if (!url) return url;
  if (/dropboxusercontent\.com/i.test(url)) return url;
  if (!/dropbox\.com/i.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('dl');
    u.searchParams.set('raw', '1');
    return u.toString();
  } catch {
    return url.replace(/([?&])dl=0\b/i, '$1raw=1');
  }
}

/**
 * Gegenstueck zu toRawDropboxUrl: liefert den offiziellen Dropbox-Vorschaulink
 * (dropbox.com/...?dl=0), unter dem sich die Datei ansehen laesst. Wandelt den
 * gespeicherten raw=1-Link zurueck. Gibt null zurueck, wenn es kein
 * dropbox.com-Shared-Link ist (z. B. direkte dropboxusercontent-/Fremd-URLs).
 * @param {string} url
 * @returns {string|null}
 */
export function toPreviewDropboxUrl(url) {
  if (!url || !/dropbox\.com/i.test(url)) return null;
  try {
    const u = new URL(url);
    u.searchParams.delete('raw');
    u.searchParams.set('dl', '0');
    return u.toString();
  } catch {
    return url.replace(/([?&])raw=1\b/i, '$1dl=0');
  }
}

/**
 * Wie toPreviewDropboxUrl, nur mit dl=1: der Klick laedt die Datei herunter
 * statt sie im Dropbox-Viewer zu oeffnen. Fuer Rohmaterial, das der Cutter
 * lokal braucht. Gibt null zurueck, wenn es kein dropbox.com-Shared-Link ist.
 * @param {string} url
 * @returns {string|null}
 */
export function toDownloadDropboxUrl(url) {
  if (!url || !/dropbox\.com/i.test(url)) return null;
  try {
    const u = new URL(url);
    u.searchParams.delete('raw');
    u.searchParams.set('dl', '1');
    return u.toString();
  } catch {
    return url.replace(/([?&])raw=1\b/i, '$1dl=1');
  }
}

let _proxyDisabled = false;

/** Setzt den Proxy-Verfuegbarkeits-Latch zurueck (v.a. fuer Tests). */
export function _resetProxyAvailability() {
  _proxyDisabled = false;
}

/**
 * Holt einen frischen, direkten Streaming-Link (dl.dropboxusercontent.com) fuer
 * einen Dropbox-Pfad. Unterstuetzt Range-Requests/Seeking, gueltig ~4h.
 * @param {string} filePath - Dropbox-Pfad (beginnt mit /)
 * @param {string} [token]
 * @returns {Promise<string|null>}
 */
export async function getTemporaryLink(filePath, token) {
  if (!filePath || _proxyDisabled) return null;
  try {
    const resp = await authorizedFetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'temporary-link', path: filePath, token }),
    });
    // Function nicht verfuegbar (z.B. lokal ohne Netlify) -> kuenftig ueberspringen
    if (resp.status === 404) { _proxyDisabled = true; return null; }
    if (!resp.ok) return null;
    const { link } = await resp.json();
    return link || null;
  } catch (err) {
    return null;
  }
}
