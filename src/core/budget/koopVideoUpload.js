// koopVideoUpload.js
// Ob zu einer Kooperation schon ein Video hochgeladen ist: Voraussetzung fuer
// jede Creator-Rechnung. Zaehlt jede Datei in kooperation_video_asset
// (Feedbackschleife oder Final) und das alte asset_url am Video.
// link_content ist ein externer Link, kein Upload.

export const VIDEO_UPLOAD_SELECT = 'asset_url, kooperation_video_asset(id)';

export const UPLOAD_FEHLT = Object.freeze({
  titel: 'Noch kein Video hochgeladen',
  text: 'Eine Rechnung lässt sich erst anlegen, wenn zur Kooperation mindestens ein Video hochgeladen ist.'
});

export function videoHatUpload(video) {
  if (!video) return false;
  if (String(video.asset_url || '').trim()) return true;
  return (video.kooperation_video_asset || []).length > 0;
}

// Set der Kooperations-IDs mit mindestens einem hochgeladenen Video.
// Erwartet Zeilen aus kooperation_videos mit kooperation_id und VIDEO_UPLOAD_SELECT.
export function koopsMitUpload(videos = []) {
  const ids = new Set();
  (videos || []).forEach((v) => {
    if (v?.kooperation_id && videoHatUpload(v)) ids.add(v.kooperation_id);
  });
  return ids;
}

// Einzelpruefung vor dem Speichern. Kann der Stand nicht gelesen werden,
// gilt die Kooperation als gesperrt.
export async function pruefeKoopUpload(supabase, kooperationId) {
  if (!kooperationId) return { ok: false, message: UPLOAD_FEHLT.text };
  const { data, error } = await supabase
    .from('kooperation_videos')
    .select(`kooperation_id, ${VIDEO_UPLOAD_SELECT}`)
    .eq('kooperation_id', kooperationId);
  if (error) {
    return { ok: false, message: 'Der Video-Upload konnte nicht geprüft werden. Bitte erneut versuchen.' };
  }
  return koopsMitUpload(data).has(kooperationId)
    ? { ok: true, message: null }
    : { ok: false, message: UPLOAD_FEHLT.text };
}
