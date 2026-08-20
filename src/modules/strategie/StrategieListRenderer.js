// StrategieListRenderer.js
// Alle Render- und Update-Methoden für die Strategie-Listenansicht

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';

function canCreateStrategie() {
  return !window.isKunde() && (window.isAdmin() || window.currentUser?.permissions?.strategie?.can_edit);
}

function strategieCreateButtonHtml() {
  return canCreateStrategie()
    ? '<button class="mdc-btn" data-action="create-strategie">Neue Strategie anlegen</button>'
    : '';
}

export function renderCompaniesView(list) {
  const isKunde = window.isKunde();
  const canCreate = !isKunde && (window.isAdmin() || window.currentUser?.permissions?.strategie?.can_edit);
  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${ViewModeToggle.render([
              { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: list.listViewMode === 'list' },
              { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: list.listViewMode === 'grid' }
            ])}
          </div>
        </div>
        <div class="table-actions">
          ${!isKunde ? `<button class="mdc-btn mdc-btn--secondary" data-action="how-to-strategie">
            ${icon('globe')}
            How to
          </button>` : ''}
          ${canCreate ? `<button class="mdc-btn" data-action="create-strategie">Neue Strategie anlegen</button>` : ''}
        </div>
      </div>

      <div class="table-container">
        ${list.listViewMode === 'grid'
          ? `<div class="folders-grid" id="companies-grid"></div>`
          : renderCompaniesTable()}
      </div>
    </div>
  `;
}

function renderCompaniesTable() {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Unternehmen</th>
          <th>Strategien</th>
        </tr>
      </thead>
      <tbody id="companies-table-body"></tbody>
    </table>
  `;
}

export function updateCompaniesGrid(list) {
  const grid = document.getElementById('companies-grid');
  if (!grid) return;

  if (list.companyFolders.length === 0) {
    grid.innerHTML = `<div class="grid-span-all">${renderEmptyState({
      icon: 'clipboard',
      title: 'Keine Strategien vorhanden',
      text: canCreateStrategie() ? 'Legen Sie Ihre erste Strategie an, um loszulegen.' : 'Es wurden noch keine Strategien für Sie freigegeben.',
      actionsHtml: strategieCreateButtonHtml()
    })}</div>`;
    return;
  }

  grid.innerHTML = list.companyFolders.map((folder) => `
    <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${list.sanitize(folder.firmenname)}">
      <div class="folder-icon">
        ${folder.logo_url
          ? `<img src="${list.sanitize(folder.logo_url)}" alt="${list.sanitize(folder.firmenname)}" class="folder-logo">`
          : `${icon('folder-open')}`
        }
      </div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(folder.firmenname)}</span>
        <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Strategie' : 'Strategien'}</span>
      </div>
    </div>
  `).join('');
  fillFoldersGrid(grid);
}

export function updateCompaniesTable(list) {
  const tbody = document.getElementById('companies-table-body');
  if (!tbody) return;

  if (list.companyFolders.length === 0) {
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'clipboard',
      title: 'Keine Strategien vorhanden',
      text: canCreateStrategie() ? 'Legen Sie Ihre erste Strategie an, um loszulegen.' : 'Es wurden noch keine Strategien für Sie freigegeben.',
      actionsHtml: strategieCreateButtonHtml()
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

export function renderBrandsView(list) {
  const isKunde = window.isKunde();
  const canCreate = !isKunde && (window.isAdmin() || window.currentUser?.permissions?.strategie?.can_edit);
  const showBrandsSection = !isKunde || list.brandFolders.length > 0;
  const showCompanyOnlySection = !isKunde || list.companyOnlyItems.length > 0;

  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <button id="btn-back-to-companies" class="mdc-btn mdc-btn--secondary">
              ${icon('arrow-left')}
              Zurück
            </button>
          </div>
        </div>
        <div class="table-actions">
          ${!isKunde ? `<button class="mdc-btn mdc-btn--secondary" data-action="how-to-strategie">How to</button>` : ''}
          ${canCreate ? `<button class="mdc-btn" data-action="create-strategie">Neue Strategie anlegen</button>` : ''}
        </div>
      </div>

      ${showBrandsSection ? `
        <div class="table-container">
          <h3 class="table-section-title">Strategien mit Marke</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Marke</th>
                <th>Strategien</th>
              </tr>
            </thead>
            <tbody id="brands-table-body"></tbody>
          </table>
        </div>
      ` : ''}

      ${showCompanyOnlySection ? `
        <div class="table-container table-container--spaced">
          <h3 class="table-section-title">Strategien ohne Marke (nur Unternehmen)</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kampagne</th>
                <th>Erstellt von</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody id="company-only-table-body"></tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;
}

export function updateBrandsTable(list) {
  const tbody = document.getElementById('brands-table-body');
  if (!tbody) return;

  if (list.brandFolders.length === 0) {
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'tag',
      title: 'Keine markenbezogenen Strategien vorhanden',
      actionsHtml: strategieCreateButtonHtml()
    }, 2);
    return;
  }

  tbody.innerHTML = list.brandFolders.map((brand) => `
    <tr class="table-row-clickable brand-row" data-marke-id="${brand.id}" data-marke-name="${list.sanitize(brand.markenname)}">
      <td>
        ${brand.logo_url ? `<img src="${list.sanitize(brand.logo_url)}" class="table-logo" width="24" height="24" alt="" />` : ''}
        <a href="#" class="table-link brand-link" data-marke-id="${brand.id}" data-marke-name="${list.sanitize(brand.markenname)}">
          ${list.sanitize(brand.markenname)}
        </a>
      </td>
      <td>${brand.count}</td>
    </tr>
  `).join('');
}

export function renderItemsRows(list, items) {
  return items.map((strategie) => {
    const isKunde = window.isKunde();
    const kampagneName = KampagneUtils.getDisplayName(strategie.kampagne);
    return `
      <tr class="table-row-clickable" data-strategie-id="${strategie.id}">
        <td class="col-name">
          <a href="#" class="table-link" data-table="strategie" data-id="${strategie.id}">
            ${list.sanitize(strategie.name || 'Ohne Namen')}
          </a>
        </td>
        <td>${kampagneName}</td>
        <td>${list.sanitize(strategie.created_by_user?.name || '-')}</td>
        <td class="col-actions">
          <div class="actions-dropdown-container" data-entity-type="strategie">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              ${icon('dots-vertical-filled')}
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view-strategie" data-id="${strategie.id}">
                ${window.ActionsDropdown?.getHeroIcon('view') || ''}
                Details anzeigen
              </a>
              ${!isKunde ? `
                <a href="#" class="action-item" data-action="edit-strategie" data-id="${strategie.id}">
                  ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                  Bearbeiten
                </a>
                ${window.currentUser?.permissions?.strategie?.can_delete ? `
                  <div class="action-separator"></div>
                  <a href="#" class="action-item action-danger" data-action="delete-strategie" data-id="${strategie.id}">
                    ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                    Löschen
                  </a>
                ` : ''}
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function updateCompanyOnlyTable(list) {
  const tbody = document.getElementById('company-only-table-body');
  if (!tbody) return;

  if (list.companyOnlyItems.length === 0) {
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'building',
      title: 'Keine unternehmensweiten Strategien ohne Marke',
      actionsHtml: strategieCreateButtonHtml()
    }, 4);
    return;
  }

  tbody.innerHTML = renderItemsRows(list, list.companyOnlyItems);
}

export function renderItemsView(list) {
  const isKunde = window.isKunde();
  const canCreate = !isKunde && (window.isAdmin() || window.currentUser?.permissions?.strategie?.can_edit);
  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <button id="btn-back-to-brands" class="mdc-btn mdc-btn--secondary">
              ${icon('arrow-left')}
              Zurück
            </button>
          </div>
        </div>
        <div class="table-actions">
          ${!isKunde ? `<button class="mdc-btn mdc-btn--secondary" data-action="how-to-strategie">How to</button>` : ''}
          ${canCreate ? `<button class="mdc-btn" data-action="create-strategie">Neue Strategie anlegen</button>` : ''}
        </div>
      </div>
      <div class="table-container">
        <table class="data-table strategien-table">
          <thead>
            <tr>
              <th class="col-name">Name</th>
              <th class="col-kampagne">Kampagne</th>
              <th class="col-erstellt-von">Erstellt von</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="strategien-table-body">
            <tr><td colspan="4" class="table-empty-cell">Lade Strategien...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="pagination-container-strategie-items"></div>
    </div>
  `;
}

export function updateItemsTable(list) {
  const tbody = document.getElementById('strategien-table-body');
  if (!tbody) return;

  if (list.currentItems.length === 0) {
    tbody.innerHTML = renderEmptyStateRow({
      icon: 'clipboard',
      title: 'Keine Strategien für diese Marke vorhanden',
      actionsHtml: strategieCreateButtonHtml()
    }, 4);
    list.pagination.updateTotal(0);
    list.pagination.render();
    return;
  }

  const { currentPage, itemsPerPage } = list.pagination.getState();
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = list.currentItems.slice(start, end);

  tbody.innerHTML = renderItemsRows(list, pageItems);
  list.pagination.updateTotal(list.currentItems.length);
  list.pagination.render();
  if (window.ActionsDropdown) {
    window.ActionsDropdown.init();
  }
}
