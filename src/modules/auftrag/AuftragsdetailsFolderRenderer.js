// AuftragsdetailsFolderRenderer.js
// Rendering für Auftragsdetails: Toggle, Toolbar, Tabellen-Hülle und die
// Grid-Hierarchie Unternehmen → Marken → Items.

import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { NUR_UNTERNEHMEN_LABEL } from './AuftragsdetailsFolders.js';

export function viewToggleHtml(listViewMode) {
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

function canCreate(list) {
  return !list.isKunde && !list.isMitarbeiter;
}

export function createButtonHtml(list) {
  return canCreate(list)
    ? '<button id="btn-auftragsdetails-new" class="mdc-btn">Neue Auftragsdetails anlegen</button>'
    : '';
}

// Bulk-Aktionen und Anlegen-Button (Liste und Items-Ebene)
export function tableActionsHtml(list) {
  const canBulkDelete = window.canBulkDelete();
  return `
    <div class="table-actions">
      ${canBulkDelete ? '<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>' : ''}
      ${canBulkDelete ? '<button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>' : ''}
      <span id="selected-count" style="display:none;">0 ausgewählt</span>
      ${canBulkDelete ? '<button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>' : ''}
      ${createButtonHtml(list)}
    </div>
  `;
}

// Flache Tabelle samt Pagination (Liste und Items-Ebene)
export function tableHtml(list) {
  const canBulkDelete = window.canBulkDelete();
  const colspan = list.isKunde ? '8' : canBulkDelete ? '11' : '10';
  return `
    <div class="table-container auftragsdetails-table-container">
      <table class="data-table data-table--nowrap data-table--auftragsdetails">
        <thead>
          <tr>
            ${canBulkDelete ? `<th class="col-checkbox">
              <input type="checkbox" id="select-all-auftragsdetails">
            </th>` : ''}
            <th class="col-ad-auftrag">Auftrag</th>
            <th class="col-ad-unternehmen">Unternehmen</th>
            <th class="col-ad-marke">Marke</th>
            <th>${list.isKunde ? 'PO extern' : 'PO intern'}</th>
            <th>Status</th>
            <th>Start</th>
            <th>Ende</th>
            <th>Erstellt am</th>
            ${!list.isKunde ? '<th class="col-erstellt-von">Erstellt von</th>' : ''}
            ${!list.isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody id="auftragsdetails-table-body">
          <tr>
            <td colspan="${colspan}" class="loading">Lade Auftragsdetails...</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination-container" id="pagination-auftragsdetails"></div>
    </div>
  `;
}

function folderToolbar(list, { backId } = {}) {
  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${backId ? backButtonHtml(backId) : ''}
          ${viewToggleHtml(list.listViewMode)}
        </div>
      </div>
      <div class="table-actions">${createButtonHtml(list)}</div>
    </div>
  `;
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'Auftragsdetail' : 'Auftragsdetails'}`;
}

function folderIconHtml(list, folder, name) {
  return folder.logo_url
    ? `<img src="${list.sanitize(folder.logo_url)}" alt="${list.sanitize(name)}" class="folder-logo">`
    : `${icon('folder-open')}`;
}

function emptyFoldersHtml(list, { title, text }) {
  return `<div class="grid-span-all">${renderEmptyState({
    icon: 'document',
    title,
    text,
    actionsHtml: createButtonHtml(list)
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
      ${folderToolbar(list)}
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
    grid.innerHTML = emptyFoldersHtml(list, {
      title: 'Keine Auftragsdetails vorhanden',
      text: list.isKunde
        ? 'Es sind noch keine Auftragsdetails für Sie freigegeben.'
        : 'Es wurden noch keine Auftragsdetails erstellt.'
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
      ${folderToolbar(list, { backId: 'btn-back-to-companies' })}
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
    grid.innerHTML = emptyFoldersHtml(list, {
      title: 'Keine Marken mit Auftragsdetails',
      text: 'Für dieses Unternehmen gibt es noch keine Auftragsdetails.'
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
        ${tableActionsHtml(list)}
      </div>
      ${tableHtml(list)}
    </div>
  `;
}
