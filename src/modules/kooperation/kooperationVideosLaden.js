// kooperationVideosLaden.js
// Daten des Videos-Tabs der Kooperations-Detailseite: Videos mit aktuellem Asset, Kontingent
// der Kampagne, Feedback-Notizen je Slot und die Kommentare aus dem Videos-Tab der Kampagne.
// detail = KooperationDetail (kooperationId, kooperation); gesetzt werden videos und campaignVideoTotals.

import {
  createEmptyVideoFeedbackComments,
  getVideoFeedbackBucket,
  isMissingFeedbackTypeError,
  VIDEO_FEEDBACK_LEGACY_SELECT
} from '../../core/VideoFeedbackBuckets.js';
import { loadZeitkommentare } from '../kampagne/videoTableQueries.js';

const VIDEO_SELECT = 'id, content_art, kampagnenart, einkaufspreis_netto, verkaufspreis_netto, skript_deadline, content_deadline, titel, asset_url, folder_url, kommentar, status, position, created_at';
const FEEDBACK_SELECT = 'id, video_id, runde, feedback_typ, text, created_at, author_name, deleted_at';

async function ladeAktuelleAssets(videoIds) {
  const { data } = await window.supabase
    .from('kooperation_video_asset')
    .select('id, video_id, file_url, version_number, is_current, created_at')
    .in('video_id', videoIds)
    .eq('is_current', true);
  return data || [];
}

/** Videos der ganzen Kampagne gegen ihr Kontingent, null ohne Kampagne oder bei Fehler. */
async function ladeKontingent(kooperation) {
  try {
    const kampId = kooperation?.kampagne?.id || kooperation?.kampagne_id;
    if (!kampId) return null;
    const { data: koopCounts } = await window.supabase
      .from('kooperationen')
      .select('videoanzahl')
      .eq('kampagne_id', kampId);
    const used = (koopCounts || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
    const total = parseInt(kooperation?.kampagne?.videoanzahl, 10) || null;
    return { total, used, remaining: total != null ? Math.max(0, total - used) : null };
  } catch (_) {
    return null;
  }
}

/** Feedback-Notizen je Video und Slot, null bei Fehler. */
async function ladeFeedback(videoIds) {
  try {
    const query = (select) => window.supabase
      .from('kooperation_video_comment')
      .select(select)
      .in('video_id', videoIds)
      .order('created_at', { ascending: true });
    let { data: comments, error } = await query(FEEDBACK_SELECT);
    if (error && isMissingFeedbackTypeError(error)) {
      ({ data: comments, error } = await query(`${VIDEO_FEEDBACK_LEGACY_SELECT}, deleted_at`));
    }
    if (error) throw error;
    const byVideo = {};
    (comments || []).forEach(c => {
      if (!byVideo[c.video_id]) byVideo[c.video_id] = createEmptyVideoFeedbackComments();
      byVideo[c.video_id][getVideoFeedbackBucket(c)].push(c);
    });
    return byVideo;
  } catch (err) {
    console.warn('⚠️ Fehler beim Laden der Video-Kommentare:', err?.message);
    return null;
  }
}

export async function ladeKooperationVideos(detail) {
  try {
    const { data: videos } = await window.supabase
      .from('kooperation_videos')
      .select(VIDEO_SELECT)
      .eq('kooperation_id', detail.kooperationId)
      .order('position', { ascending: true });

    detail.videos = videos || [];
    const videoIds = detail.videos.map(v => v.id);
    const [assets, totals, feedback, zeit] = await Promise.all([
      videoIds.length ? ladeAktuelleAssets(videoIds) : [],
      ladeKontingent(detail.kooperation),
      videoIds.length ? ladeFeedback(videoIds) : null,
      videoIds.length ? loadZeitkommentare(videoIds).catch(() => ({})) : {}
    ]);
    detail.campaignVideoTotals = totals;
    detail.videos = detail.videos.map(v => ({
      ...v,
      currentAsset: assets.find(a => a.video_id === v.id) || null,
      ...(feedback ? { feedback: feedback[v.id] || createEmptyVideoFeedbackComments() } : {}),
      zeitkommentare: zeit[v.id] || []
    }));
  } catch (err) {
    console.warn('⚠️ Fehler beim Laden der Videos:', err?.message);
    detail.videos = [];
  }
}
