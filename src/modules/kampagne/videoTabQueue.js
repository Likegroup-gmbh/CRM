// videoTabQueue.js
// Warteschlange im Video-Tab des VideoUploadDrawers (`h` = VideoTabHandler): Dateien prüfen und
// aufnehmen, Zeilen rendern, Variante und Feedbackschleife je Zeile ändern.

import {
  FINAL_VARIANTS,
  MAX_VIDEO_SIZE,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
} from '../../core/VideoUploadUtils.js';
import { queueItemHtml } from './videoTabRender.js';

export const MAX_VIDEO_MB = Math.round(MAX_VIDEO_SIZE / (1024 * 1024));

/** @returns {string|null} Fehlertext oder null, wenn die Datei hochgeladen werden darf */
export function validateVideoFile(file) {
  if (file.size > MAX_VIDEO_SIZE) {
    return `${file.name}: zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max. ${MAX_VIDEO_MB} MB)`;
  }
  if (!VIDEO_MIME_TYPES.includes(file.type) && !VIDEO_EXTENSIONS.test(file.name)) {
    return `${file.name}: kein unterstütztes Videoformat`;
  }
  return null;
}

/** Neuer Eintrag: Finale Version, wenn vorgewählt, sonst die jüngste vorhandene Feedbackschleife. */
export function newQueueEntry(h, base) {
  if (h.drawer.preselectFinal) {
    return { ...base, variantName: FINAL_VARIANTS[0], versionNumber: 1, isFinal: true };
  }
  const defaultVersion = h._existingVersions.length > 0 ? Math.max(...h._existingVersions) : 1;
  return { ...base, variantName: '', versionNumber: defaultVersion };
}

export function addFiles(h, files) {
  h.hideError();
  const rejected = [];

  for (const file of files) {
    const invalid = validateVideoFile(file);
    if (invalid) {
      rejected.push(invalid);
      continue;
    }
    const alreadyQueued = h._queue.some(q => q.file.name === file.name && q.file.size === file.size);
    if (!alreadyQueued) h._queue.push(newQueueEntry(h, { file }));
  }

  if (rejected.length) h.showError(rejected.join('\n'));
  renderQueue(h);
  h._updateSubmitButtonState();
}

function removeQueueItem(h, idx) {
  h._queue.splice(idx, 1);
  renderQueue(h);
  h._updateSubmitButtonState();
}

export function renderQueue(h) {
  const list = document.getElementById('video-upload-queue');
  if (!list) return;
  const opts = { existingVersions: h._existingVersions, external: !!h.drawer.useExternalLinks };
  list.innerHTML = h._queue.map((item, i) => queueItemHtml(item, i, opts)).join('');
}

function onVersionChange(h, item, value) {
  if (value === 'final') {
    item.isFinal = true;
    item.versionNumber = 1;
    item.variantName = FINAL_VARIANTS[0];
  } else {
    if (item.isFinal) item.variantName = '';
    item.isFinal = false;
    item.versionNumber = parseInt(value, 10);
  }
  renderQueue(h);
  h._updateSubmitButtonState();
}

export function bindQueueEvents(h) {
  const queueEl = document.getElementById('video-upload-queue');
  const itemOf = (el) => h._queue[parseInt(el.dataset.idx, 10)];

  queueEl?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.video-file-remove');
    if (removeBtn) removeQueueItem(h, parseInt(removeBtn.dataset.idx, 10));
  });
  queueEl?.addEventListener('input', (e) => {
    const variantInput = e.target.closest('.video-variant-name-input');
    if (variantInput) {
      const item = itemOf(variantInput);
      if (item) item.variantName = variantInput.value;
      h._updateSubmitButtonState();
    }
    const urlInput = e.target.closest('.video-link-url-input');
    if (urlInput) {
      const item = itemOf(urlInput);
      if (item) item.url = urlInput.value;
      h._updateSubmitButtonState();
    }
  });
  queueEl?.addEventListener('change', (e) => {
    const versionSelect = e.target.closest('.video-version-select');
    if (versionSelect) {
      const item = itemOf(versionSelect);
      if (item) onVersionChange(h, item, versionSelect.value);
    }
    const finalVariantSelect = e.target.closest('.video-final-variant-select');
    if (finalVariantSelect) {
      const item = itemOf(finalVariantSelect);
      if (item) item.variantName = finalVariantSelect.value;
    }
  });
}
