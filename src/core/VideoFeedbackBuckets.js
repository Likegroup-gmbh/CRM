export const VIDEO_FEEDBACK_FIELDS = [
  { field: 'feedback_cj_r1', bucket: 'cjR1', runde: 1, feedback_typ: 'cj', label: 'CJ Feedback 1', colClass: 'col-feedback-cj-1' },
  { field: 'feedback_kunde_r1', bucket: 'kundeR1', runde: 1, feedback_typ: 'kunde', label: 'Kunde Feedback 1', colClass: 'col-feedback-kunde-1' },
  { field: 'feedback_cj_r2', bucket: 'cjR2', runde: 2, feedback_typ: 'cj', label: 'CJ Feedback 2', colClass: 'col-feedback-cj-2' },
  { field: 'feedback_kunde_r2', bucket: 'kundeR2', runde: 2, feedback_typ: 'kunde', label: 'Kunde Feedback 2', colClass: 'col-feedback-kunde-2' },
  { field: 'feedback_cj_r3', bucket: 'cjR3', runde: 3, feedback_typ: 'cj', label: 'CJ Feedback 3', colClass: 'col-feedback-cj-3' },
  { field: 'feedback_kunde_r3', bucket: 'kundeR3', runde: 3, feedback_typ: 'kunde', label: 'Kunde Feedback 3', colClass: 'col-feedback-kunde-3' }
];

export const VIDEO_FEEDBACK_MAX_RUNDE = 3;

export const VIDEO_FEEDBACK_SELECT = 'id, video_id, text, runde, feedback_typ, author_name, created_at';
export const VIDEO_FEEDBACK_LEGACY_SELECT = 'id, video_id, text, runde, author_name, created_at';

export const VIDEO_FEEDBACK_FIELD_MAP = VIDEO_FEEDBACK_FIELDS.reduce((map, slot) => {
  map[slot.field] = slot;
  return map;
}, {});

export function createEmptyVideoFeedbackComments() {
  return { cjR1: [], kundeR1: [], cjR2: [], kundeR2: [], cjR3: [], kundeR3: [] };
}

export function normalizeVideoFeedbackComments(comments) {
  return {
    ...createEmptyVideoFeedbackComments(),
    ...(comments || {})
  };
}

export function getVideoFeedbackSlotByField(fieldName) {
  return VIDEO_FEEDBACK_FIELD_MAP[fieldName] || null;
}

export function getVideoFeedbackSlot(runde, feedbackTyp) {
  return VIDEO_FEEDBACK_FIELDS.find(
    slot => slot.runde === Number(runde) && slot.feedback_typ === feedbackTyp
  ) || null;
}

/**
 * Mappt eine Video-Version (Feedbackschleife) + Rolle auf das passende
 * Feedback-Ziel im Player.
 *  - Version 1 -> Runde 1, Version 2 -> Runde 2, Version 3+ -> Runde 3.
 *  - Alle Feedbackschleifen sind editierbar; die finale Version laeuft
 *    separat ueber is_final-Assets (dort gibt es keinen Feedback-Slot).
 *  - feedback_typ: Kunde -> 'kunde', sonst 'cj'.
 * @param {number} version
 * @param {boolean} isKunde
 * @returns {{ runde: number, feedback_typ: string, slot: object|null, counterpartSlot: object|null, readonly: boolean }}
 */
export function resolveVideoFeedbackTarget(version, isKunde) {
  const v = Number(version) || 1;
  const runde = Math.min(Math.max(v, 1), VIDEO_FEEDBACK_MAX_RUNDE);
  const feedbackTyp = isKunde ? 'kunde' : 'cj';
  const slot = getVideoFeedbackSlot(runde, feedbackTyp);
  const counterpartSlot = getVideoFeedbackSlot(runde, feedbackTyp === 'kunde' ? 'cj' : 'kunde');
  return { runde, feedback_typ: feedbackTyp, slot, counterpartSlot, readonly: false };
}

export function getVideoFeedbackBucket(comment) {
  const hasType = comment?.feedback_typ === 'cj' || comment?.feedback_typ === 'kunde';
  if (!hasType) {
    return Number(comment?.runde) === 2 ? 'kundeR1' : 'cjR1';
  }

  const rawRunde = Number(comment?.runde);
  const runde = rawRunde === 2 || rawRunde === 3 ? rawRunde : 1;
  return comment.feedback_typ === 'kunde' ? `kundeR${runde}` : `cjR${runde}`;
}

export function groupVideoFeedbackComments(comments) {
  const grouped = createEmptyVideoFeedbackComments();
  (comments || []).forEach(comment => {
    const bucket = getVideoFeedbackBucket(comment);
    grouped[bucket].push(comment);
  });
  return grouped;
}

export function replaceVideoFeedbackBucket(currentComments, bucket, nextComments) {
  return {
    ...normalizeVideoFeedbackComments(currentComments),
    [bucket]: nextComments || []
  };
}

export function formatVideoFeedbackValue(comments, bucket) {
  return (normalizeVideoFeedbackComments(comments)[bucket] || [])
    .map(comment => comment.text)
    .join('\n\n---\n\n');
}

export function isMissingFeedbackTypeError(error) {
  const message = String(error?.message || error?.details || '');
  return message.includes('feedback_typ');
}
