// videoBrowserRatio.js
// Seitenverhältnis einer Videodatei aus ihren Metadaten lesen (lokale Datei oder Link).
// Braucht DOM (verstecktes <video>), deshalb getrennt von videoBrowserFormat.js.

import { detectRatio } from './videoBrowserFormat.js';
import { networkUrl } from './videoBrowserMedia.js';

const PROBE_TIMEOUT_MS = 8000;

/**
 * Pixelmaße einer Videoquelle (URL oder Blob-URL) über die Metadaten.
 * @returns {Promise<{ width: number, height: number } | null>} null bei Fehler oder Timeout
 */
export function probeVideoSize(src) {
  return new Promise((resolve) => {
    if (!src || typeof document === 'undefined') { resolve(null); return; }
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    let timer = null;
    const done = (size) => {
      clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      resolve(size);
    };
    timer = setTimeout(() => done(null), PROBE_TIMEOUT_MS);
    el.addEventListener('loadedmetadata', () => {
      done(el.videoWidth && el.videoHeight ? { width: el.videoWidth, height: el.videoHeight } : null);
    }, { once: true });
    el.addEventListener('error', () => done(null), { once: true });
    el.src = src;
  });
}

/** Standardformat einer lokalen Datei (File), `null` wenn nicht erkennbar. */
export async function ratioOfFile(file) {
  if (!file || typeof URL === 'undefined' || !URL.createObjectURL) return null;
  const url = URL.createObjectURL(file);
  try {
    const size = await probeVideoSize(url);
    return size ? detectRatio(size.width, size.height) : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Standardformat einer gespeicherten Datei (Baum-Item), `null` wenn nicht erkennbar. */
export async function ratioOfItem(item) {
  const url = await networkUrl(item).catch(() => null);
  const size = url ? await probeVideoSize(url) : null;
  return size ? detectRatio(size.width, size.height) : null;
}
