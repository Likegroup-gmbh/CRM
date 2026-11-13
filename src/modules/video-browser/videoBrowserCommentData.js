// videoBrowserCommentData.js
// Kommentare des Videos-Tabs: Runden-Notizen, Bild-Notizen und Zeitkommentare in einer Liste.

const authorOf = (c) => ({ name: c.author_name || 'Unbekannt', role: c.feedback_typ === 'kunde' ? 'kunde' : 'team' });

export function normalizeComments(slotNotes, zeitkommentare, stillNotes) {
  const slots = (slotNotes || []).filter(c => !c.deleted_at && c.text).map(c => ({
    id: `slot-${c.id}`,
    author: authorOf(c),
    text: c.text,
    timecodeSec: null,
    createdAt: c.created_at,
    runde: c.runde,
    assetId: null
  }));
  // Feedback zu den Bildern einer Runde (eine Notiz je Video, Runde und Rolle)
  const stills = (stillNotes || []).filter(c => !c.deleted_at && c.text).map(c => ({
    id: `still-${c.id}`,
    author: authorOf(c),
    text: c.text,
    timecodeSec: null,
    createdAt: c.created_at,
    runde: c.runde,
    assetId: null,
    scope: 'still'
  }));
  const zeit = (zeitkommentare || []).filter(c => !c.deleted_at && c.text).map(c => ({
    id: c.id,
    author: authorOf(c),
    text: c.text,
    timecodeSec: c.timecode_sec === null || c.timecode_sec === undefined ? null : Number(c.timecode_sec),
    createdAt: c.created_at,
    runde: c.runde,
    // Video, Story oder Bild: die IDs kommen aus verschiedenen Tabellen, höchstens eine ist gesetzt
    assetId: c.asset_id || c.story_asset_id || c.still_asset_id || null
  }));
  return [...slots, ...stills, ...zeit].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/**
 * Kommentare einer Datei in ihrer Runde. Jede Datei sieht ihre eigenen Kommentare, dazu:
 *  - Video: die der Schleife ohne Zuordnung (nicht die Bild-Notizen).
 *  - Story: die Runden-Notizen ohne Zeitstempel (ein Zeitstempel ohne Datei gehört zum Video).
 *  - Bild: die Bild-Notizen der Runde.
 */
export function commentsForAsset(comments, runde, assetId, type = 'video') {
  const inRunde = (comments || []).filter(c => c.runde === runde);
  const eigene = (c) => !!c.assetId && c.assetId === assetId;
  if (type === 'still') return inRunde.filter(c => c.scope === 'still' || eigene(c));
  const ohneBild = inRunde.filter(c => c.scope !== 'still');
  if (type === 'story') return ohneBild.filter(c => (!c.assetId && c.timecodeSec === null) || eigene(c));
  return ohneBild.filter(c => !c.assetId || eigene(c));
}
