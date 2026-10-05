// resolveItemMedia
// Einzige Typ-Dispatch-Stelle (video | story | bild): macht aus einem Item und
// dem gewaehlten Asset { asset, lookup, key, label }. Lookup, Cache-Key, Label
// und Download leiten sich alle daraus ab - Player UND Prefetcher.

import { cacheKeyFor, lookupFor, videoFallbackUrl, itemLabel } from './mediaIdentity.js';
import { defaultVideoSelection, selectedVideoAsset } from './selection/video.js';
import { storyAssetFor, defaultStorySelection, currentStoryAsset } from './selection/story.js';
import { currentStillAsset } from './selection/still.js';

/**
 * @param {object} item - { type, video, slot, image }
 * @param {{ videoAsset?: object|null, storyAsset?: object|null, stillAsset?: object|null }} picks
 *        das fuer dieses Item gewaehlte Asset (nur der zum Typ passende Eintrag zaehlt)
 * @returns {{ type: string, asset: object|null, lookup: {file_path: string|null, file_url: string|null}, key: string|null, label: string }}
 */
export function resolveItemMedia(item, picks = {}) {
  if (item.type === 'video') {
    const selected = picks.videoAsset || null;
    const video = item.video;
    return {
      type: 'video',
      asset: selected,
      // Ohne gewaehltes Asset: Legacy-Felder am Video (currentAsset / file_url ...)
      lookup: selected
        ? lookupFor(selected)
        : { file_path: video.currentAsset?.file_path || null, file_url: videoFallbackUrl(video) },
      key: cacheKeyFor('video', selected || video.currentAsset),
      label: itemLabel(item),
    };
  }
  if (item.type === 'story') {
    const asset = picks.storyAsset || null;
    return {
      type: 'story',
      asset,
      lookup: lookupFor(asset),
      key: cacheKeyFor('story', asset),
      label: itemLabel(item),
    };
  }
  const asset = picks.stillAsset || item.image || null;
  return {
    type: 'bild',
    asset,
    lookup: lookupFor(asset),
    key: cacheKeyFor('bild', asset),
    label: itemLabel(item, asset),
  };
}

/** Aufgeloestes Medium des aktuellen Items der Session (null ohne Item). */
export function resolveCurrentMedia(session, assetLoader) {
  const item = session.current;
  if (!item) return null;
  if (item.type === 'video') return resolveItemMedia(item, { videoAsset: selectedVideoAsset(session, assetLoader) });
  if (item.type === 'story') return resolveItemMedia(item, { storyAsset: currentStoryAsset(session) });
  return resolveItemMedia(item, { stillAsset: currentStillAsset(session) });
}

/**
 * Default-Auswahl eines Items, wie der Player sie beim Oeffnen treffen wuerde
 * (fuer Nachbar-Prefetch -> identischer Cache-Key wie spaeter im Player).
 * Fuer Videos muessen die Assets bereits geladen sein.
 */
export function defaultPicksFor(item, { assetLoader, assets, table }) {
  if (item.type === 'video') {
    const comments = table?.videoComments?.[item.video.id];
    const sel = defaultVideoSelection(assetLoader, assets, comments, table);
    return { videoAsset: assetLoader.selectedAsset(assets, sel.assetId) };
  }
  if (item.type === 'story') {
    const sel = defaultStorySelection(item.slot);
    return { storyAsset: storyAssetFor(item.slot, sel.version, sel.finalAssetId) };
  }
  return { stillAsset: item.image || null };
}
