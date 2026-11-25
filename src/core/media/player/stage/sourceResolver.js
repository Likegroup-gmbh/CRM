// sourceResolver
// Findet die abspielbare Quelle eines Mediums (kein DOM, keine Session):
// Blob-first aus dem MediaCache, sonst Temp-Link/Stream-URL, danach optional
// den Blob-Cache fuellen. Der StageController entscheidet, was mit dem
// Ergebnis passiert (Token-Pruefung, Anzeigen, Upgrade).

import { resolveStreamUrl } from '../../mediaSrc.js';
import * as MediaCache from '../../MediaCache.js';
import { perfLog, perfNow, mediaLog } from '../../mediaPerf.js';
import { isRiskyFormat, lookupPath } from '../mediaIdentity.js';

/**
 * Blob-first: liegt das Medium bereits als Blob im Cache, sofort verwenden –
 * KEIN Warten auf resolveStreamUrl (Temp-Link) und kein Leer-Stage-Flash.
 * @returns {{ src: string, fallbackUrl: string, refreshLink: () => Promise<string|null> }|null}
 */
export function cachedSource({ key, lookup }) {
  const url = key ? MediaCache.getObjectUrl(key) : null;
  if (!url) return null;
  MediaCache.pin(key);
  perfLog('resolve', { hit: 'blob', key });
  return {
    src: url,
    fallbackUrl: url,
    // Temp-Link nur im Hintergrund fuer Fallback/Download bereitstellen.
    refreshLink: () => resolveStreamUrl(lookup).catch(() => null),
  };
}

/** Loest die Netz-Quelle (Temp-Link/Stream-URL) auf. */
export async function networkSource({ key, lookup }) {
  const t0 = perfNow();
  const resolved = await resolveStreamUrl(lookup);
  perfLog('resolveStreamUrl', { ms: Math.round(perfNow() - t0), key });
  return resolved;
}

/**
 * Befuellt den Blob-Cache, waehrend das Medium ohnehin betrachtet wird.
 * Riskante Container (.mov etc.) und Medien ohne Key werden nicht gecached.
 * @returns {Promise<string|null>|null} Blob-URL-Promise oder null, wenn nicht cachebar
 */
export function fillBlobCache({ key, lookup, label }, resolvedUrl) {
  const cacheable = !!key && !!resolvedUrl && !isRiskyFormat(lookupPath(lookup));
  if (!cacheable) return null;
  return MediaCache.ensure(key, resolvedUrl).then(blobUrl => {
    if (blobUrl) {
      mediaLog(`"${label}" ist jetzt gecached - beim Zurueck/erneut Oeffnen sofort.`);
    } else {
      mediaLog(`"${label}" konnte nicht gecached werden (zu gross oder CORS) - laedt erneut vom Netz.`);
    }
    return blobUrl;
  });
}
