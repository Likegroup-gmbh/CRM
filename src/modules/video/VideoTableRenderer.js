// VideoTableRenderer.js
// Rendering der Video-Tabelle (Level 3)

import { KampagneUtils } from '../kampagne/KampagneUtils.js';

const BACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
</svg>`;

const FOLDER_LINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
</svg>`;

const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

export class VideoTableRenderer {
  static renderVideosView(isKunde) {
    const colCount = isKunde ? 7 : 8;

    return `
      <div class="page-header">
        <div class="page-header-right"></div>
      </div>
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <button id="btn-back-to-kampagnen" class="secondary-btn">${BACK_SVG} Zurück</button>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
      </div>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">Thema</th>
              <th>Content</th>
              ${isKunde ? '' : '<th>Kooperation</th>'}
              <th>Kampagne</th>
              <th>Creator</th>
              <th>Content Art</th>
              <th>Status</th>
              <th class="video-posting-datum-cell">Posting Datum</th>
            </tr>
          </thead>
          <tbody id="videos-table-body">
            <tr><td colspan="${colCount}" class="loading">Lade Videos...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination-container" id="pagination-videos"></div>
    `;
  }

  static updateTable(videos, isKunde) {
    const tbody = document.getElementById('videos-table-body');
    if (!tbody) return;

    const colCount = isKunde ? 7 : 8;

    if (!videos || videos.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="${colCount}" class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3>Keine Videos vorhanden</h3>
          <p>Es wurden noch keine Videos erstellt.</p>
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = videos.map(video => this._renderRow(video, isKunde)).join('');
  }

  static _renderRow(video, isKunde) {
    const kooperation = video.kooperation || {};
    const creator = kooperation.creator || {};
    const kampagne = kooperation.kampagne || {};
    const strategieItem = video.strategie_item || {};

    let themaHtml = '-';
    if (strategieItem.screenshot_url) {
      themaHtml = `<img src="${esc(strategieItem.screenshot_url)}" alt="Thema" class="video-list-thumbnail" />`;
    } else if (video.thema) {
      themaHtml = esc(video.thema);
    } else if (video.titel) {
      themaHtml = esc(video.titel);
    }

    const creatorName = creator.vorname
      ? `${esc(creator.vorname)} ${esc(creator.nachname || '')}`.trim()
      : '-';

    const statusClass = video.status === 'abgeschlossen' ? 'status-abgeschlossen' : 'status-produktion';

    const contentArtHtml = video.content_art
      ? `<div class="tags tags-compact"><span class="tag tag--type">${esc(video.content_art)}</span></div>`
      : '-';

    const folderUrl = video.folder_url || '';
    const contentLinkHtml = folderUrl
      ? `<a href="${esc(folderUrl)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Ordner öffnen">${FOLDER_LINK_SVG}</a>`
      : '–';

    const kampagneName = KampagneUtils.getDisplayName(kampagne) || '-';
    const kampagneHtml = kampagne.id
      ? `<a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">${esc(kampagneName)}</a>`
      : '-';

    const kooperationTd = isKunde
      ? ''
      : `<td>${kooperation.id ? `<a href="#" class="table-link" data-table="kooperation" data-id="${kooperation.id}">${esc(kooperation.name || '—')}</a>` : '-'}</td>`;

    const creatorTd = isKunde
      ? `<td>${creatorName}</td>`
      : `<td>${creator.id ? `<a href="#" class="table-link" data-table="creator" data-id="${creator.id}">${creatorName}</a>` : '-'}</td>`;

    return `
      <tr data-id="${video.id}">
        <td class="col-name video-thema-cell">${themaHtml}</td>
        <td>${contentLinkHtml}</td>
        ${kooperationTd}
        <td>${kampagneHtml}</td>
        ${creatorTd}
        <td>${contentArtHtml}</td>
        <td><span class="status-badge ${statusClass}">${esc(video.status) || 'produktion'}</span></td>
        <td>${formatDate(video.posting_datum)}</td>
      </tr>
    `;
  }
}

export default VideoTableRenderer;
