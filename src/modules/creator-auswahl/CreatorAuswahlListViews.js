// CreatorAuswahlListViews.js
// Ordner und die drei Ansichten Unternehmen, Marken, Listen (Prototype-Mixin von CreatorAuswahlList)

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import {
  renderVerknuepfungen,
  namedLinks,
  skriptLinks,
  skripteAusStrategie
} from '../../core/ui/tableVerknuepfungen.js';

// Create ist eine Capability, keine Rolle: Investor/Finanzen (intern, view-only)
// bekommen keinen Anlegen-Button.
function canCreateListe() {
  // Casting entsteht beim Finalisieren des Briefings, nicht über diese Liste.
  return false;
}

export function buildCompanyFolders() {
  const map = new Map();
  this.listen.forEach((item) => {
    if (!item.unternehmen?.id) return;
    const key = item.unternehmen.id;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        firmenname: item.unternehmen.firmenname,
        logo_url: item.unternehmen.logo_url,
        count: 0
      });
    }
    map.get(key).count += 1;
  });

  this.companyFolders = Array.from(map.values()).sort((a, b) =>
    (a.firmenname || '').localeCompare(b.firmenname || '', 'de')
  );
}

export function buildBrandFolders() {
  const scoped = this.listen.filter((item) => item.unternehmen_id === this.currentUnternehmenId);
  const brandMap = new Map();
  this.companyOnlyItems = scoped.filter((item) => !item.marke_id);

  scoped.forEach((item) => {
    if (!item.marke_id || !item.marke?.id) return;
    if (!brandMap.has(item.marke.id)) {
      brandMap.set(item.marke.id, {
        id: item.marke.id,
        markenname: item.marke.markenname,
        logo_url: item.marke.logo_url,
        count: 0
      });
    }
    brandMap.get(item.marke.id).count += 1;
  });

  this.brandFolders = Array.from(brandMap.values()).sort((a, b) =>
    (a.markenname || '').localeCompare(b.markenname || '', 'de')
  );
}

export function buildCurrentItems() {
  this.currentItems = this.listen.filter(
    (item) => item.unternehmen_id === this.currentUnternehmenId && item.marke_id === this.currentMarkeId
  );
}

export function renderCompaniesView() {
  const canCreate = canCreateListe();

  return `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${ViewModeToggle.render([
              { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.listViewMode === 'list' },
              { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.listViewMode === 'grid' }
            ])}
          </div>
        </div>
        <div class="table-actions">
          ${canCreate ? `<button class="mdc-btn" data-action="create-liste">Neue Casting-Liste</button>` : ''}
        </div>
      </div>

      <div class="table-container">
        ${this.listViewMode === 'grid'
          ? `<div class="folders-grid" id="companies-grid"></div>`
          : this.renderCompaniesTable()}
      </div>
    </div>
  `;
}

export function renderCompaniesTable() {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Unternehmen</th>
          <th>Casting-Listen</th>
        </tr>
      </thead>
      <tbody id="companies-table-body"></tbody>
    </table>
  `;
}

export function _sourcingEmptyState(title, icon = 'sourcing') {
  const canCreate = canCreateListe();
  return {
    icon,
    title,
    actionsHtml: canCreate ? '<button class="mdc-btn" data-action="create-liste">Neue Casting-Liste</button>' : ''
  };
}

export function updateCompaniesGrid() {
  const grid = document.getElementById('companies-grid');
  if (!grid) return;

  if (this.companyFolders.length === 0) {
    grid.innerHTML = `<div class="grid-span-all">${renderEmptyState(this._sourcingEmptyState('Keine Casting-Listen vorhanden'))}</div>`;
    return;
  }

  grid.innerHTML = this.companyFolders.map((folder) => `
    <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${this.sanitize(folder.firmenname)}">
      <div class="folder-icon">
        ${folder.logo_url
          ? `<img src="${this.sanitize(folder.logo_url)}" alt="${this.sanitize(folder.firmenname)}" class="folder-logo">`
          : `${icon('folder-open')}`
        }
      </div>
      <div class="folder-info">
        <span class="folder-name">${this.sanitize(folder.firmenname)}</span>
        <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Liste' : 'Listen'}</span>
      </div>
    </div>
  `).join('');
  fillFoldersGrid(grid);
}

export function updateCompaniesTable() {
  const tbody = document.getElementById('companies-table-body');
  if (!tbody) return;

  if (this.companyFolders.length === 0) {
    tbody.innerHTML = renderEmptyStateRow(this._sourcingEmptyState('Keine Casting-Listen vorhanden'), 2);
    return;
  }

  tbody.innerHTML = this.companyFolders.map((folder) => `
    <tr class="table-row-clickable company-row" data-unternehmen-id="${folder.id}" data-unternehmen-name="${this.sanitize(folder.firmenname)}">
      <td>
        ${folder.logo_url ? `<img src="${this.sanitize(folder.logo_url)}" class="table-logo" width="24" height="24" alt="" />` : ''}
        <a href="#" class="table-link company-link" data-unternehmen-id="${folder.id}" data-unternehmen-name="${this.sanitize(folder.firmenname)}">
          ${this.sanitize(folder.firmenname)}
        </a>
      </td>
      <td>${folder.count}</td>
    </tr>
  `).join('');
}

export function renderBrandsView() {
  const isKunde = window.isKunde();
  const canCreate = canCreateListe();
  const showBrandsSection = !isKunde || this.brandFolders.length > 0;
  const showCompanyOnlySection = !isKunde || this.companyOnlyItems.length > 0;

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
          ${canCreate ? `<button class="mdc-btn" data-action="create-liste">Neue Casting-Liste</button>` : ''}
        </div>
      </div>

      ${showBrandsSection ? `
        <div class="table-container">
          <h3 class="table-section-title">Casting-Listen mit Marke</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Marke</th>
                <th>Casting-Listen</th>
              </tr>
            </thead>
            <tbody id="brands-table-body"></tbody>
          </table>
        </div>
      ` : ''}

      ${showCompanyOnlySection ? `
        <div class="table-container table-container--spaced">
          <h3 class="table-section-title">Casting-Listen ohne Marke (nur Unternehmen)</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kampagne</th>
                <th>Creator</th>
                  <th>Erstellt von</th>
                  <th>Erstellt am</th>
                  <th>Briefing</th>
                  <th>Konzept</th>
                  <th>Skript</th>
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

export function updateBrandsTable() {
  const tbody = document.getElementById('brands-table-body');
  if (!tbody) return;

  if (this.brandFolders.length === 0) {
    tbody.innerHTML = renderEmptyStateRow(this._sourcingEmptyState('Keine markenbezogenen Casting-Listen vorhanden', 'tag'), 2);
    return;
  }

  tbody.innerHTML = this.brandFolders.map((brand) => `
    <tr class="table-row-clickable brand-row" data-marke-id="${brand.id}" data-marke-name="${this.sanitize(brand.markenname)}">
      <td>
        ${brand.logo_url ? `<img src="${this.sanitize(brand.logo_url)}" class="table-logo" width="24" height="24" alt="" />` : ''}
        <a href="#" class="table-link brand-link" data-marke-id="${brand.id}" data-marke-name="${this.sanitize(brand.markenname)}">
          ${this.sanitize(brand.markenname)}
        </a>
      </td>
      <td>${brand.count}</td>
    </tr>
  `).join('');
}

export function renderItemsRows(items) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return items.map((liste) => {
    const kampagneName = KampagneUtils.getDisplayName(liste.kampagne);
    // data-name nur am rename-liste-Item: der Drawer liest den aktuellen Namen daraus.
    const actionsHtml = actionBuilder.create('creator_auswahl_liste', liste.id, null, {
      dataset: (action) => action.id === 'rename-liste' ? { name: liste.name || '' } : null
    });
    return `
      <tr class="table-row-clickable" data-liste-id="${liste.id}">
        <td class="col-name">
          <a href="#" class="table-link" data-table="sourcing" data-id="${liste.id}">
            ${this.sanitize(liste.name || 'Ohne Namen')}
          </a>
        </td>
        <td>${kampagneName}</td>
        <td>${liste.item_count ?? 0}</td>
        <td>${this.sanitize(liste.created_by_user?.name || '-')}</td>
        <td>${formatDate(liste.created_at)}</td>
        <td>${renderVerknuepfungen(namedLinks(liste.briefing, { labelKey: 'aktivierung_name', kind: 'briefing' }))}</td>
        <td>${renderVerknuepfungen(namedLinks(liste.strategie, { labelKey: 'name', kind: 'konzept' }))}</td>
        <td>${renderVerknuepfungen(skriptLinks(skripteAusStrategie(liste.strategie)))}</td>
        <td class="col-actions">
          ${actionsHtml}
        </td>
      </tr>
    `;
  }).join('');
}

export function updateCompanyOnlyTable() {
  const tbody = document.getElementById('company-only-table-body');
  if (!tbody) return;

  if (this.companyOnlyItems.length === 0) {
    tbody.innerHTML = renderEmptyStateRow(this._sourcingEmptyState('Keine unternehmensweiten Einträge ohne Marke', 'building'), 9);
    return;
  }

  tbody.innerHTML = this.renderItemsRows(this.companyOnlyItems);
}

export function renderItemsView() {
  const isKunde = window.isKunde();
  const canCreate = canCreateListe();
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
          ${canCreate ? `<button class="mdc-btn" data-action="create-liste">Neue Casting-Liste</button>` : ''}
        </div>
      </div>
      <div class="table-container table-container--creator-auswahl-list">
        <table class="data-table data-table--creator-auswahl-list">
          <thead>
            <tr>
              <th class="col-name ca-col-name">Name</th>
              <th class="ca-col-kampagne">Kampagne</th>
              <th class="ca-col-creator-count">Creator</th>
              <th class="ca-col-erstellt-von">Erstellt von</th>
              <th class="ca-col-erstellt-am">Erstellt am</th>
              <th>Briefing</th>
              <th>Konzept</th>
              <th>Skript</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="creator-auswahl-table-body">
            <tr><td colspan="9" class="table-state-cell">Lade Casting-Listen...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="pagination-container-creator-auswahl-items"></div>
    </div>
  `;
}

export function updateItemsTable() {
  const tbody = document.getElementById('creator-auswahl-table-body');
  if (!tbody) return;

  if (this.currentItems.length === 0) {
    tbody.innerHTML = renderEmptyStateRow(this._sourcingEmptyState('Keine Casting-Listen für diese Marke vorhanden'), 9);
    this.pagination.updateTotal(0);
    this.pagination.render();
    return;
  }

  const { currentPage, itemsPerPage } = this.pagination.getState();
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = this.currentItems.slice(start, end);

  tbody.innerHTML = this.renderItemsRows(pageItems);
  this.pagination.updateTotal(this.currentItems.length);
  this.pagination.render();
  if (window.ActionsDropdown) {
    window.ActionsDropdown.init();
  }
}

export const creatorAuswahlListViewsMethods = {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  renderCompaniesView,
  renderCompaniesTable,
  _sourcingEmptyState,
  updateCompaniesGrid,
  updateCompaniesTable,
  renderBrandsView,
  updateBrandsTable,
  renderItemsRows,
  updateCompanyOnlyTable,
  renderItemsView,
  updateItemsTable
};
