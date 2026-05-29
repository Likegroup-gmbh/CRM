import { getTemporaryLink, toRawDropboxUrl } from '../VideoUploadUtils.js';

// Dropbox temporary links gelten ~4h; wir cachen etwas konservativer.
const TTL_MS = 3.5 * 60 * 60 * 1000;

// Cache keyed by Dropbox file_path -> { url, expires }
const _cache = new Map();

// Laufende Aufloesungen deduplizieren (gleicher Pfad nicht doppelt anfragen)
const _inflight = new Map();

export function _clearMediaSrcCache() {
  _cache.clear();
  _inflight.clear();
}

function _getCached(filePath) {
  const entry = _cache.get(filePath);
  if (entry && entry.expires > Date.now()) return entry.url;
  if (entry) _cache.delete(filePath);
  return null;
}

/**
 * Loest die abspielbare/anzeigbare URL eines Assets auf.
 * Bevorzugt den direkten, redirect-freien Dropbox-CDN-Link (get_temporary_link),
 * faellt auf einen raw=1 Shared-Link zurueck. Ergebnisse werden gecacht.
 *
 * @param {{ file_path?: string|null, file_url?: string|null }} asset
 * @returns {Promise<string|null>}
 */
export async function resolveStreamUrl(asset) {
  const filePath = asset?.file_path || null;
  const rawUrl = asset?.file_url ? toRawDropboxUrl(asset.file_url) : null;

  if (!filePath) return rawUrl;

  const cached = _getCached(filePath);
  if (cached) return cached;

  if (_inflight.has(filePath)) return _inflight.get(filePath);

  const promise = (async () => {
    let link = null;
    try {
      link = await getTemporaryLink(filePath);
    } catch (_) {
      link = null;
    }
    const finalUrl = link || rawUrl;
    if (link) {
      _cache.set(filePath, { url: link, expires: Date.now() + TTL_MS });
    }
    _inflight.delete(filePath);
    return finalUrl;
  })();

  _inflight.set(filePath, promise);
  return promise;
}

/**
 * Startet die Aufloesung ohne zu warten (fuellt den Cache fuer spaeteres
 * sofortiges Abspielen, z.B. Nachbar-Videos).
 * @param {{ file_path?: string|null, file_url?: string|null }} asset
 */
export function prefetchStreamUrl(asset) {
  if (!asset?.file_path) return;
  if (_getCached(asset.file_path)) return;
  resolveStreamUrl(asset).catch(() => {});
}
