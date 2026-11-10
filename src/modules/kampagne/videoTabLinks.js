// videoTabLinks.js
// Externe Links im Video-Tab des VideoUploadDrawers (`h` = VideoTabHandler): Umschalten
// zwischen Video-Link und geteiltem Ordner, Speichern beider Varianten.

import { normalizeExternalUrl, isValidExternalUrl } from '../../core/VideoUploadUtils.js';
import { renderLinkTab } from './videoTabRender.js';
import { newQueueEntry, renderQueue } from './videoTabQueue.js';
import { loadExistingVideoAssets } from './videoTabExisting.js';

export function renderLinkPane(h, activeTab) {
  return renderLinkTab(activeTab, { linkMode: h._linkMode, folderUrl: h._folderUrl });
}

export function bindLinkEvents(h, panel) {
  panel?.querySelectorAll('[data-link-mode]').forEach(btn => {
    btn.addEventListener('click', () => setLinkMode(h, btn.dataset.linkMode));
  });
  if (h._linkMode === 'folder') {
    const folderInput = document.getElementById('video-folder-url-input');
    folderInput?.addEventListener('input', () => {
      h._folderUrl = folderInput.value;
      h._updateSubmitButtonState();
    });
  } else {
    document.getElementById('video-link-add-btn')?.addEventListener('click', () => addLinkEntry(h));
  }
}

function setLinkMode(h, mode) {
  if (mode !== 'video' && mode !== 'folder') return;
  if (mode === h._linkMode) return;
  if (h._linkMode === 'folder') {
    const input = document.getElementById('video-folder-url-input');
    if (input) h._folderUrl = input.value;
  }
  h._linkMode = mode;
  const pane = document.getElementById('upload-tab-video');
  const panel = document.getElementById(h.drawer.drawerId);
  if (!pane || !panel) return;
  pane.outerHTML = renderLinkPane(h, h.drawer._activeTab);
  h.bindEvents(panel);
  if (mode === 'video') renderQueue(h);
  loadExistingVideoAssets(h);
}

function addLinkEntry(h) {
  h._queue.push(newQueueEntry(h, { url: '' }));
  renderQueue(h);
  h._updateSubmitButtonState();
  const list = document.getElementById('video-upload-queue');
  const lastInput = list?.querySelector(`.video-link-url-input[data-idx="${h._queue.length - 1}"]`);
  lastInput?.focus();
}

export async function handleFolderSubmit(h) {
  if (h._isUploading) return;
  h.hideError();

  const folderUrl = normalizeExternalUrl(h._folderUrl);
  if (!isValidExternalUrl(folderUrl)) {
    h.showError('Bitte eine gültige URL eingeben (https://...)');
    return;
  }

  h._isUploading = true;
  h._updateSubmitButtonState();

  try {
    const { error } = await window.supabase
      .from('kooperation_videos')
      .update({ folder_url: folderUrl })
      .eq('id', h.drawer.videoId);
    if (error) throw error;

    h._folderUrl = folderUrl;
    if (h.drawer.metadaten) h.drawer.metadaten.folderUrl = folderUrl;
    const input = document.getElementById('video-folder-url-input');
    if (input) input.value = folderUrl;
    h._isUploading = false;
    h._updateSubmitButtonState();

    const videoName = h.drawer.metadaten?.videoName || null;
    if (typeof h.drawer.onSuccess === 'function') {
      h.drawer.onSuccess(null, null, videoName, folderUrl);
    }
    window.toastSystem?.success?.('Ordner gespeichert');
  } catch (err) {
    console.error('[VideoTabHandler] Ordner-Submit fehlgeschlagen:', err);
    h.showError(err.message || 'Speichern fehlgeschlagen');
    h._isUploading = false;
    h._updateSubmitButtonState();
  }
}

// is_current und link_content leitet der Trigger auf kooperation_video_asset ab.
async function saveAssetVersion(h, fileUrl, variantName, versionNumber, isFinal = false) {
  const { error } = await window.supabase
    .from('kooperation_video_asset')
    .insert({
      video_id: h.drawer.videoId,
      file_url: fileUrl,
      file_path: null,
      version_number: parseInt(versionNumber, 10) || 1,
      variant_name: variantName || null,
      is_final: !!isFinal,
      description: null,
      uploaded_by: window.currentUser?.id || null,
      created_at: new Date().toISOString()
    });
  if (error) throw error;
}

async function readLinkContent(h) {
  const { data } = await window.supabase
    .from('kooperation_videos')
    .select('link_content')
    .eq('id', h.drawer.videoId)
    .maybeSingle();
  return data?.link_content ?? null;
}

export async function handleLinkSubmit(h) {
  if (h._queue.length === 0 || h._isUploading) return;
  h.hideError();

  const invalid = h._queue.filter(q => !isValidExternalUrl(normalizeExternalUrl(q.url)));
  if (invalid.length > 0) {
    h.showError('Bitte gültige URLs eingeben (https://...)');
    return;
  }

  h._isUploading = true;
  h._updateSubmitButtonState();

  try {
    let hasLoop = false;
    let hasFinal = false;
    for (const item of h._queue) {
      await saveAssetVersion(h, normalizeExternalUrl(item.url), item.variantName, item.versionNumber, item.isFinal);
      if (item.isFinal) hasFinal = true;
      else hasLoop = true;
    }

    const videoName = h.drawer.metadaten?.videoName || null;
    h._queue = [];
    renderQueue(h);
    h._isUploading = false;
    h._updateSubmitButtonState();

    if (hasLoop && typeof h.drawer.onSuccess === 'function') {
      h.drawer.onSuccess(await readLinkContent(h), null, videoName, null);
    }
    if (hasFinal) {
      h.drawer.onFinaleChanged?.(h.drawer.videoId);
    }

    loadExistingVideoAssets(h);
    window.toastSystem?.success?.('Links gespeichert');
  } catch (err) {
    console.error('[VideoTabHandler] Link-Submit fehlgeschlagen:', err);
    h.showError(err.message || 'Speichern fehlgeschlagen');
    h._isUploading = false;
    h._updateSubmitButtonState();
  }
}
