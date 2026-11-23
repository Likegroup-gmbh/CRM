// VideoTableRenderer.js
// Rendering der Video-Tabelle (Level 3)

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderVerknuepfungPill } from '../../core/ui/verknuepfungPill.js';
import { ordnerLinkHtml } from '../../core/ablage/ablageOrdnerLink.js';

const BACK_SVG = `${icon('arrow-left')}`;

const FOLDER_LINK_SVG = `${icon('folder-open')}`;

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
            <button id="btn-back-to-kampagnen" class="mdc-btn mdc-btn--secondary">${BACK_SVG} Zurück</button>
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
      tbody.innerHTML = renderEmptyStateRow({
        icon: 'video',
        title: 'Keine Videos vorhanden',
        text: 'Es wurden noch keine Videos erstellt.'
      }, colCount);
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
      themaHtml = `<img src="${esc(strategieItem.screenshot_url)}" alt="Thema" class="video-list-thumbnail" loading="lazy" />`;
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

    const contentLinkHtml = ordnerLinkHtml({
      url: video.folder_url,
      kooperationId: video.kooperation_id,
      inhalt: FOLDER_LINK_SVG,
      klasse: 'external-link-btn',
      titel: 'Ordner öffnen',
    }) || '–';

    const kampagneName = KampagneUtils.getDisplayName(kampagne) || '-';
    const kampagneHtml = kampagne.id
      ? renderVerknuepfungPill({ kind: 'kampagne', labelHtml: esc(kampagneName), attrs: `data-table="kampagne" data-id="${kampagne.id}"` })
      : '-';

    const kooperationTd = isKunde
      ? ''
      : `<td>${kooperation.id ? renderVerknuepfungPill({ kind: 'kooperation', labelHtml: esc(kooperation.name || '—'), attrs: `data-table="kooperation" data-id="${kooperation.id}"` }) : '-'}</td>`;

    const creatorTd = isKunde
      ? `<td>${creatorName}</td>`
      : `<td>${creator.id ? renderVerknuepfungPill({ kind: 'creator', labelHtml: creatorName, attrs: `data-table="creator" data-id="${creator.id}"` }) : '-'}</td>`;

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
