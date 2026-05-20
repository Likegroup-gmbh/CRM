// runStorysUploadJob.js
// Pure Job-Runner für Storys-Upload (StorysTabHandler).

import { uploadFileDirect } from '../DropboxDirectUploader.js';
import { createFolderSharedLink } from '../VideoUploadUtils.js';

async function prepareStorysUpload({ metadaten, slotIndex, versionNumber, variantName, fileName }) {
  const payload = {
    unternehmen: metadaten.unternehmen || '',
    marke: metadaten.marke || '',
    kampagne: metadaten.kampagne || '',
    kooperation: metadaten.kooperationName || '',
    videoPosition: metadaten.videoPosition || 1,
    videoThema: metadaten.videoThema || '',
    slotIndex,
    versionNumber,
    variantName,
    fileName,
    action: 'prepare',
  };
  const resp = await fetch('/.netlify/functions/dropbox-upload-storys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${resp.status})`);
  }
  return resp.json();
}

async function createSharedLink(token, dropboxPath) {
  try {
    const resp = await fetch('/.netlify/functions/dropbox-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shared-link', path: dropboxPath, token }),
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url?.replace('?dl=0', '?raw=1') || null;
  } catch {
    return null;
  }
}

async function updateCurrentFlagsForSlot(slotId) {
  const { data: allAssets } = await window.supabase
    .from('kooperation_story_asset')
    .select('id, version_number')
    .eq('story_id', slotId);
  if (!allAssets || allAssets.length === 0) return;
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
  let videoFolderUrl = null;
  const slotsTouched = new Set();
  let uploaded = 0;

  for (let i = 0; i < queue.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const queueItem = queue[i];
    const file = queueItem.file;
    const versionNumber = queueItem.versionNumber;
    let slotId = queueItem.slotId;
    let slotIndex;
    const variantName = (queueItem.variantName || '').trim();
    const item = job.items[i];

    updateItem(item.id, { status: 'uploading', loaded: 0, total: file.size, transport: 'direct' });

    // Slot anlegen falls nötig
    if (slotId === '__new__') {
      const maxIdx = storySlots.reduce((m, s) => Math.max(m, s.slot_index || 0), 0);
      slotIndex = maxIdx + 1;
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
    } else {
      const slot = storySlots.find(s => s.id === slotId);
      slotIndex = slot?.slot_index || 1;
    }
    slotsTouched.add(slotId);

    const prep = await prepareStorysUpload({
      metadaten, slotIndex, versionNumber, variantName, fileName: file.name,
    });
    const token = prep.token;
    const dropboxPath = prep.dropboxPath;
    if (prep.videoFolderPath) videoFolderUrl = prep.videoFolderPath;

    const getToken = async () => {
      const fresh = await prepareStorysUpload({
        metadaten, slotIndex, versionNumber, variantName, fileName: file.name,
      });
      return fresh.token;
    };

    await uploadFileDirect({
      file,
      dropboxPath,
      token,
      getToken,
      signal,
      onProgress: ({ loaded, total, phase }) => {
        const patch = { loaded, total };
        if (phase === 'proxy-fallback') patch.transport = 'proxy';
        updateItem(item.id, patch);
      },
    });

    updateItem(item.id, { status: 'saving' });

    const fileUrl = await createSharedLink(token, dropboxPath);

    const { error: insertErr } = await window.supabase
      .from('kooperation_story_asset')
      .insert({
        story_id: slotId,
        video_id: videoId,
        file_url: fileUrl,
        file_path: dropboxPath,
        file_name: file.name,
        file_size: file.size,
        version_number: versionNumber,
        variant_name: variantName || null,
        is_current: true,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString(),
      });
    if (insertErr) throw insertErr;

    updateItem(item.id, { status: 'done', loaded: file.size });
    uploaded++;
  }

  // is_current pro Slot aktualisieren
  for (const slotId of slotsTouched) {
    await updateCurrentFlagsForSlot(slotId);
  }

  // Storys-Folder-Link einmal anhängen
  let storysFolderUrl = null;
  if (videoFolderUrl) {
    try {
      const tokenResp = await fetch('/.netlify/functions/dropbox-upload-storys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unternehmen: metadaten.unternehmen || '',
          marke: metadaten.marke || '',
          kampagne: metadaten.kampagne || '',
          kooperation: metadaten.kooperationName || '',
          videoPosition: metadaten.videoPosition || 1,
          videoThema: metadaten.videoThema || '',
          slotIndex: 1,
          versionNumber: 1,
          action: 'prepare',
        }),
      });
      if (tokenResp.ok) {
        const tokenData = await tokenResp.json();
        storysFolderUrl = await createFolderSharedLink(tokenData.token, tokenData.videoFolderPath);
      }
    } catch (err) {
      console.warn('[StorysUpload] Folder-Link fehlgeschlagen:', err);
    }
  }

  if (storysFolderUrl) {
    await window.supabase
      .from('kooperation_videos')
      .update({ story_folder_url: storysFolderUrl })
      .eq('id', videoId);
  }

  return { uploaded, storysFolderUrl };
}
