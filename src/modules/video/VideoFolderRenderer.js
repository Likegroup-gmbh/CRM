// VideoFolderRenderer.js
// Rendering fuer Level 1 (Unternehmen) und Level 2 (Kampagnen) - Grid + Tabelle

import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';

const FOLDER_SVG = `${icon('folder-open')}`;

const BACK_SVG = `${icon('arrow-left')}`;

const esc = (t) => window.validatorSystem?.sanitizeHtml(t) || t || '';

function viewToggleHtml(listViewMode) {
  return ViewModeToggle.render([
    { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: listViewMode === 'list' },
    { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: listViewMode === 'grid' }
  ]);
}

export class VideoFolderRenderer {
  // ============================================
  // LEVEL 1 - Unternehmen
  // ============================================

  static renderUnternehmenView(listViewMode) {
    const body = listViewMode === 'grid'
      ? `<div class="folders-grid" id="folders-grid">
          <div class="loading-placeholder">Lade Unternehmens-Ordner...</div>
        </div>`
      : this._renderUnternehmenTableSkeleton();

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              ${viewToggleHtml(listViewMode)}
            </div>
          </div>
        </div>
        <div class="table-container">${body}</div>
      </div>
    `;
  }

  static _renderUnternehmenTableSkeleton() {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Unternehmen</th>
            <th>Videos</th>
          </tr>
        </thead>
        <tbody id="unternehmen-list-table-body">
          <tr><td colspan="2" class="no-data">Lade Unternehmen...</td></tr>
        </tbody>
      </table>
    `;
  }

  static updateUnternehmenGrid(folders) {
    const grid = document.getElementById('folders-grid');
    if (!grid) return;

    if (!folders || folders.length === 0) {
      grid.innerHTML = `<div class="empty-state-grid-cell">${renderEmptyState({
        icon: 'video',
        title: 'Keine Videos vorhanden',
        text: 'Es wurden noch keine Videos mit Unternehmen verknüpft.'
      })}</div>`;
      return;
    }

    grid.innerHTML = folders.map(f => `
      <div class="folder-card" data-unternehmen-id="${f.id}" data-unternehmen-name="${esc(f.firmenname)}">
        <div class="folder-icon">
          ${f.logo_url
            ? `<img src="${esc(f.logo_url)}" alt="${esc(f.firmenname)}" class="folder-logo">`
            : FOLDER_SVG
          }
        </div>
        <div class="folder-info">
          <span class="folder-name">${esc(f.firmenname)}</span>
          <span class="folder-count">${f.count} ${f.count === 1 ? 'Video' : 'Videos'}</span>
        </div>
      </div>
    `).join('');
    fillFoldersGrid(grid);
  }

  static updateUnternehmenTable(folders) {
    const tbody = document.getElementById('unternehmen-list-table-body');
    if (!tbody) return;

    if (!folders || folders.length === 0) {
      tbody.innerHTML = renderEmptyStateRow({
        icon: 'video',
        title: 'Keine Videos vorhanden',
        text: 'Es wurden noch keine Videos mit Unternehmen verknüpft.'
      }, 2);
      return;
    }

    tbody.innerHTML = folders.map(f => `
      <tr class="table-row-clickable unternehmen-row" data-unternehmen-id="${f.id}" data-unternehmen-name="${esc(f.firmenname)}">
        <td>
          <div class="flex-center-sm">
            ${f.logo_url ? `<img src="${esc(f.logo_url)}" alt="${esc(f.firmenname)}" class="table-logo">` : ''}
            <a href="#" class="table-link unternehmen-link" data-unternehmen-id="${f.id}" data-unternehmen-name="${esc(f.firmenname)}">${esc(f.firmenname)}</a>
          </div>
        </td>
        <td>${f.count}</td>
      </tr>
    `).join('');
  }

  // ============================================
  // LEVEL 2 - Kampagnen
  // ============================================

  static renderKampagnenView(listViewMode, isKunde) {
    const backBtnHtml = isKunde
      ? ''
      : `<button id="btn-back-to-unternehmen" class="mdc-btn mdc-btn--secondary">${BACK_SVG} Zurück</button>`;

    const body = listViewMode === 'grid'
      ? `<div class="folders-grid" id="kampagnen-grid">
          <div class="loading-placeholder">Lade Kampagnen...</div>
        </div>`
      : this._renderKampagnenTableSkeleton();

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              ${backBtnHtml}
              ${viewToggleHtml(listViewMode)}
            </div>
          </div>
        </div>
        <div class="table-container">${body}</div>
      </div>
    `;
  }

  static _renderKampagnenTableSkeleton() {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Kampagne</th>
            <th>Videos</th>
          </tr>
        </thead>
        <tbody id="kampagnen-list-table-body">
          <tr><td colspan="2" class="no-data">Lade Kampagnen...</td></tr>
        </tbody>
      </table>
    `;
  }

  static updateKampagnenGrid(folders) {
    const grid = document.getElementById('kampagnen-grid');
    if (!grid) return;

    if (!folders || folders.length === 0) {
      grid.innerHTML = `<div class="empty-state-grid-cell">${renderEmptyState({
        icon: 'folder',
        title: 'Keine Kampagnen',
        text: 'Für dieses Unternehmen gibt es noch keine Videos.'
      })}</div>`;
      return;
    }

    grid.innerHTML = folders.map(f => `
      <div class="folder-card" data-kampagne-id="${f.id}" data-kampagne-name="${esc(f.name)}">
        <div class="folder-icon">${FOLDER_SVG}</div>
        <div class="folder-info">
          <span class="folder-name">${esc(f.name)}</span>
          <span class="folder-count">${f.count} ${f.count === 1 ? 'Video' : 'Videos'}</span>
        </div>
      </div>
    `).join('');
    fillFoldersGrid(grid);
  }

  static updateKampagnenTable(folders) {
    const tbody = document.getElementById('kampagnen-list-table-body');
    if (!tbody) return;

    if (!folders || folders.length === 0) {
      tbody.innerHTML = renderEmptyStateRow({
        icon: 'folder',
        title: 'Keine Kampagnen',
        text: 'Für dieses Unternehmen gibt es noch keine Videos.'
      }, 2);
      return;
    }

    tbody.innerHTML = folders.map(f => `
      <tr class="table-row-clickable kampagne-row" data-kampagne-id="${f.id}" data-kampagne-name="${esc(f.name)}">
        <td>
          <a href="#" class="table-link kampagne-folder-link" data-kampagne-id="${f.id}" data-kampagne-name="${esc(f.name)}">${esc(f.name)}</a>
        </td>
        <td>${f.count}</td>
      </tr>
    `).join('');
  }

  // ============================================
  // LEVEL 2b - Kampagne: Videos | Rohmaterial
  // Nur intern. Kunden springen direkt auf die Video-Tabelle.
  // ============================================

  static renderKampagneRootView() {
    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              <button id="btn-back-to-kampagnen" class="mdc-btn mdc-btn--secondary">${BACK_SVG} Zurück</button>
            </div>
          </div>
        </div>
        <div class="table-container">
          <div class="folders-grid" id="kampagne-root-grid">
            <div class="folder-card" data-root-target="videos">
              <div class="folder-icon">${FOLDER_SVG}</div>
              <div class="folder-info">
                <span class="folder-name">Videos</span>
                <span class="folder-count">Feedbackschleifen &amp; Finale</span>
              </div>
            </div>
            <div class="folder-card" data-root-target="rohmaterial">
              <div class="folder-icon">${FOLDER_SVG}</div>
              <div class="folder-info">
                <span class="folder-name">Rohmaterial</span>
                <span class="folder-count">Abgaben der Creator</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /** Wie bei den anderen Ordner-Grids: Restplaetze der letzten Reihe auffuellen. */
  static fillKampagneRootGrid() {
    fillFoldersGrid(document.getElementById('kampagne-root-grid'));
  }

}

export default VideoFolderRenderer;
