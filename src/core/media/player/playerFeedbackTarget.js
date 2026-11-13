// playerFeedbackTarget
// In welchen Feedback-Slot schreibt der Player fuer das aktuelle Item?
// Reine Funktion aus Session (Item + Auswahl) und Tabellen-Kontext.

import { resolveVideoFeedbackTarget } from '../../VideoFeedbackBuckets.js';
import { currentStillAsset, stillImages } from './selection/still.js';

/**
 * Runde einer finalen Datei: die ihrer Quelle (source_asset_id), ohne Quelle die
 * hoechste Feedbackschleife, sonst 1. So bleibt die Finale kommentierbar.
 */
export function versionFuerFinal(assets, finalId) {
  const list = assets || [];
  const final = list.find(a => a.id === finalId) || list.find(a => a.is_final);
  const quelle = final?.source_asset_id ? list.find(a => a.id === final.source_asset_id && !a.is_final) : null;
  if (quelle) return quelle.version_number || 1;
  const loops = list.filter(a => !a.is_final).map(a => a.version_number || 1);
  return loops.length ? Math.max(...loops) : 1;
}

/**
 * @returns {{ videoId: string, kind: 'video'|'still', target: object }|null}
 */
export function feedbackTargetFor(session) {
  const item = session.current;
  if (!item) return null;
  const { table } = session;

  if (item.type === 'video') {
    const videoId = item.video.id;
    const version = session.video.version === 'final'
      ? versionFuerFinal(session.assets, session.video.assetId)
      : session.video.version || 1;
    return {
      videoId,
      kind: 'video',
      target: resolveVideoFeedbackTarget(version, table.isKundeRole()),
    };
  }

  if (item.type === 'story') {
    const videoId = item.slot.video_id || item.video?.id || null;
    if (!videoId) return null;
    const version = session.story.version === 'final'
      ? versionFuerFinal(item.slot.assets, session.story.finalAssetId)
      : session.story.version || 1;
    return {
      videoId,
      kind: 'video',
      target: resolveVideoFeedbackTarget(version, table.isKundeRole()),
    };
  }

  // bild
  const koopVideos = table.videos[item.koop.id] || [];
  const videoId = item.video?.id || item.image?.video_id || koopVideos[0]?.id || null;
  if (!videoId) return null;
  const version = session.still.version === 'final'
    ? versionFuerFinal(stillImages(session), session.still.assetId || currentStillAsset(session)?.id)
    : session.still.version || item.image?.version_number || 1;
  return { videoId, kind: 'still', target: resolveVideoFeedbackTarget(version, table.isKundeRole()) };
}
