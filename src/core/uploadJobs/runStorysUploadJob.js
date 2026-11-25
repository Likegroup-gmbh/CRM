// runStorysUploadJob.js
// Pure Job-Runner für Storys-Upload (StorysTabHandler).

import { nextFreeIndexedFileName, sanitizeFileName, fileBasename } from '../VideoUploadUtils.js';
import { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen } from '../ablage/ablageUpload.js';
import { trackUploadProgress } from './uploadFortschritt.js';

async function updateCurrentFlagsForSlot(slotId) {
  const { data: assets } = await window.supabase
    .from('kooperation_story_asset')
    .select('id, version_number, is_final')
    .eq('story_id', slotId);

  // is_current nur innerhalb der Feedbackschleifen verwalten
  const allAssets = (assets || []).filter(a => !a.is_final);
  if (allAssets.length === 0) return;
  const maxVersion = Math.max(...allAssets.map(a => a.version_number));
  const nonCurrentIds = allAssets.filter(a => a.version_number !== maxVersion).map(a => a.id);
  const currentIds = allAssets.filter(a => a.version_number === maxVersion).map(a => a.id);
  if (nonCurrentIds.length > 0) {
    await window.supabase
      .from('kooperation_story_asset')
      .update({ is_current: false })
      .in('id', nonCurrentIds);
  }
  if (currentIds.length > 0) {
    await window.supabase
      .from('kooperation_story_asset')
      .update({ is_current: true })
      .in('id', currentIds);
  }
}

export async function runStorysUploadJob(ctx) {
  const { job, signal, updateItem } = ctx;
  const { videoId, metadaten, queue, storySlots: initialSlots } = job.payload;

  if (!videoId) throw new Error('videoId fehlt');
  if (!Array.isArray(queue) || queue.length === 0) throw new Error('queue leer');

  const storySlots = Array.isArray(initialSlots) ? [...initialSlots] : [];
  let storysFolderUrl = null;
  const slotsTouched = new Set();
  let uploaded = 0;

  for (let i = 0; i < queue.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const queueItem = queue[i];
    const file = queueItem.file;
    const isFinal = !!queueItem.isFinal;
    const versionNumber = isFinal ? 1 : queueItem.versionNumber;
    let slotId = queueItem.slotId;
    const variantName = (queueItem.variantName || '').trim();
    const item = job.items[i];

    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size });

    // Slot anlegen falls nötig
    if (slotId === '__new__') {
      const slotIndex = storySlots.reduce((m, s) => Math.max(m, s.slot_index || 0), 0) + 1;
      const { data: newSlot, error: slotErr } = await window.supabase
        .from('kooperation_story')
        .insert({
          video_id: videoId,
          slot_index: slotIndex,
          created_by: window.currentUser?.id || null,
        })
        .select('id, video_id, slot_index, slot_name, created_at')
        .single();
      if (slotErr) throw slotErr;
      slotId = newSlot.id;
      storySlots.push({
        ...newSlot,
        assets: [],
        currentAsset: null,
        currentVersion: 0,
        existingVersions: [],
      });
    }
    slotsTouched.add(slotId);

    const slot = storySlots.find(s => s.id === slotId);
    let fileName = file.name;
    if (isFinal && slot) {
      const base = sanitizeFileName(file.name) || 'story.mp4';
      if (!slot._finalNamesByVariant) slot._finalNamesByVariant = {};
      if (!slot._finalNamesByVariant[variantName]) {
        slot._finalNamesByVariant[variantName] = (slot.assets || [])
          .filter(a => a.is_final && (a.variant_name || '') === variantName)
          .map(a => fileBasename(a.file_path) || sanitizeFileName(a.file_name || ''))
          .filter(Boolean);
      }
      fileName = nextFreeIndexedFileName(base, slot._finalNamesByVariant[variantName]);
      slot._finalNamesByVariant[variantName].push(fileName);
    }

    const ziel = await ablageZielHolen({
      typ: 'story',
      kooperation_id: metadaten?.kooperationId ?? null,
      kooperation_video_id: videoId,
      story_id: slotId,
      version_number: parseInt(versionNumber, 10) || 1,
      is_final: isFinal,
      variant_name: variantName || null,
      file_name: fileName,
      file_size: file.size,
    });
    const commit = await hochladenNachSharePoint({ ziel, file, signal, onProgress: trackUploadProgress(item, updateItem) });
    updateItem(item.id, { status: 'saving' });
    if (!storysFolderUrl) storysFolderUrl = commit.folder_url || null;
    if (isFinal && slot && commit.file_name) slot._finalNamesByVariant[variantName].push(commit.file_name);

    const felder = sharePointAssetFelder(commit);
    const { error: insertErr } = await window.supabase
      .from('kooperation_story_asset')
      .insert({
        story_id: slotId,
        video_id: videoId,
        ...felder,
        file_name: felder.file_name || fileName,
        file_size: felder.file_size ?? file.size,
        version_number: versionNumber,
        variant_name: variantName || null,
        is_current: !isFinal,
        is_final: isFinal,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString(),
      });
    if (insertErr) {
      await uploadVerwerfen(ziel.upload_id);
      throw insertErr;
    }

    updateItem(item.id, { status: 'done', loaded: file.size });
    uploaded++;
  }

  // is_current pro Slot aktualisieren
  for (const slotId of slotsTouched) {
    await updateCurrentFlagsForSlot(slotId);
  }

  if (storysFolderUrl) {
    await window.supabase
      .from('kooperation_videos')
      .update({ story_folder_url: storysFolderUrl })
      .eq('id', videoId);
  }

  return { uploaded, storysFolderUrl };
}
