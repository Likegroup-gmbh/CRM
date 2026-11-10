// bilderTabRender.js
// HTML des Stills-Tabs im VideoUploadDrawer: Upload- bzw. Link-Pane, Warteschlange
// und die Liste vorhandener Stills (gruppiert nach Video).

import {
  escapeHtml, MAX_VERSIONS, mdcBtnIcon, ICON_PLUS_16, ICON_CHECK_16, ICON_UPLOAD_16,
} from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

function existingSection() {
  return `
          <div class="existing-images-section" id="existing-images-section">
            <div class="existing-images-header">
              <span class="existing-images-title">Vorhandene Stills</span>
              <span class="existing-images-count" id="existing-images-count"></span>
            </div>
            <div class="existing-images-list" id="existing-images-list">
              <div class="existing-images-loading">Lade...</div>
            </div>
          </div>`;
}

function footer(submitIcon, submitLabel) {
  return `
          <div class="drawer-footer bilder-upload-drawer-footer">
            <button type="button" class="mdc-btn mdc-btn--cancel" id="bilder-upload-cancel-btn">Abbrechen</button>
            <button type="button" class="mdc-btn mdc-btn--create" id="bilder-upload-submit-btn" disabled>
              ${mdcBtnIcon(submitIcon)}
              <span class="mdc-btn__label">${submitLabel}</span>
            </button>
          </div>`;
}

export function bilderUploadPane(activeTab) {
  return `
      <div id="upload-tab-bilder" style="${activeTab !== 'bilder' ? 'display:none' : ''}">
        <div class="bilder-upload-drawer-content">
          <div class="upload-dropzone" id="bilder-upload-dropzone">
            <div class="dropzone-content">
              ${icon('photo')}
              <p class="dropzone-text">Stills hierher ziehen oder <button type="button" class="dropzone-browse-btn" id="bilder-browse-btn">Dateien auswählen</button></p>
              <p class="dropzone-hint">Alle Bildformate – max. 50 MB pro Bild</p>
            </div>
            <input type="file" id="bilder-upload-file-input" accept="image/*" multiple style="display:none"/>
          </div>

          <div class="upload-file-list" id="bilder-preview-list"></div>

          <div class="upload-progress-container" id="bilder-upload-progress" style="display:none;">
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" id="bilder-upload-progress-fill" style="width:0%"></div>
            </div>
            <div class="upload-progress-text" id="bilder-upload-progress-text">Wird hochgeladen...</div>
          </div>

          <div class="upload-error-msg" id="bilder-upload-error" style="display:none;"></div>
${footer(ICON_UPLOAD_16, 'Hochladen')}
${existingSection()}
        </div>
      </div>
    `;
}

export function bilderLinkPane(activeTab) {
  return `
      <div id="upload-tab-bilder" style="${activeTab !== 'bilder' ? 'display:none' : ''}">
        <div class="bilder-upload-drawer-content">
          <div class="link-add-section">
            <button type="button" class="mdc-btn upload-drawer-btn--secondary" id="bilder-link-add-btn">
              ${mdcBtnIcon(ICON_PLUS_16)}
              <span class="mdc-btn__label">Still-Link hinzufügen</span>
            </button>
          </div>

          <div class="upload-file-list" id="bilder-preview-list"></div>

          <div class="upload-error-msg" id="bilder-upload-error" style="display:none;"></div>
${footer(ICON_CHECK_16, 'Speichern')}
${existingSection()}
        </div>
      </div>
    `;
}

function versionOptionsHtml(item, existingVersions) {
  const allVersions = Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1);
  let html = allVersions.map(v => {
    const exists = existingVersions.includes(v);
    const label = exists ? `Feedbackschleife ${v} (hinzufügen)` : `Feedbackschleife ${v}`;
    const selected = !item.isFinal && v === item.versionNumber ? ' selected' : '';
    return `<option value="${v}"${selected}>${label}</option>`;
  }).join('');
  html += `<option value="final"${item.isFinal ? ' selected' : ''}>Finale Version</option>`;
  return html;
}

export function linkQueueHtml(queue, existingVersions) {
  return queue.map((item, i) => `
        <div class="upload-file-item video-queue-item">
          <div class="video-queue-variant flex-1">
            <input type="url" class="form-input bilder-link-url-input" data-idx="${i}"
              value="${escapeHtml(item.url || '')}" placeholder="https://..." />
          </div>
          <div class="video-queue-variant">
            <input type="text" class="form-input bilder-variant-name-input" data-idx="${i}"
              value="${escapeHtml(item.variantName || '')}" placeholder="Varianten-Name" maxlength="120"/>
          </div>
          <div class="video-queue-selects">
            <select class="form-input bilder-version-select" data-idx="${i}">${versionOptionsHtml(item, existingVersions)}</select>
          </div>
          <button type="button" class="file-remove-btn bilder-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
        </div>
      `).join('');
}

export function fileQueueHtml(queue, existingVersions) {
  return queue.map((item, i) => `
      <div class="upload-file-item video-queue-item">
        <div class="file-info">
          <span class="file-name">${escapeHtml(item.file.name)}</span>
          <span class="file-size">${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <div class="video-queue-variant">
          <input type="text" class="form-input bilder-variant-name-input" data-idx="${i}"
            value="${escapeHtml(item.variantName || '')}" placeholder="Varianten-Name" maxlength="120"/>
        </div>
        <div class="video-queue-selects">
          <select class="form-input bilder-version-select" data-idx="${i}">${versionOptionsHtml(item, existingVersions)}</select>
        </div>
        <button type="button" class="file-remove-btn bilder-file-remove" data-idx="${i}" title="Entfernen">&times;</button>
      </div>
    `).join('');
}

const videoLabel = v => `Video ${v.position || 1}${v.thema ? ` – ${v.thema}` : ''}`;

function existingImageHtml(img, videos, trashIcon) {
  const sizeMB = img.file_size ? (img.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
  const name = img.file_name || img.file_path?.split('/').pop() || '?';
  const versionLabel = img.is_final ? 'Finale' : `FS${img.version_number || 1}`;
  const currentBadge = img.is_current && !img.is_final ? ' <span class="version-badge version-badge--current">aktuell</span>' : '';
  const videoSelect = videos.length > 0 ? `
              <select class="existing-image-video-select" data-id="${img.id}" title="Video zuordnen">
                <option value="">Nicht zugeordnet</option>
                ${videos.map(v => `<option value="${v.id}" ${img.video_id === v.id ? 'selected' : ''}>${escapeHtml(videoLabel(v))}</option>`).join('')}
              </select>` : '';
  return `
          <div class="existing-image-item existing-storys-asset-item">
            <div class="existing-image-info">
              <span class="existing-image-name">${escapeHtml(name)}${img.variant_name ? ` · ${escapeHtml(img.variant_name)}` : ''} · ${versionLabel}${currentBadge}${sizeMB ? ` · ${sizeMB}` : ''}</span>
            </div>
            <div class="existing-asset-actions">
              ${videoSelect}
              <button type="button" class="existing-image-delete" data-id="${img.id}" data-path="${escapeHtml(img.file_path || '')}" title="Löschen">${trashIcon}</button>
            </div>
          </div>`;
}

/** Vorhandene Stills; mit Videos gruppiert, Unzugeordnete zuletzt. */
export function existingImagesHtml(images, videos) {
  const trashIcon = icon('trash-alt');
  const item = (img) => existingImageHtml(img, videos, trashIcon);
  if (videos.length === 0) return images.map(item).join('');

  const groups = [];
  for (const v of videos) {
    const imgs = images.filter(i => i.video_id === v.id);
    if (imgs.length) groups.push({ label: videoLabel(v), imgs });
  }
  const unassigned = images.filter(i => !i.video_id || !videos.some(v => v.id === i.video_id));
  if (unassigned.length) groups.push({ label: 'Nicht zugeordnet', imgs: unassigned });

  return groups.map(g => `
          <div class="existing-images-group">
            <div class="existing-images-group-title">${escapeHtml(g.label)}</div>
            ${g.imgs.map(item).join('')}
          </div>`).join('');
}
