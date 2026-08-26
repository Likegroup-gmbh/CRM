import { VIDEO_FEEDBACK_SELECT } from '../VideoFeedbackBuckets.js';

const STILL_FEEDBACK_SELECT = VIDEO_FEEDBACK_SELECT;

export async function saveStillFeedbackSlot({ videoId, slot, text, user, select = STILL_FEEDBACK_SELECT }) {
  const trimmed = (text || '').trim();
  const nowIso = new Date().toISOString();

  const baseName = user?.name || 'Unbekannt';
  const authorName = String(user?.rolle || '').toLowerCase() === 'gast' ? `${baseName} (Gast)` : baseName;

  if (trimmed) {
    const { data, error } = await window.supabase
      .from('kooperation_still_comment')
      .upsert({
        video_id: videoId,
        runde: slot.runde,
        feedback_typ: slot.feedback_typ,
        text: trimmed,
        author_benutzer_id: user?.id || null,
        author_name: authorName,
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
    .from('kooperation_still_comment')
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
