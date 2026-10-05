// mediaIdentity
// Reine Funktionen (kein DOM, kein State), die ein Medium des Players
// identifizieren: Format-Risiko, Content-Key fuers Blob-Caching, Lookup fuer
// die Stream-URL-Aufloesung und ein menschenlesbares Label.
// Einzige Quelle fuer diese Regeln - Lightbox, View und Prefetcher nutzen sie.

import { getAssetDisplayLabel } from '../../VideoUploadUtils.js';

// Container-Formate, die haeufig nicht abspielbar sind (v. a. .mov) -> kein
// Blob-Caching/Pooling (laufen ohnehin ueber den Download-Fallback).
const RISKY_VIDEO_EXT = /\.(mov|avi|mkv|m4v)(?:\?|#|$)/i;

/** True, wenn Pfad/URL ein riskantes Containerformat hat. */
export function isRiskyFormat(path) {
  return RISKY_VIDEO_EXT.test(path || '');
}

/** Direkt am Video haengende URL (Legacy-Felder), falls kein Asset existiert. */
export function videoFallbackUrl(video) {
  return video?.file_url || video?.link_content || video?.asset_url || null;
}

/**
 * Lookup fuer resolveStreamUrl/prefetchStreamUrl.
 * @param {object|null} asset
 * @param {string|null} [fallbackUrl] - greift nur, wenn das Asset keine file_url hat
 */
export function lookupFor(asset, fallbackUrl = null) {
  return {
    file_path: asset?.file_path || null,
    file_url: asset?.file_url || fallbackUrl || null,
  };
}

/** Pfad/URL eines Lookups (fuer Format-Pruefung), '' wenn leer. */
export function lookupPath(lookup) {
  return lookup?.file_path || lookup?.file_url || '';
}

/**
 * Stabiler Content-Key fuers Blob-Caching: `{typ}:{id}:{created_at}`.
 * created_at aendert sich bei Upload UND Replace (gleiche id) -> kein Stale.
 * Storys fallen zusaetzlich auf file_size zurueck.
 * @param {'video'|'story'|'bild'} type
 * @param {object|null} asset
 * @returns {string|null} null -> Caching ueberspringen
 */
export function cacheKeyFor(type, asset) {
  if (!asset?.id) return null;
  if (type === 'story') return `story:${asset.id}:${asset.created_at || asset.file_size || ''}`;
  return `${type}:${asset.id}:${asset.created_at || ''}`;
}

/**
 * Kurzer, menschenlesbarer Name eines Items (Titel + Konsolen-Log).
 * @param {object} item - { type, video, slot, image }
 * @param {object|null} [stillAsset] - aktuell gewaehltes Still (nur fuer 'bild')
 */
export function itemLabel(item, stillAsset = null) {
  if (!item) return 'Medium';
  if (item.type === 'video') return item.video?.video_name || item.video?.thema || 'Video';
  if (item.type === 'story') {
    return item.slot?.slot_name || `Story ${item.slot?.slot_index || ''}`.trim();
  }
  return getAssetDisplayLabel(stillAsset || item.image) || 'Still';
}
