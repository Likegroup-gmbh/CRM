// selection/video
// Auswahl-State und Default-Regeln fuer Video-Items. Der State liegt in
// session.video = { version, assetId }; die Assets liefert der VideoAssetLoader.

import { pickLatestAsset } from '../../../stills/stillAssets.js';
import { prefersFinal, pickIntentFinal } from './intent.js';

/** Default laut Loader (hoechste Version; Kunden: Finale). Auch fuer Nachbar-Prefetch. */
export function defaultVideoSelection(loader, assets, comments, table) {
  const sel = loader.applyDefaultSelection(assets, comments, { preferFinal: prefersFinal(table) });
  return { version: sel.selectedVersion, assetId: sel.selectedAssetId };
}

/** Aktuell gewaehltes Asset der Session (oder null). */
export function selectedVideoAsset(session, loader) {
  return loader.selectedAsset(session.assets, session.video.assetId);
}

/** Setzt die Default-Auswahl des aktuellen Video-Items (optional mit Final-Intent). */
export function applyVideoDefault(session, loader, intent = null) {
  const preferred = pickIntentFinal(loader.finalVariants(session.assets), intent);
  if (preferred) {
    session.video = { version: 'final', assetId: preferred.id };
    return;
  }
  const comments = session.table.videoComments?.[session.current.video.id];
  session.video = defaultVideoSelection(loader, session.assets, comments, session.table);
}

/** Versions-Select: gewaehlte Version, dort das neueste Asset. */
export function selectVideoVersion(session, loader, raw) {
  const version = raw === 'final' ? 'final' : Number(raw);
  const variants = loader.variantsForVersion(session.assets, version);
  session.video = { version, assetId: pickLatestAsset(variants)?.id || null };
}

/** Varianten-Select. */
export function selectVideoVariant(session, assetId) {
  session.video = { ...session.video, assetId };
}
