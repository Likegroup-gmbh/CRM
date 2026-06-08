export const MAX_VERSIONS = 3;

function sanitizeForFilename(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

export function buildVersionedFileName(creator, unternehmen, kampagne, version, ext) {
  const parts = [creator, unternehmen, kampagne]
    .map(sanitizeForFilename)
    .filter(Boolean);

  parts.push(`v${version}`);
  return parts.join('_') + '.' + ext;
}

export function getAvailableVersions(existingVersions, maxVersions = MAX_VERSIONS) {
  const all = Array.from({ length: maxVersions }, (_, i) => i + 1);
  return all.filter(v => !existingVersions.includes(v));
}

// ─── Shared Upload Helpers ──────────────────────────────────

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// Attribut-sicheres Escaping: escaped auch doppelte Anführungszeichen,
// die escapeHtml (textContent->innerHTML) nicht behandelt und die sonst
// HTML-Attributwerte vorzeitig beenden.
export function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error(`Datei konnte nicht gelesen werden: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function proxyPost(body) {
  const resp = await fetch('/.netlify/functions/dropbox-proxy', {
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
 */
export async function uploadLargeFile(file, dropboxPath, token, opts = {}) {
  const { uploadFileDirect } = await import('./DropboxDirectUploader.js');
  return uploadFileDirect({
    file,
    dropboxPath,
    token,
    getToken: opts.getToken,
    signal: opts.signal,
    onProgress: opts.onProgress,
  });
}

export async function createFolderSharedLink(token, folderPath) {
  try {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
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
 * Holt einen frischen, direkten Streaming-Link (dl.dropboxusercontent.com) fuer
 * einen Dropbox-Pfad. Unterstuetzt Range-Requests/Seeking, gueltig ~4h.
 * @param {string} filePath - Dropbox-Pfad (beginnt mit /)
 * @param {string} [token]
 * @returns {Promise<string|null>}
 */
let _proxyDisabled = false;

/** Setzt den Proxy-Verfuegbarkeits-Latch zurueck (v.a. fuer Tests). */
export function _resetProxyAvailability() {
  _proxyDisabled = false;
}

export async function getTemporaryLink(filePath, token) {
  if (!filePath || _proxyDisabled) return null;
  try {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
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

export const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|bmp|tiff|tif|avif|ico)$/i;
export const IMAGE_MIME_PREFIX = 'image/';
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

export const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm)$/i;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
// Dropbox Upload-Sessions können bis 350 GB; 1 GB ist ein praktikabler Browser-Client-Cap.
export const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;
export const MAX_STORY_SIZE = 1024 * 1024 * 1024;

// ─── External Link Helpers ───────────────────────────────────

export function normalizeExternalUrl(input) {
  if (!input) return '';
  let url = input.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

export function isValidExternalUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getAssetDisplayLabel(asset) {
  if (!asset) return '?';
  if (asset.variant_name) return asset.variant_name;
  if (asset.file_name) return asset.file_name;
  if (asset.file_path) {
    const last = asset.file_path.split('/').pop();
    if (last) return last;
  }
  if (asset.file_url) {
    try {
      const parsed = new URL(asset.file_url);
      const segment = parsed.pathname.split('/').filter(Boolean).pop();
      return segment || parsed.hostname;
    } catch {
      return asset.file_url;
    }
  }
  return '?';
}

export function isExternalAsset(asset) {
  return !!(asset?.file_url && !asset?.file_path);
}

export function isDirectImageUrl(url) {
  if (!url) return false;
  try {
    return IMAGE_EXTENSIONS.test(new URL(url).pathname);
  } catch {
    return IMAGE_EXTENSIONS.test(url);
  }
}

// ─── Upload-Drawer Button Icons ──────────────────────────────

export function mdcBtnIcon(svgMarkup) {
  return `<span class="mdc-btn__icon" aria-hidden="true">${svgMarkup}</span>`;
}

export const ICON_PLUS_16 = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`;

export const ICON_CHECK_16 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>`;

export const ICON_UPLOAD_16 = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>`;
