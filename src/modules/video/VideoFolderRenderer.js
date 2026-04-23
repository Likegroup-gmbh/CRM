// VideoFolderRenderer.js
// Rendering fuer Level 1 (Unternehmen) und Level 2 (Kampagnen) - Grid + Tabelle

import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';

const FOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="folder-svg">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
</svg>`;

const BACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
</svg>`;

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
      grid.innerHTML = this._emptyFolderHtml('🎬', 'Keine Videos vorhanden', 'Es wurden noch keine Videos mit Unternehmen verknüpft.');
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
  }

  static updateUnternehmenTable(folders) {
    const tbody = document.getElementById('unternehmen-list-table-body');
    if (!tbody) return;

    if (!folders || folders.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="2" class="no-data">
          ${this._emptyStateInline('🎬', 'Keine Videos vorhanden', 'Es wurden noch keine Videos mit Unternehmen verknüpft.')}
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = folders.map(f => `
      <tr class="table-row-clickable unternehmen-row" data-unternehmen-id="${f.id}" data-unternehmen-name="${esc(f.firmenname)}">
        <td>
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
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
      : `<button id="btn-back-to-unternehmen" class="secondary-btn">${BACK_SVG} Zurück</button>`;

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
      grid.innerHTML = this._emptyFolderHtml('📂', 'Keine Kampagnen', 'Für dieses Unternehmen gibt es noch keine Videos.');
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
  }

  static updateKampagnenTable(folders) {
    const tbody = document.getElementById('kampagnen-list-table-body');
    if (!tbody) return;

    if (!folders || folders.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="2" class="no-data">
          ${this._emptyStateInline('📂', 'Keine Kampagnen', 'Für dieses Unternehmen gibt es noch keine Videos.')}
        </td></tr>
      `;
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
  // HELPERS
  // ============================================

  static _emptyFolderHtml(icon, title, desc) {
    return `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--space-xxl);">
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${desc}</p>
      </div>
    `;
  }

  static _emptyStateInline(icon, title, desc) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${desc}</p>
      </div>
    `;
  }
}

export default VideoFolderRenderer;
