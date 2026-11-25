import { FINAL_VARIANTS } from './VideoUploadUtils.js';
import { STILL_FINAL_VARIANT, updateStillCurrentFlags } from './stills/stillAssets.js';
import { mitAblage } from './ablage/ablageLink.js';
import { ablageVonQuelle } from './ablage/ablageUpload.js';

export { STILL_FINAL_VARIANT };

const VIDEO_FINAL_SELECT = mitAblage('id, video_id, file_url, file_path, variant_name, titel, is_final, source_asset_id, created_at');
const STILL_FINAL_SELECT = mitAblage('id, kooperation_id, video_id, file_url, file_path, file_name, file_size, variant_name, titel, is_final, source_asset_id, created_at');

const STORY_FINAL_SELECT = mitAblage('id, video_id, story_id, file_url, file_path, file_name, file_size, variant_name, titel, is_final, source_asset_id, created_at');

function userId() {
  return window.currentUser?.id || null;
}

/**
 * Haengt eine weitere finale Version an. Andere finale Versionen desselben
 * Seitenverhaeltnisses bleiben. Ein vorhandener Verweis derselben Quelle wird
 * ersetzt, damit ein erneutes Markieren keine zweite Zeile erzeugt.
 * @param {'video'|'still'} kind
 * @param {object} sourceAsset
 * @param {string} slot  9:16 | 4:5 | 1:1 | Still
 */
export async function promoteAssetToFinal(kind, sourceAsset, slot) {
  if (!sourceAsset?.id) throw new Error('Quell-Asset fehlt');
  if (kind === 'video') {
    if (!FINAL_VARIANTS.includes(slot)) throw new Error(`Unbekannter Final-Slot: ${slot}`);
    return promoteVideo(sourceAsset, slot);
  }
  if (kind === 'story') {
    if (!FINAL_VARIANTS.includes(slot)) throw new Error(`Unbekannter Final-Slot: ${slot}`);
    return promoteStory(sourceAsset, slot);
  }
  return promoteStill(sourceAsset);
}

export async function unmarkFinalSlot(kind, videoId, slot, sourceAssetId) {
  if (kind === 'story') {
    if (!sourceAssetId) throw new Error('sourceAssetId fehlt');
    const { error } = await window.supabase
      .from('kooperation_story_asset')
      .delete()
      .eq('is_final', true)
      .eq('source_asset_id', sourceAssetId);
    if (error) throw error;
    return;
  }
  if (!videoId) throw new Error('videoId fehlt');
  if (kind === 'video') {
    if (!sourceAssetId) throw new Error('sourceAssetId fehlt');
    if (!slot) throw new Error('Final-Slot fehlt');
    const { error } = await window.supabase
      .from('kooperation_video_asset')
      .delete()
      .eq('video_id', videoId)
      .eq('is_final', true)
      .eq('variant_name', slot)
      .eq('source_asset_id', sourceAssetId);
    if (error) throw error;
    return;
  }
  const { error } = await window.supabase
    .from('kooperation_bilder_asset')
    .delete()
    .eq('video_id', videoId)
    .eq('is_final', true);
  if (error) throw error;
}

async function promoteVideo(source, slot) {
  await unmarkFinalSlot('video', source.video_id, slot, source.id);

  const { data, error } = await window.supabase
    .from('kooperation_video_asset')
    .insert({
      video_id: source.video_id,
      file_url: source.file_url,
      file_path: source.file_path,
      version_number: 1,
      variant_name: slot,
      titel: source.titel || null,
      is_current: false,
      is_final: true,
      source_asset_id: source.id,
      description: source.description || null,
      ...ablageVonQuelle(source),
      uploaded_by: userId(),
      created_at: new Date().toISOString(),
    })
    .select(VIDEO_FINAL_SELECT)
    .single();
  if (error) throw error;
  return data;
}

async function promoteStory(source, slot) {
  if (!source.story_id) throw new Error('Story braucht eine Slot-Zuordnung');
  // Erneutes Markieren derselben Quelle ersetzt den alten Verweis
  await unmarkFinalSlot('story', source.video_id, slot, source.id);

  const { data, error } = await window.supabase
    .from('kooperation_story_asset')
    .insert({
      story_id: source.story_id,
      video_id: source.video_id || null,
      file_url: source.file_url,
      file_path: source.file_path,
      file_name: source.file_name,
      file_size: source.file_size || 0,
      version_number: 1,
      variant_name: slot,
      titel: source.titel || null,
      is_current: false,
      is_final: true,
      source_asset_id: source.id,
      ...ablageVonQuelle(source),
      uploaded_by: userId(),
      created_at: new Date().toISOString(),
    })
    .select(STORY_FINAL_SELECT)
    .single();
  if (error) throw error;
  return data;
}

async function promoteStill(source) {
  if (!source.video_id) throw new Error('Still braucht eine Video-Zuordnung');

  await window.supabase
    .from('kooperation_bilder_asset')
    .delete()
    .eq('video_id', source.video_id)
    .eq('is_final', true);

  const { data, error } = await window.supabase
    .from('kooperation_bilder_asset')
    .insert({
      kooperation_id: source.kooperation_id,
      video_id: source.video_id,
      file_url: source.file_url,
      file_path: source.file_path,
      file_name: source.file_name,
      file_size: source.file_size || 0,
      version_number: 1,
      variant_name: STILL_FINAL_VARIANT,
      titel: source.titel || null,
      is_current: false,
      is_final: true,
      source_asset_id: source.id,
      ...ablageVonQuelle(source),
      uploaded_by: userId(),
      created_at: new Date().toISOString(),
    })
    .select(STILL_FINAL_SELECT)
    .single();
  if (error) throw error;
  await updateStillCurrentFlags(source.video_id);
  return data;
}

export function markedSlotsForSource(finalAssets, sourceAssetId) {
  return (finalAssets || [])
    .filter(a => a.source_asset_id === sourceAssetId)
    .map(a => a.variant_name)
    .filter(Boolean);
}
