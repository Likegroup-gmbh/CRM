// playerFeedbackTarget
// In welchen Feedback-Slot schreibt der Player fuer das aktuelle Item?
// Reine Funktion aus Session (Item + Auswahl) und Tabellen-Kontext.

import { resolveVideoFeedbackTarget } from '../../VideoFeedbackBuckets.js';

/** Finale Version: kein Feedback-Slot (Feedback nur in den Schleifen). */
function readonlyFinal(videoId, kind) {
  return {
    videoId,
    kind,
    target: { slot: null, counterpartSlot: null, readonly: true, isFinal: true },
  };
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
    if (session.video.version === 'final') return readonlyFinal(videoId, 'video');
    return {
      videoId,
      kind: 'video',
      target: resolveVideoFeedbackTarget(session.video.version || 1, table.isKundeRole()),
    };
  }

  if (item.type === 'story') {
    const videoId = item.slot.video_id || item.video?.id || null;
    if (!videoId) return null;
    if (session.story.version === 'final') return readonlyFinal(videoId, 'video');
    return {
      videoId,
      kind: 'video',
      target: resolveVideoFeedbackTarget(session.story.version || 1, table.isKundeRole()),
    };
  }

  // bild
  const koopVideos = table.videos[item.koop.id] || [];
  const videoId = item.video?.id || item.image?.video_id || koopVideos[0]?.id || null;
  if (!videoId) return null;
  if (session.still.version === 'final') return readonlyFinal(videoId, 'still');
  const version = session.still.version || item.image?.version_number || 1;
  return { videoId, kind: 'still', target: resolveVideoFeedbackTarget(version, table.isKundeRole()) };
}
