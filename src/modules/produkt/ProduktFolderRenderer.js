// ProduktFolderRenderer.js
// Grid-Rendering für Produkte: Unternehmen → Marken → Items.

import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyState, resolveEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { NUR_UNTERNEHMEN_LABEL } from './ProduktFolders.js';

function canCreateProdukt() {
  return !window.isKunde?.() && (window.isAdmin?.() || window.currentUser?.permissions?.produkt?.can_edit);
}

export function produktCreateButtonHtml() {
  return canCreateProdukt()
    ? '<button id="btn-produkt-new" class="mdc-btn">Produkt anlegen</button>'
    : '';
}

function emptyCreateText() {
  return canCreateProdukt()
    ? 'Legen Sie Ihr erstes Produkt an, um loszulegen.'
    : 'Es sind noch keine Produkte für Sie freigegeben.';
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

function folderToolbar({ backId, listViewMode }) {
  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${backId ? backButtonHtml(backId) : ''}
          ${viewToggleHtml(listViewMode)}
        </div>
      </div>
      <div class="table-actions">${produktCreateButtonHtml()}</div>
    </div>
  `;
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'Produkt' : 'Produkte'}`;
}

function folderIconHtml(list, folder, name) {
  return folder.logo_url
    ? `<img src="${list.sanitize(folder.logo_url)}" alt="${list.sanitize(name)}" class="folder-logo">`
    : `${icon('folder-open')}`;
}

function emptyFoldersHtml({ title, text }) {
  return `<div class="grid-span-all">${renderEmptyState({
    icon: 'cube',
    title,
    text,
    actionsHtml: produktCreateButtonHtml()
  })}</div>`;
}

function folderCard(list, folder, { name, extraAttrs = '' }) {
  return `
    <div class="folder-card" data-folder-name="${list.sanitize(name)}" ${extraAttrs}>
      <div class="folder-icon">${folderIconHtml(list, folder, name)}</div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(name)}</span>
        <span class="folder-count">${countLabel(folder.count)}</span>
      </div>
    </div>
  `;
}

export function renderCompaniesView(list) {
  return `
    <div class="list-container">
      ${folderToolbar({ listViewMode: list.listViewMode })}
      <div class="table-container">
        <div class="folders-grid" id="companies-grid"></div>
      </div>
    </div>
  `;
}

export function updateCompaniesGrid(list) {
  const grid = document.getElementById('companies-grid');
  if (!grid) return;

  if (!list.companyFolders.length) {
    grid.innerHTML = emptyFoldersHtml({
      title: 'Keine Produkte vorhanden',
      text: emptyCreateText()
    });
    return;
  }

  grid.innerHTML = list.companyFolders.map((folder) => folderCard(list, folder, {
    name: folder.firmenname,
    extraAttrs: `data-unternehmen-id="${folder.id}" data-unternehmen-name="${list.sanitize(folder.firmenname)}"`
  })).join('');
  fillFoldersGrid(grid);
}

export function renderBrandsView(list) {
  return `
    <div class="list-container">
      ${folderToolbar({ backId: 'btn-back-to-companies', listViewMode: list.listViewMode })}
      <div class="table-container">
        <div class="folders-grid" id="brands-grid"></div>
      </div>
    </div>
  `;
}

export function updateBrandsGrid(list) {
  const grid = document.getElementById('brands-grid');
  if (!grid) return;

  if (!list.brandFolders.length) {
    grid.innerHTML = emptyFoldersHtml({
      title: 'Keine Marken mit Produkten',
      text: 'Für dieses Unternehmen gibt es noch keine Produkte.'
    });
    return;
  }

  grid.innerHTML = list.brandFolders.map((folder) => {
    const attrs = folder.virtual
      ? `data-ohne-marke="1" data-marke-name="${list.sanitize(NUR_UNTERNEHMEN_LABEL)}"`
      : `data-marke-id="${folder.id}" data-marke-name="${list.sanitize(folder.markenname)}"`;
    return folderCard(list, folder, {
      name: folder.markenname,
      extraAttrs: attrs
    });
  }).join('');
  fillFoldersGrid(grid);
}

export function renderItemsView(list) {
  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${backButtonHtml('btn-back-to-brands')}
          </div>
        </div>
        <div class="table-actions">${produktCreateButtonHtml()}</div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bild</th>
              <th class="col-name">Produkt</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Preis</th>
              <th>Varianten</th>
              <th>Erstellt</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="produkte-items-body">
            <tr><td colspan="8" class="no-data">Lade Produkte...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination-container" id="pagination-produkt-items"></div>
    </div>
  `;
}

export function updateItemsTable(list) {
  const tbody = document.getElementById('produkte-items-body');
  if (!tbody) return;

  if (!list.currentItems.length) {
    const html = resolveEmptyState({
      hasActiveFilters: false,
      states: {
        default: {
          icon: 'cube',
          title: 'Keine Produkte für diese Marke vorhanden',
          text: emptyCreateText(),
          actionsHtml: produktCreateButtonHtml()
        }
      }
    }, 'default');
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state-cell">${html}</td></tr>`;
    list.pagination.updateTotal(0);
    list.pagination.render();
    return;
  }

  const { currentPage, itemsPerPage } = list.pagination.getState();
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = list.currentItems.slice(start, start + itemsPerPage);
  tbody.innerHTML = pageItems.map((produkt) => list.renderSingleRow(produkt, { checkbox: false })).join('');
  list.pagination.updateTotal(list.currentItems.length);
  list.pagination.render();
  window.ActionsDropdown?.init();
}
