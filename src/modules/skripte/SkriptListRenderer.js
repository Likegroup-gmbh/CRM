// SkriptListRenderer.js
// Grid/Table-Rendering für die 4 Skripte-Ebenen.

import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyState, renderEmptyStateRow, resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { STATUS_LABELS, STATUS_TAG_VARIANT, OHNE_MARKE_LABEL, OHNE_KAMPAGNE_LABEL } from './SkripteUtils.js';

export function createButtonHtml() {
  if (window.isKunde?.()) return '';
  return '<button id="btn-skript-new" class="mdc-btn">Neues Skript erstellen</button>'
    + ' <a href="/skripte/dna" class="mdc-btn mdc-btn--secondary">DNA verwalten</a>';
}

function emptyCreateText() {
  return window.isKunde?.()
    ? 'Hier erscheinen Skripte, sobald welche für Sie angelegt wurden.'
    : 'Erstellen Sie ein Skript, um es hier zu verwalten.';
}

function viewToggleHtml(listViewMode) {
  return ViewModeToggle.render([
    { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: listViewMode === 'list' },
    { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: listViewMode === 'grid' }
  ]);
}

function backButtonHtml(id) {
  return `
    <button id="${id}" class="mdc-btn mdc-btn--secondary">
      ${icon('arrow-left')}
      Zurück
    </button>
  `;
}

function folderToolbar({ backId, listViewMode, extraLeft = '' }) {
  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${backId ? backButtonHtml(backId) : ''}
          ${viewToggleHtml(listViewMode)}
          ${extraLeft}
        </div>
      </div>
      <div class="table-actions">${createButtonHtml()}</div>
    </div>
  `;
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'Skript' : 'Skripte'}`;
}

function folderIconHtml(list, folder, name) {
  return folder.logo_url
    ? `<img src="${list.sanitize(folder.logo_url)}" alt="${list.sanitize(name)}" class="folder-logo">`
    : `${icon('folder-open')}`;
}

function emptyFoldersHtml({ title, text }) {
  return `<div class="grid-span-all">${renderEmptyState({
    icon: 'skripte',
    title,
    text,
    actionsHtml: createButtonHtml()
  })}</div>`;
}

function renderStatus(status) {
  const label = STATUS_LABELS[status] || status || '–';
  const variant = STATUS_TAG_VARIANT[status] || 'tag--type';
  return `<span class="tag tag--status ${variant}">${window.validatorSystem?.sanitizeHtml(label) || label}</span>`;
}

export function renderItemsRows(list, items) {
  return items.map((s) => {
    const titel = (s.titel || s.hook || 'Ohne Titel').toString().slice(0, 80);
    const datum = s.created_at ? new Date(s.created_at).toLocaleDateString('de-DE') : '-';
    return `
      <tr class="table-row-clickable" data-id="${s.id}">
        <td class="col-name">
          <a href="#" class="table-link" data-table="skripte" data-id="${s.id}">
            ${list.sanitize(titel)}
          </a>
        </td>
        <td>${renderStatus(s.status)}</td>
        <td>${datum}</td>
        <td class="col-actions">${actionBuilder.create('skripte', s.id)}</td>
      </tr>
    `;
  }).join('');
}

function itemsEmptyRow(list, title, colspan = 4) {
  const html = resolveEmptyState({
    hasActiveFilters: list.hasActiveFilters(),
    states: {
      default: {
        icon: 'skripte',
        title,
        text: emptyCreateText(),
        actionsHtml: createButtonHtml()
      }
    }
  }, 'default');
  return `<tr><td colspan="${colspan}" class="empty-state-cell">${html}</td></tr>`;
}

function folderCard(list, folder, { idValue, name, extraAttrs = '' }) {
  return `
    <div class="folder-card" data-folder-id="${idValue ?? ''}" data-folder-name="${list.sanitize(name)}" ${extraAttrs}>
      <div class="folder-icon">${folderIconHtml(list, folder, name)}</div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(name)}</span>
        <span class="folder-count">${countLabel(folder.count)}</span>
      </div>
    </div>
  `;
}

function folderTableRow(list, folder, { rowClass, idValue, name, extraAttrs = '', linkClass }) {
  return `
    <tr class="table-row-clickable ${rowClass}" data-folder-id="${idValue ?? ''}" data-folder-name="${list.sanitize(name)}" ${extraAttrs}>
      <td>
        ${folder.logo_url ? `<img src="${list.sanitize(folder.logo_url)}" class="table-logo" width="24" height="24" alt="" />` : ''}
        <a href="#" class="table-link ${linkClass}" data-folder-id="${idValue ?? ''}" data-folder-name="${list.sanitize(name)}" ${extraAttrs}>
          ${list.sanitize(name)}
        </a>
      </td>
      <td>${folder.count}</td>
    </tr>
  `;
}

function folderTableSkeleton(headers, tbodyId) {
  return `
    <table class="data-table">
      <thead>
        <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody id="${tbodyId}"></tbody>
    </table>
  `;
}

// ------------------------------------------------------------------
// Companies
// ------------------------------------------------------------------

export function renderCompaniesView(list) {
  return `
    <div class="list-container">
      ${folderToolbar({ listViewMode: list.listViewMode })}
      <div class="table-container">
        ${list.listViewMode === 'grid'
          ? `<div class="folders-grid" id="companies-grid"></div>`
          : folderTableSkeleton(['Unternehmen', 'Skripte'], 'companies-table-body')}
      </div>
    </div>
  `;
}

export function updateCompaniesGrid(list) {
  const grid = document.getElementById('companies-grid');
  if (!grid) return;

  if (!list.companyFolders.length) {
    grid.innerHTML = emptyFoldersHtml({
      title: 'Keine Skripte vorhanden',
      text: emptyCreateText()
    });
    return;
  }

  grid.innerHTML = list.companyFolders.map((folder) => `
    <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${list.sanitize(folder.firmenname)}">
      <div class="folder-icon">${folderIconHtml(list, folder, folder.firmenname)}</div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(folder.firmenname)}</span>
        <span class="folder-count">${countLabel(folder.count)}</span>
      </div>
    </div>
  `).join('');
  fillFoldersGrid(grid);
}

export function updateCompaniesTable(list) {
  const tbody = document.getElementById('companies-table-body');
  if (!tbody) return;

  if (!list.companyFolders.length) {
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'skripte',
      title: 'Keine Skripte vorhanden',
      text: emptyCreateText(),
      actionsHtml: createButtonHtml()
    }, 2);
    return;
  }

  tbody.innerHTML = list.companyFolders.map((folder) => `
    <tr class="table-row-clickable company-row" data-unternehmen-id="${folder.id}" data-unternehmen-name="${list.sanitize(folder.firmenname)}">
      <td>
        ${folder.logo_url ? `<img src="${list.sanitize(folder.logo_url)}" class="table-logo" width="24" height="24" alt="" />` : ''}
        <a href="#" class="table-link company-link" data-unternehmen-id="${folder.id}" data-unternehmen-name="${list.sanitize(folder.firmenname)}">
          ${list.sanitize(folder.firmenname)}
        </a>
      </td>
      <td>${folder.count}</td>
    </tr>
  `).join('');
}

// ------------------------------------------------------------------
// Brands
// ------------------------------------------------------------------

export function renderBrandsView(list) {
  return `
    <div class="list-container">
      ${folderToolbar({ backId: 'btn-back-to-companies', listViewMode: list.listViewMode })}
      <div class="table-container">
        ${list.listViewMode === 'grid'
          ? `<div class="folders-grid" id="brands-grid"></div>`
          : folderTableSkeleton(['Marke', 'Skripte'], 'brands-table-body')}
      </div>
    </div>
  `;
}

export function updateBrandsGrid(list) {
  const grid = document.getElementById('brands-grid');
  if (!grid) return;

  if (!list.brandFolders.length) {
    grid.innerHTML = emptyFoldersHtml({
      title: 'Keine Marken mit Skripten',
      text: 'Für dieses Unternehmen gibt es noch keine Skripte.'
    });
    return;
  }

  grid.innerHTML = list.brandFolders.map((folder) => {
    const attrs = folder.virtual
      ? `data-ohne-marke="1" data-marke-name="${list.sanitize(OHNE_MARKE_LABEL)}"`
      : `data-marke-id="${folder.id}" data-marke-name="${list.sanitize(folder.markenname)}"`;
    return folderCard(list, folder, {
      idValue: folder.id,
      name: folder.markenname,
      extraAttrs: attrs
    });
  }).join('');
  fillFoldersGrid(grid);
}

export function updateBrandsTable(list) {
  const tbody = document.getElementById('brands-table-body');
  if (!tbody) return;

  if (!list.brandFolders.length) {
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'tag',
      title: 'Keine Marken mit Skripten',
      text: 'Für dieses Unternehmen gibt es noch keine Skripte.',
      actionsHtml: createButtonHtml()
    }, 2);
    return;
  }

  tbody.innerHTML = list.brandFolders.map((folder) => {
    const attrs = folder.virtual
      ? `data-ohne-marke="1" data-marke-name="${list.sanitize(OHNE_MARKE_LABEL)}"`
      : `data-marke-id="${folder.id}" data-marke-name="${list.sanitize(folder.markenname)}"`;
    return folderTableRow(list, folder, {
      rowClass: 'brand-row',
      idValue: folder.id,
      name: folder.markenname,
      extraAttrs: attrs,
      linkClass: 'brand-link'
    });
  }).join('');
}

// ------------------------------------------------------------------
// Campaigns
// ------------------------------------------------------------------

export function renderCampaignsView(list) {
  const hasFolders = list.campaignFolders.length > 0;
  const hasLoose = list.campaignlessItems.length > 0;
  const showFolders = hasFolders || !hasLoose;
  const showCampaignless = hasLoose;

  return `
    <div class="list-container">
      ${folderToolbar({ backId: 'btn-back-to-brands', listViewMode: list.listViewMode })}
      ${showFolders ? `
        <div class="table-container">
          ${list.listViewMode === 'grid'
            ? `<div class="folders-grid" id="campaigns-grid"></div>`
            : folderTableSkeleton(['Kampagne', 'Skripte'], 'campaigns-table-body')}
        </div>
      ` : ''}
      ${showCampaignless ? `
        <div class="table-container table-container--spaced">
          <h3 class="table-section-title">${OHNE_KAMPAGNE_LABEL}</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-name">Titel</th>
                <th>Status</th>
                <th>Datum</th>
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="campaignless-table-body"></tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;
}

export function updateCampaignsGrid(list) {
  const grid = document.getElementById('campaigns-grid');
  if (!grid) return;

  if (!list.campaignFolders.length) {
    if (list.campaignlessItems.length) {
      grid.closest('.table-container')?.remove();
      return;
    }
    grid.innerHTML = emptyFoldersHtml({
      title: 'Keine Kampagnen mit Skripten',
      text: 'Für diesen Pfad gibt es noch keine Skripte.'
    });
    return;
  }

  grid.innerHTML = list.campaignFolders.map((folder) => `
    <div class="folder-card" data-kampagne-id="${folder.id}" data-kampagne-name="${list.sanitize(folder.name)}">
      <div class="folder-icon">${icon('folder-open')}</div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(folder.name)}</span>
        <span class="folder-count">${countLabel(folder.count)}</span>
      </div>
    </div>
  `).join('');
  fillFoldersGrid(grid);
}

export function updateCampaignsTable(list) {
  const tbody = document.getElementById('campaigns-table-body');
  if (!tbody) return;

  if (!list.campaignFolders.length) {
    if (list.campaignlessItems.length) {
      tbody.closest('.table-container')?.remove();
      return;
    }
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'skripte',
      title: 'Keine Kampagnen mit Skripten',
      text: 'Für diesen Pfad gibt es noch keine Skripte.',
      actionsHtml: createButtonHtml()
    }, 2);
    return;
  }

  tbody.innerHTML = list.campaignFolders.map((folder) => `
    <tr class="table-row-clickable campaign-row" data-kampagne-id="${folder.id}" data-kampagne-name="${list.sanitize(folder.name)}">
      <td>
        <a href="#" class="table-link campaign-link" data-kampagne-id="${folder.id}" data-kampagne-name="${list.sanitize(folder.name)}">
          ${list.sanitize(folder.name)}
        </a>
      </td>
      <td>${folder.count}</td>
    </tr>
  `).join('');
}

export function updateCampaignlessTable(list) {
  const tbody = document.getElementById('campaignless-table-body');
  if (!tbody) return;

  if (!list.campaignlessItems.length) {
    if (list.campaignFolders.length) {
      tbody.closest('.table-container')?.remove();
      return;
    }
    tbody.innerHTML = itemsEmptyRow(list, 'Keine Skripte ohne Kampagne');
    return;
  }

  tbody.innerHTML = renderItemsRows(list, list.campaignlessItems);
}

// ------------------------------------------------------------------
// Items
// ------------------------------------------------------------------

export function renderItemsView(list) {
  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${backButtonHtml('btn-back-to-campaigns')}
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">${createButtonHtml()}</div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">Titel</th>
              <th>Status</th>
              <th>Datum</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="skripte-table-body">
            <tr><td colspan="4" class="loading">Lade Skripte...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="pagination-container-skripte-items"></div>
    </div>
  `;
}

export function updateItemsTable(list) {
  const tbody = document.getElementById('skripte-table-body');
  if (!tbody) return;

  if (!list.currentItems.length) {
    tbody.innerHTML = itemsEmptyRow(list, 'Keine Skripte in dieser Kampagne');
    list.pagination.updateTotal(0);
    list.pagination.render();
    return;
  }

  const { currentPage, itemsPerPage } = list.pagination.getState();
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = list.currentItems.slice(start, start + itemsPerPage);
  tbody.innerHTML = renderItemsRows(list, pageItems);
  list.pagination.updateTotal(list.currentItems.length);
  list.pagination.render();
  window.ActionsDropdown?.init();
}

export async function initializeItemsFilterBar(list) {
  const filterContainer = document.getElementById('filter-dropdown-container');
  if (!filterContainer) return;
  await filterDropdown.init('skripte', filterContainer, {
    onFilterApply: (filters) => list.onFiltersApplied(filters),
    onFilterReset: () => list.onFiltersReset()
  });
}
