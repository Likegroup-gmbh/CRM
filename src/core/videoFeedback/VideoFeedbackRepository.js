// VideoFeedbackRepository
// Single Source of Truth fuer das Schreiben eines Video-Feedback-Slots.
// Tabelle, Player UND die Video-Detailseite gehen ueber diese eine Funktion,
// damit das Speichermodell (eine aktive Zeile pro Slot) nie wieder auseinander
// laeuft.
//
// Modell:
//  - Text vorhanden -> Upsert auf (video_id, runde, feedback_typ). Ueberschreibt
//    sicher statt loeschen+neu und belebt eine zuvor soft-geloeschte Zeile
//    wieder (deleted_at -> null).
//  - Text leer -> die eine aktive Zeile soft-loeschen (deleted_at = now), kein
//    Hard-Delete.

import { VIDEO_FEEDBACK_SELECT } from '../VideoFeedbackBuckets.js';

/**
 * @param {object} args
 * @param {string} args.videoId
 * @param {{ runde: number, feedback_typ: string }} args.slot
 * @param {string} args.text - Roh-Eingabe (wird getrimmt)
 * @param {{ id?: string, name?: string }} [args.user]
 * @param {string} [args.select] - SELECT fuer die zurueckgegebene Zeile
 * @returns {Promise<{ row: object|null, deleted: boolean }>}
 */
export async function saveVideoFeedbackSlot({ videoId, slot, text, user, select = VIDEO_FEEDBACK_SELECT }) {
  const trimmed = (text || '').trim();
  const nowIso = new Date().toISOString();

  if (trimmed) {
    const { data, error } = await window.supabase
      .from('kooperation_video_comment')
      .upsert({
        video_id: videoId,
        runde: slot.runde,
        feedback_typ: slot.feedback_typ,
        text: trimmed,
        author_benutzer_id: user?.id || null,
        author_name: user?.name || 'Unbekannt',
        is_public: true,
        deleted_at: null,
        deleted_by_benutzer_id: null,
        updated_at: nowIso
      }, { onConflict: 'video_id,runde,feedback_typ' })
      .select(select)
      .single();

    if (error) throw error;
    return { row: data, deleted: false };
  }

  const { error } = await window.supabase
    .from('kooperation_video_comment')
    .update({
      deleted_at: nowIso,
      deleted_by_benutzer_id: user?.id || null,
      updated_at: nowIso
    })
    .eq('video_id', videoId)
    .eq('runde', slot.runde)
    .eq('feedback_typ', slot.feedback_typ)
    .is('deleted_at', null);

  if (error) throw error;
  return { row: null, deleted: true };
}
