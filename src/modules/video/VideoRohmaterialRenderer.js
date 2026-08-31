// VideoRohmaterialRenderer.js
// Rendering der Rohmaterial-Ansicht (Level 3b): pro Kooperation die vom Creator
// abgelegten Dateien, damit der Cutter sie direkt herunterladen kann.
//
// Nur intern erreichbar — Kunden springen in VideoList direkt auf die Video-Tabelle.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { toDownloadDropboxUrl } from '../../core/VideoUploadUtils.js';

const BACK_SVG = `${icon('arrow-left')}`;
const FOLDER_SVG = `${icon('folder-open')}`;
const DOWNLOAD_SVG = `${icon('download')}`;
const TRASH_SVG = `${icon('trash')}`;
const UPLOAD_SVG = `${icon('upload')}`;

const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (!n) return '-';
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export class VideoRohmaterialRenderer {
  static renderRohmaterialView() {
    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              <button id="btn-back-to-kampagne-root" class="mdc-btn mdc-btn--secondary">${BACK_SVG} Zurück</button>
            </div>
          </div>
        </div>
        <div class="rohmaterial-container" id="rohmaterial-groups">
          <div class="loading-placeholder">Lade Rohmaterial...</div>
        </div>
      </div>
    `;
  }

  static updateGroups(groups) {
    const host = document.getElementById('rohmaterial-groups');
    if (!host) return;

    if (!groups || groups.length === 0) {
      host.innerHTML = renderEmptyState({
        icon: 'folder',
        title: 'Keine Kooperationen',
        text: 'Für diese Kampagne gibt es noch keine Kooperationen.'
      });
      return;
    }

    host.innerHTML = groups.map(g => this._renderGroup(g)).join('');
  }

  static _renderGroup(group) {
    const files = group.files || [];
    const title = group.creatorName || group.name || '—';
    const sub = [
      group.creatorName && group.name && group.name !== group.creatorName ? group.name : '',
      files.length === 1 ? '1 Datei' : `${files.length} Dateien`
    ].filter(Boolean).join(' · ');

    const folderBtn = group.folderUrl
      ? `<a href="${esc(group.folderUrl)}" target="_blank" rel="noopener noreferrer" class="mdc-btn mdc-btn--secondary">${FOLDER_SVG} Ordner öffnen</a>`
      : '';

    const body = files.length === 0
      ? `<p class="rohmaterial-empty">Noch kein Rohmaterial hochgeladen.</p>`
      : `
        <div class="rohmaterial-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-name">Datei</th>
                <th>Größe</th>
                <th>Hochgeladen</th>
                <th class="rohmaterial-actions-col"></th>
              </tr>
            </thead>
            <tbody>${files.map(f => this._renderRow(f)).join('')}</tbody>
          </table>
        </div>`;

    return `
      <div class="rohmaterial-group" data-koop-id="${esc(group.id)}">
        <div class="rohmaterial-group-header">
          <div class="rohmaterial-group-title">
            <span class="rohmaterial-group-name">${esc(title)}</span>
            ${sub ? `<span class="rohmaterial-group-sub">${esc(sub)}</span>` : ''}
          </div>
          <div class="rohmaterial-group-actions">
            ${folderBtn}
            <button type="button" class="mdc-btn mdc-btn--secondary rohmaterial-upload-btn" data-koop-id="${esc(group.id)}">
              ${UPLOAD_SVG} Hochladen
            </button>
          </div>
        </div>
        <div class="rohmaterial-progress" data-koop-id="${esc(group.id)}" style="display:none;"></div>
        ${body}
      </div>
    `;
  }

  static _renderRow(file) {
    // dl=1 statt raw=1: der Cutter will die Datei lokal, nicht im Dropbox-Viewer.
    const downloadUrl = toDownloadDropboxUrl(file.file_url) || file.file_url || '';
    const downloadBtn = downloadUrl
      ? `<a href="${esc(downloadUrl)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Herunterladen">${DOWNLOAD_SVG}</a>`
      : '';

    return `
      <tr data-asset-id="${esc(file.id)}">
        <td class="col-name">${esc(file.file_name || '—')}</td>
        <td>${esc(formatSize(file.file_size))}</td>
        <td>${formatDate(file.created_at)}</td>
        <td class="rohmaterial-actions-col">
          <div class="rohmaterial-row-actions">
            ${downloadBtn}
            <button type="button" class="external-link-btn rohmaterial-delete-btn" data-asset-id="${esc(file.id)}" title="Löschen">${TRASH_SVG}</button>
          </div>
        </td>
      </tr>
    `;
  }

  /** Fortschrittszeile waehrend eines Staff-Uploads (pro Kooperation). */
  static setProgress(koopId, text) {
    const el = document.querySelector(`.rohmaterial-progress[data-koop-id="${koopId}"]`);
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = '';
    el.textContent = text;
  }
}

export default VideoRohmaterialRenderer;
