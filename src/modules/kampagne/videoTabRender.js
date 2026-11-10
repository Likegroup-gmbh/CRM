// videoTabRender.js
// HTML des Video-Tabs im VideoUploadDrawer: Tab-Gerüst, Link-/Ordner-Modus, Warteschlange,
// vorhandene Videos. Reine Funktionen.

import {
  MAX_VERSIONS, FINAL_VARIANTS,
  escapeHtml,
  mdcBtnIcon,
  ICON_PLUS_16,
  ICON_CHECK_16,
} from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

/** Gemeinsames Gerüst: eigener Inhalt, Fehlerzeile, Footer, Liste der vorhandenen Videos. */
export function videoTabShell(activeTab, innerHtml, { submitIcon, submitLabel }) {
  return `
    <div id="upload-tab-video" style="${activeTab !== 'video' ? 'display:none' : ''}">
      <div class="video-upload-drawer-content">
        ${innerHtml}

        <div class="upload-error-msg" id="video-upload-error" style="display:none;"></div>

        <div class="drawer-footer video-upload-drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" id="video-upload-cancel-btn">Abbrechen</button>
          <button type="button" class="mdc-btn mdc-btn--create" id="video-upload-submit-btn" disabled>
            ${mdcBtnIcon(submitIcon)}
            <span class="mdc-btn__label">${submitLabel}</span>
          </button>
        </div>

        <div class="existing-images-section" id="existing-videos-section">
          <div class="existing-images-header">
            <span class="existing-images-title">Vorhandene Videos</span>
            <span class="existing-images-count" id="existing-videos-count"></span>
          </div>
          <div class="existing-images-list" id="existing-videos-list">
            <div class="existing-images-loading">Lade...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Link-Modus ─────────────────────────────────────────────

function linkModeNav(isFolder) {
  return `
    <div class="drawer-tab-nav link-share-mode" role="tablist">
      <button type="button" class="drawer-tab-btn ${isFolder ? '' : 'active'}" data-link-mode="video" role="tab" aria-selected="${isFolder ? 'false' : 'true'}">Video-Link</button>
      <button type="button" class="drawer-tab-btn ${isFolder ? 'active' : ''}" data-link-mode="folder" role="tab" aria-selected="${isFolder ? 'true' : 'false'}">Ordner teilen</button>
    </div>
  `;
}

function folderFields(folderUrl) {
  return `
    <div class="link-folder-section">
      <label class="custom-upload-label" for="video-folder-url-input">OneDrive- / SharePoint-Ordner</label>
      <input type="url" id="video-folder-url-input" class="form-input"
        value="${escapeHtml(folderUrl || '')}"
        placeholder="https://….sharepoint.com/…" />
      <p class="dropzone-hint">Der Kunde öffnet den Ordner und schaut die Videos dort.</p>
    </div>
  `;
}

function videoLinkFields() {
  return `
    <div class="link-add-section">
      <button type="button" class="mdc-btn upload-drawer-btn--secondary" id="video-link-add-btn">
        ${mdcBtnIcon(ICON_PLUS_16)}
        <span class="mdc-btn__label">Link hinzufügen</span>
      </button>
    </div>
    <div class="upload-file-list" id="video-upload-queue"></div>
  `;
}

export function renderLinkTab(activeTab, { linkMode, folderUrl }) {
  const isFolder = linkMode === 'folder';
  return videoTabShell(activeTab, `
    ${linkModeNav(isFolder)}
    ${isFolder ? folderFields(folderUrl) : videoLinkFields()}
  `, { submitIcon: ICON_CHECK_16, submitLabel: 'Speichern' });
}

// ─── Warteschlange ──────────────────────────────────────────

function versionOptions(item, existingVersions) {
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

// Freitext-Varianten-Name (Feedbackschleifen) bzw. Preset-Select 9:16/4:5/1:1 (Finale)
function variantField(item, idx) {
  if (item.isFinal) {
    const options = FINAL_VARIANTS.map(v =>
      `<option value="${v}"${v === item.variantName ? ' selected' : ''}>${v}</option>`
    ).join('');
    return `<select class="form-input video-final-variant-select" data-idx="${idx}">${options}</select>`;
  }
  return `<input type="text" class="form-input video-variant-name-input" data-idx="${idx}"
    value="${escapeHtml(item.variantName)}"
    placeholder="Varianten-Name (z.B. Voice-Over Berlin)" maxlength="120"/>`;
}

/** Eine Zeile der Warteschlange: Link-Eingabe (externe Links) oder Datei. */
export function queueItemHtml(item, idx, { existingVersions, external }) {
  const source = external
    ? `<div class="video-queue-variant flex-1">
        <input type="url" class="form-input video-link-url-input" data-idx="${idx}"
          value="${escapeHtml(item.url || '')}"
          placeholder="https://drive.google.com/..." />
      </div>`
    : `<div class="file-info">
        <span class="file-name">${escapeHtml(item.file.name)}</span>
        <span class="file-size">${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
      </div>`;
  return `
    <div class="upload-file-item video-queue-item">
      ${source}
      <div class="video-queue-variant">
        ${variantField(item, idx)}
      </div>
      <div class="video-queue-selects">
        <select class="form-input video-version-select" data-idx="${idx}">${versionOptions(item, existingVersions)}</select>
      </div>
      <button type="button" class="file-remove-btn video-file-remove" data-idx="${idx}" title="Entfernen">&times;</button>
    </div>
  `;
}

// ─── Vorhandene Videos ──────────────────────────────────────

function groupHeader(title, count) {
  return `
    <div class="existing-storys-slot-item">
      <div class="existing-storys-slot-header">
        <span class="existing-storys-slot-title">${title}</span>
        <span class="existing-storys-slot-meta">${count} Datei${count !== 1 ? 'en' : ''}</span>
      </div>
    </div>`;
}

function existingItem(asset, { fallbackName, suffix, replace }) {
  const name = asset.variant_name || asset.file_path?.split('/').pop() || fallbackName;
  const date = asset.created_at ? new Date(asset.created_at).toLocaleDateString('de-DE') : '';
  const replaceBtn = replace
    ? `<button type="button" class="existing-video-replace" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path || '')}" data-version="${asset.version_number}" data-variant="${escapeHtml(asset.variant_name || '')}" title="Ersetzen">${icon('arrow-path')}</button>`
    : '';
  return `
    <div class="existing-image-item existing-storys-asset-item">
      <div class="existing-image-info">
        <span class="existing-image-name">${escapeHtml(name)}${date ? ` · ${date}` : ''} · ${suffix}</span>
      </div>
      <div class="existing-asset-actions">
        ${replaceBtn}
        <button type="button" class="existing-image-delete existing-video-delete" data-id="${asset.id}" title="Löschen">${icon('trash-alt')}</button>
      </div>
    </div>`;
}

/** Vorhandene Dateien je Feedbackschleife, danach die Finale Version. */
export function existingVideosHtml(assets) {
  if (!assets?.length) return '<div class="existing-images-empty">Keine Videos vorhanden</div>';

  const grouped = {};
  for (const asset of assets.filter(a => !a.is_final)) {
    const v = asset.version_number || 1;
    if (!grouped[v]) grouped[v] = [];
    grouped[v].push(asset);
  }
  const rounds = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;
  const currentBadge = ' <span class="version-badge version-badge--current">aktuell</span>';

  let html = '';
  for (const round of rounds) {
    html += groupHeader(`Feedbackschleife ${round}${round === maxRound ? currentBadge : ''}`, grouped[round].length);
    for (const asset of grouped[round]) {
      html += existingItem(asset, {
        fallbackName: '?',
        suffix: `FS${asset.version_number}${asset.is_current ? currentBadge : ''}`,
        replace: true,
      });
    }
  }

  const finalAssets = assets.filter(a => a.is_final);
  if (finalAssets.length > 0) {
    html += groupHeader('Finale Version', finalAssets.length);
    for (const asset of finalAssets) {
      html += existingItem(asset, { fallbackName: 'Final', suffix: 'Finale', replace: false });
    }
  }
  return html;
}
