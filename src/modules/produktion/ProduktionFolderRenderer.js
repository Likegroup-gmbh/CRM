// ProduktionFolderRenderer.js
// Toolbar und Ordner-Ebenen (Grid-Karten oder Listen-Tabelle) für die Produktion-Seite.
// Die Produktionen-Tabelle selbst bleibt in ProduktionList.js.

import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { icon } from '../../core/icons/IconSystem.js';
import { NUR_UNTERNEHMEN_LABEL } from './ProduktionFolders.js';

export const BACK_BUTTON_ID = 'btn-produktion-back';

const EMPTY = {
  icon: 'list',
  title: 'Noch keine Produktion',
  text: 'Produktionen entstehen mit dem Briefing einer Kampagne.'
};

function countLabel(count) {
  return `${count} ${count === 1 ? 'Produktion' : 'Produktionen'}`;
}

export function toggleHtml(listViewMode) {
  return ViewModeToggle.render([
    { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: listViewMode === 'list' },
    { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: listViewMode === 'grid' }
  ]);
}

export function toolbarHtml(list) {
  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          <button type="button" id="${BACK_BUTTON_ID}" class="mdc-btn mdc-btn--secondary" style="display: none;">
            ${icon('arrow-left')}
            Zurück
          </button>
          ${toggleHtml(list.listViewMode)}
          ${SearchInput.render('produktion', {
            placeholder: 'Produktion, Kampagne, Produkt, Briefing…',
            currentValue: list.searchQuery
          })}
        </div>
      </div>
    </div>
  `;
}

function levelConfig(list, level) {
  const s = (value) => list.sanitize(value);

  if (level === 'companies') {
    return {
      header: 'Unternehmen',
      folders: list.companyFolders.map((folder) => ({
        name: folder.firmenname,
        logo_url: folder.logo_url,
        count: folder.count,
        attrs: `data-unternehmen-id="${folder.id}" data-unternehmen-name="${s(folder.firmenname)}"`
      })),
      empty: EMPTY
    };
  }

  if (level === 'brands') {
    return {
      header: 'Marke',
      folders: list.brandFolders.map((folder) => ({
        name: folder.markenname,
        logo_url: folder.logo_url,
        count: folder.count,
        attrs: folder.virtual
          ? `data-ohne-marke="1" data-marke-name="${s(NUR_UNTERNEHMEN_LABEL)}"`
          : `data-marke-id="${folder.id}" data-marke-name="${s(folder.markenname)}"`
      })),
      empty: {
        icon: 'list',
        title: 'Keine Marken mit Produktionen',
        text: 'Für dieses Unternehmen gibt es noch keine Produktionen.'
      }
    };
  }

  return {
    header: 'Kampagne',
    folders: list.campaignFolders.map((folder) => ({
      name: folder.name,
      logo_url: null,
      count: folder.count,
      attrs: `data-kampagne-id="${folder.id}" data-kampagne-name="${s(folder.name)}"`
    })),
    empty: {
      icon: 'list',
      title: 'Keine Kampagnen mit Produktionen',
      text: 'Für diesen Pfad gibt es noch keine Produktionen.'
    }
  };
}

function logoHtml(list, folder, { grid }) {
  if (!folder.logo_url) return grid ? icon('folder-open') : '';
  return grid
    ? `<img src="${list.sanitize(folder.logo_url)}" alt="${list.sanitize(folder.name)}" class="folder-logo">`
    : `<img src="${list.sanitize(folder.logo_url)}" class="table-logo" width="24" height="24" alt="" />`;
}

function gridHtml(list, level, config) {
  const cards = config.folders.map((folder) => `
    <div class="folder-card" data-folder-level="${level}" data-folder-name="${list.sanitize(folder.name)}" ${folder.attrs}>
      <div class="folder-icon">${logoHtml(list, folder, { grid: true })}</div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(folder.name)}</span>
        <span class="folder-count">${countLabel(folder.count)}</span>
      </div>
    </div>
  `).join('');
  const body = cards || `<div class="grid-span-all">${renderEmptyState(config.empty)}</div>`;
  return `
    <div class="table-container">
      <div class="folders-grid">${body}</div>
    </div>
  `;
}

function tableHtml(list, level, config) {
  const rows = config.folders.map((folder) => `
    <tr class="table-row-clickable" data-folder-level="${level}" data-folder-name="${list.sanitize(folder.name)}" ${folder.attrs}>
      <td>
        ${logoHtml(list, folder, { grid: false })}
        <a href="#" class="table-link">${list.sanitize(folder.name)}</a>
      </td>
      <td>${folder.count}</td>
    </tr>
  `).join('');
  const body = rows || renderEmptyStateRow(config.empty, 2);
  return `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr><th>${config.header}</th><th>Produktionen</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

// level: 'companies' | 'brands' | 'campaigns'
export function renderFolderLevel(list, level) {
  const config = levelConfig(list, level);
  return list.listViewMode === 'grid'
    ? gridHtml(list, level, config)
    : tableHtml(list, level, config);
}

export function fillFolderGrids(root) {
  root?.querySelectorAll('.folders-grid').forEach((grid) => fillFoldersGrid(grid));
}
