// selection/still
// Auswahl-State und Default-Regeln fuer Bild-Items (Stills). State in
// session.still = { version, assetId }. Mengenlogik kommt aus stills/stillAssets.

import {
  stillsForVideo, stillsForVersion, pickStillAsset, defaultStillSelection, finalStills, pickLatestAsset
} from '../../../stills/stillAssets.js';
import { prefersFinal, pickIntentFinal } from './intent.js';

/** Stills, unter denen der Nutzer beim aktuellen Bild-Item waehlen kann. */
export function stillImages(session) {
  const item = session.current;
  if (!item || item.type !== 'bild') return [];
  const all = item.koop?._bilder || [];
  const videoId = item.video?.id || item.image?.video_id;
  if (videoId) {
    const assigned = stillsForVideo(all, videoId);
    if (assigned.length) return assigned;
  }
  return item.image ? [item.image] : [];
}

/** Stills der gewaehlten Version. */
export function stillsForSelectedVersion(session) {
  return stillsForVersion(stillImages(session), session.still.version);
}

/** Aktuell angezeigtes Still (gewaehltes, sonst das Bild des Items). */
export function currentStillAsset(session) {
  return pickStillAsset(stillImages(session), session.still.version, session.still.assetId)
    || session.current?.image
    || null;
}

/** Setzt die Default-Auswahl des aktuellen Bild-Items (optional mit Final-Intent). */
export function applyStillDefault(session, intent = null) {
  const images = stillImages(session);
  const preferred = pickIntentFinal(finalStills(images), intent);
  if (preferred) {
    session.still = { version: 'final', assetId: preferred.id };
    return;
  }
  // Das angeklickte Bild selbst gewinnt (jedes Item zeigt sein eigenes Still).
  const own = session.current?.image;
  if (own?.id) {
    session.still = { version: own.is_final ? 'final' : (own.version_number || 1), assetId: own.id };
    return;
  }
  const sel = defaultStillSelection(images, { preferFinal: prefersFinal(session.table) });
  session.still = { version: sel.selectedVersion, assetId: sel.selectedAssetId };
}

/** Versions-Select: gewaehlte Version, dort das neueste Still. */
export function selectStillVersion(session, raw) {
  const version = raw === 'final' ? 'final' : Number(raw);
  session.still = { ...session.still, version };
  const variants = stillsForSelectedVersion(session);
  session.still = { version, assetId: pickLatestAsset(variants)?.id || variants[0]?.id || null };
}

/** Varianten-Select (ohne Item-Wechsel). */
export function selectStillVariant(session, assetId) {
  session.still = { ...session.still, assetId };
}
