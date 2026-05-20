// StrategieListRenderer.js
// Alle Render- und Update-Methoden für die Strategie-Listenansicht

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';

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
          ${!isKunde ? `<button class="secondary-btn" data-action="how-to-strategie">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
            How to
          </button>` : ''}
          ${canCreate ? `<button class="primary-btn" data-action="create-strategie">Neue Strategie anlegen</button>` : ''}
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
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Keine Strategien vorhanden.</p></div>`;
    return;
  }

  grid.innerHTML = list.companyFolders.map((folder) => `
    <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${list.sanitize(folder.firmenname)}">
      <div class="folder-icon">
        ${folder.logo_url
          ? `<img src="${list.sanitize(folder.logo_url)}" alt="${list.sanitize(folder.firmenname)}" class="folder-logo">`
          : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="folder-svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>`
        }
      </div>
      <div class="folder-info">
        <span class="folder-name">${list.sanitize(folder.firmenname)}</span>
        <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Strategie' : 'Strategien'}</span>
      </div>
    </div>
  `).join('');
}

export function updateCompaniesTable(list) {
  const tbody = document.getElementById('companies-table-body');
  if (!tbody) return;

  if (list.companyFolders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="no-data">Keine Strategien vorhanden.</td></tr>`;
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
            <button id="btn-back-to-companies" class="secondary-btn">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Zurück
            </button>
          </div>
        </div>
        <div class="table-actions">
          ${!isKunde ? `<button class="secondary-btn" data-action="how-to-strategie">How to</button>` : ''}
          ${canCreate ? `<button class="primary-btn" data-action="create-strategie">Neue Strategie anlegen</button>` : ''}
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
    tbody.innerHTML = `<tr><td colspan="2" class="no-data">Keine markenbezogenen Strategien vorhanden.</td></tr>`;
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
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
    tbody.innerHTML = `<tr><td colspan="4" class="no-data">Keine unternehmensweiten Strategien ohne Marke.</td></tr>`;
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
            <button id="btn-back-to-brands" class="secondary-btn">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Zurück
            </button>
          </div>
        </div>
        <div class="table-actions">
          ${!isKunde ? `<button class="secondary-btn" data-action="how-to-strategie">How to</button>` : ''}
          ${canCreate ? `<button class="primary-btn" data-action="create-strategie">Neue Strategie anlegen</button>` : ''}
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">Name</th>
              <th class="col-kampagne">Kampagne</th>
              <th class="col-erstellt-von">Erstellt von</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="strategien-table-body">
            <tr><td colspan="4" style="text-align:center;padding:var(--space-lg);">Lade Strategien...</td></tr>
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
    tbody.innerHTML = `<tr><td colspan="4" class="no-data">Keine Strategien für diese Marke vorhanden.</td></tr>`;
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
