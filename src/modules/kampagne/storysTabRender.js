// storysTabRender.js
// HTML des Storys-Tabs im VideoUploadDrawer: Tab-Gerüst, Warteschlange und Story-Slots.
// Reine Funktionen.

import { MAX_VERSIONS, FINAL_VARIANTS, escapeHtml, mdcBtnIcon, ICON_UPLOAD_16 } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

export function storysTabHtml(activeTab, maxLabel) {
  return `
      <div id="upload-tab-storys" style="${activeTab !== 'storys' ? 'display:none' : ''}">
        <div class="storys-upload-drawer-content">
          <div class="existing-storys-section" id="existing-storys-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Story-Slots</span>
              <span class="existing-images-count" id="existing-storys-count"></span>
            </div>
            <div class="existing-images-list" id="existing-storys-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>

          <div class="upload-dropzone" id="storys-upload-dropzone">
            <div class="dropzone-content">
              ${icon('upload')}
              <p class="dropzone-text">Story-Videos hierher ziehen oder <button type="button" class="dropzone-browse-btn" id="storys-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">MP4, MOV, AVI, MKV, WebM – max. ${maxLabel} pro Video</p>
            </div>
            <input type="file" id="storys-upload-file-input" accept="video/*,.mp4,.mov,.avi,.mkv,.webm" multiple style="display:none"/>
          </div>

          <div class="upload-file-list" id="storys-preview-list"></div>

          <div class="upload-progress-container" id="storys-upload-progress" style="display:none;">
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" id="storys-upload-progress-fill" style="width:0%"></div>
            </div>
            <div class="upload-progress-text" id="storys-upload-progress-text">Wird hochgeladen...</div>
          </div>

          <div class="upload-error-msg" id="storys-upload-error" style="display:none;"></div>

          <div class="drawer-footer storys-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="storys-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="storys-upload-submit-btn" disabled>
              ${mdcBtnIcon(ICON_UPLOAD_16)}
              <span class="mdc-btn__label">Hochladen</span>
            </button>
          </div>
        </div>
      </div>
    `;
}

function slotOptions(slots, selectedSlotId) {
  let html = `<option value="__new__" ${selectedSlotId === '__new__' ? 'selected' : ''}>Neue Story</option>`;
  for (const slot of slots) {
    const label = `Story ${slot.slot_index}${slot.currentVersion ? ` (FS${slot.currentVersion})` : ''}`;
    html += `<option value="${slot.id}" ${selectedSlotId === slot.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }
  return html;
}

function versionOptions(slots, item) {
  const slot = item.slotId !== '__new__' ? slots.find(s => s.id === item.slotId) : null;
  const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
  let html = allVersions.map(v => {
    const exists = slot?.existingVersions?.includes(v);
    const label = exists ? `Feedbackschleife ${v} (hinzufügen)` : `Feedbackschleife ${v}`;
    const selected = !item.isFinal && v === item.versionNumber ? ' selected' : '';
    return `<option value="${v}"${selected}>${label}</option>`;
  }).join('');
  html += `<option value="final"${item.isFinal ? ' selected' : ''}>Finale Version</option>`;
  return html;
}

// Freitext-Varianten-Name (Feedbackschleifen) bzw. Preset-Select 9:16/4:5/1:1 (Finale)
function variantField(item, idx) {
  if (item.isFinal) {
    const options = FINAL_VARIANTS.map(v =>
      `<option value="${v}"${v === item.variantName ? ' selected' : ''}>${v}</option>`
    ).join('');
    return `<select class="form-input storys-final-variant-select" data-idx="${idx}">${options}</select>`;
  }
  return `<input type="text" class="form-input storys-variant-name-input" data-idx="${idx}"
      value="${escapeHtml(item.variantName || '')}"
      placeholder="Varianten-Name (optional)" maxlength="120"/>`;
}

export function storysQueueHtml(queue, slots) {
  return queue.map((item, i) => `
        <div class="upload-file-item storys-queue-item">
          <div class="file-info">
            <span class="file-name">${escapeHtml(item.file.name)}</span>
            <span class="file-size">${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
          <div class="storys-queue-variant">
            ${variantField(item, i)}
          </div>
          <div class="storys-queue-selects">
            <select class="form-input storys-slot-select" data-idx="${i}">${slotOptions(slots, item.slotId)}</select>
            <select class="form-input storys-version-select" data-idx="${i}">${versionOptions(slots, item)}</select>
          </div>
          <button type="button" class="file-remove-btn storys-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
        </div>
      `).join('');
}

function assetHtml(asset) {
  const sizeMB = asset.file_size ? (asset.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
  const currentBadge = asset.is_current && !asset.is_final ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';
  const versionLabel = asset.is_final ? 'Finale' : `FS${asset.version_number}`;
  return `
          <div class="existing-image-item existing-storys-asset-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(asset.file_name || '?')}${asset.variant_name ? ` · ${escapeHtml(asset.variant_name)}` : ''} · ${versionLabel}${currentBadge}</span>
              ${sizeMB ? `<span class="existing-image-size">${sizeMB}</span>` : ''}
            </div>
          </div>
        `;
}

export function storySlotsHtml(slots) {
  return slots.map(slot => {
    const versionLabel = slot.currentVersion ? `FS${slot.currentVersion}` : '—';
    const fileName = slot.currentAsset?.file_name || '—';
    const versionsStr = (slot.existingVersions || []).map(v => `FS${v}`).join(', ');
    return `
        <div class="existing-storys-slot-item">
          <div class="existing-storys-slot-header">
            <span class="existing-storys-slot-title">Story ${slot.slot_index}</span>
            <span class="existing-storys-slot-meta">${escapeHtml(fileName)} · ${versionLabel} ${versionsStr ? `(Feedbackschleifen: ${versionsStr})` : ''}</span>
          </div>
          <div class="existing-storys-slot-actions">
            <button type="button" class="existing-story-slot-delete" data-slot-id="${slot.id}" title="Slot löschen">
              ${icon('trash-alt')}
            </button>
          </div>
        </div>
      ${slot.assets.map(assetHtml).join('')}`;
  }).join('');
}
