// StrategieList.js
// Hierarchische Strategie-Ansicht: Unternehmen -> Marken -> Inhalte

import { strategieService } from './StrategieService.js';
import { AutoGeneration } from '../../core/form/logic/AutoGeneration.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';

export class StrategieList {
  constructor() {
    this.strategien = [];
    this.autoGeneration = new AutoGeneration();
    this.pagination = new PaginationSystem();
    this._boundEventListeners = new Set();

    this.viewMode = 'companies'; // companies | brands | items
    this.listViewMode = 'grid'; // grid | list (nur companies)

    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.currentItems = [];

    this.companyFolders = [];
    this.brandFolders = [];
    this.companyOnlyItems = [];
  }

  async init() {
    this._forceReload = true;
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;

    const canView = window.currentUser?.rolle === 'admin' || window.currentUser?.permissions?.strategie?.can_view;
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Strategien anzuzeigen.</p>
        </div>
      `;
      return;
    }

    window.setHeadline('Strategien');
    this.updateBreadcrumbDisplay();
    await this.loadAndRender();
  }

  async loadAndRender() {
    if (this.strategien.length === 0 || this._forceReload) {
      this.strategien = await strategieService.getAllStrategien();
      this._forceReload = false;
    }

    if (this.viewMode === 'companies') {
      this.buildCompanyFolders();
    } else if (this.viewMode === 'brands') {
      this.buildBrandFolders();
    } else {
      this.buildCurrentItems();
    }

    this.render();
    this.bindEvents();

    if (this.viewMode === 'items') {
      this.pagination.init('pagination-container-strategie-items', {
        itemsPerPage: 25,
        onPageChange: () => this.updateItemsTable(),
        onItemsPerPageChange: () => this.updateItemsTable()
      });
      this.pagination.currentPage = this.pagination.currentPage || 1;
      this.updateItemsTable();
      this.pagination.updateTotal(this.currentItems.length);
      this.pagination.render();
    }
  }

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;

    if (this.viewMode === 'companies') {
      // Base view - router handles breadcrumb
      return;
    }

    if (this.viewMode === 'brands') {
      window.breadcrumbSystem.updateDetailLabel(this.currentUnternehmenName || 'Unternehmen');
      return;
    }

    window.breadcrumbSystem.updateDetailLabel(this.currentMarkeName || 'Marke');
  }

  sanitize(value) {
    return window.validatorSystem?.sanitizeHtml(value) || value || '';
  }

  buildCompanyFolders() {
    const map = new Map();
    this.strategien.forEach((item) => {
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

  buildBrandFolders() {
    const scoped = this.strategien.filter((item) => item.unternehmen_id === this.currentUnternehmenId);
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

  buildCurrentItems() {
    this.currentItems = this.strategien.filter(
      (item) => item.unternehmen_id === this.currentUnternehmenId && item.marke_id === this.currentMarkeId
    );
  }

  renderCompaniesView() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.strategie?.can_edit);
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
          ${this.listViewMode === 'grid'
            ? `<div class="folders-grid" id="companies-grid"></div>`
            : this.renderCompaniesTable()}
        </div>
      </div>
    `;
  }

  renderCompaniesTable() {
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

  updateCompaniesGrid() {
    const grid = document.getElementById('companies-grid');
    if (!grid) return;

    if (this.companyFolders.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Keine Strategien vorhanden.</p></div>`;
      return;
    }

    grid.innerHTML = this.companyFolders.map((folder) => `
      <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${this.sanitize(folder.firmenname)}">
        <div class="folder-icon">
          ${folder.logo_url
            ? `<img src="${this.sanitize(folder.logo_url)}" alt="${this.sanitize(folder.firmenname)}" class="folder-logo">`
            : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="folder-svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>`
          }
        </div>
        <div class="folder-info">
          <span class="folder-name">${this.sanitize(folder.firmenname)}</span>
          <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Strategie' : 'Strategien'}</span>
        </div>
      </div>
    `).join('');
  }

  updateCompaniesTable() {
    const tbody = document.getElementById('companies-table-body');
    if (!tbody) return;

    if (this.companyFolders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="no-data">Keine Strategien vorhanden.</td></tr>`;
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

  renderBrandsView() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.strategie?.can_edit);
    const showBrandsSection = !isKunde || this.brandFolders.length > 0;
    const showCompanyOnlySection = !isKunde || this.companyOnlyItems.length > 0;

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

  updateBrandsTable() {
    const tbody = document.getElementById('brands-table-body');
    if (!tbody) return;

    if (this.brandFolders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="no-data">Keine markenbezogenen Strategien vorhanden.</td></tr>`;
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

  renderItemsRows(items) {
    return items.map((strategie) => {
      const rolle = window.currentUser?.rolle?.toLowerCase();
      const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
      const kampagneName = KampagneUtils.getDisplayName(strategie.kampagne);
      return `
        <tr class="table-row-clickable" data-strategie-id="${strategie.id}">
          <td class="col-name">
            <a href="#" class="table-link" data-table="strategie" data-id="${strategie.id}">
              ${this.sanitize(strategie.name || 'Ohne Namen')}
            </a>
          </td>
          <td>${kampagneName}</td>
          <td>${this.sanitize(strategie.created_by_user?.name || '-')}</td>
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

  updateCompanyOnlyTable() {
    const tbody = document.getElementById('company-only-table-body');
    if (!tbody) return;

    if (this.companyOnlyItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="no-data">Keine unternehmensweiten Strategien ohne Marke.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.renderItemsRows(this.companyOnlyItems);
  }

  renderItemsView() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.strategie?.can_edit);
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

  updateItemsTable() {
    const tbody = document.getElementById('strategien-table-body');
    if (!tbody) return;

    if (this.currentItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="no-data">Keine Strategien für diese Marke vorhanden.</td></tr>`;
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

  render() {
    this.updateBreadcrumbDisplay();
    let html = '';
    if (this.viewMode === 'companies') {
      html = this.renderCompaniesView();
    } else if (this.viewMode === 'brands') {
      html = this.renderBrandsView();
    } else {
      html = this.renderItemsView();
    }

    window.setContentSafely(window.content, html);

    if (this.viewMode === 'companies') {
      if (this.listViewMode === 'grid') {
        this.updateCompaniesGrid();
      } else {
        this.updateCompaniesTable();
      }
    } else if (this.viewMode === 'brands') {
      this.updateBrandsTable();
      this.updateCompanyOnlyTable();
      if (window.ActionsDropdown) {
        window.ActionsDropdown.init();
      }
    }
  }

  switchToBrandsView(unternehmenId, unternehmenName) {
    this.viewMode = 'brands';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.loadAndRender();
  }

  switchToItemsView(markeId, markeName) {
    this.viewMode = 'items';
    this.currentMarkeId = markeId;
    this.currentMarkeName = markeName;
    this.pagination.currentPage = 1;
    this.loadAndRender();
  }

  switchToCompaniesView() {
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.loadAndRender();
  }

  bindEvents() {
    this._boundEventListeners.forEach((cleanup) => cleanup());
    this._boundEventListeners.clear();

    const btnViewList = document.getElementById('btn-view-list');
    if (btnViewList) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'list') return;
        this.listViewMode = 'list';
        this.loadAndRender();
      };
      btnViewList.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewList.removeEventListener('click', handler));
    }

    const btnViewGrid = document.getElementById('btn-view-grid');
    if (btnViewGrid) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'grid') return;
        this.listViewMode = 'grid';
        this.loadAndRender();
      };
      btnViewGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewGrid.removeEventListener('click', handler));
    }

    const btnBackToCompanies = document.getElementById('btn-back-to-companies');
    if (btnBackToCompanies) {
      const handler = (e) => {
        e.preventDefault();
        this.switchToCompaniesView();
      };
      btnBackToCompanies.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnBackToCompanies.removeEventListener('click', handler));
    }

    const btnBackToBrands = document.getElementById('btn-back-to-brands');
    if (btnBackToBrands) {
      const handler = (e) => {
        e.preventDefault();
        this.viewMode = 'brands';
        this.currentMarkeId = null;
        this.currentMarkeName = null;
        this.loadAndRender();
      };
      btnBackToBrands.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnBackToBrands.removeEventListener('click', handler));
    }

    const companiesGrid = document.getElementById('companies-grid');
    if (companiesGrid) {
      const handler = (e) => {
        const folder = e.target.closest('.folder-card');
        if (!folder) return;
        this.switchToBrandsView(folder.dataset.unternehmenId, folder.dataset.unternehmenName);
      };
      companiesGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => companiesGrid.removeEventListener('click', handler));
    }

    document.querySelectorAll('.company-row').forEach((row) => {
      const handler = (e) => {
        if (e.target.closest('.company-link')) e.preventDefault();
        this.switchToBrandsView(row.dataset.unternehmenId, row.dataset.unternehmenName);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });

    document.querySelectorAll('.brand-row').forEach((row) => {
      const handler = (e) => {
        if (e.target.closest('.brand-link')) e.preventDefault();
        this.switchToItemsView(row.dataset.markeId, row.dataset.markeName);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });

    document.addEventListener('click', this._globalClickHandler = (e) => {
      if (e.target.closest('[data-action="create-strategie"]')) {
        e.preventDefault();
        this.openCreateDrawer();
        return;
      }

      if (e.target.closest('[data-action="how-to-strategie"]')) {
        e.preventDefault();
        this.showHowToModal();
        return;
      }

      const viewBtn = e.target.closest('[data-action="view-strategie"]');
      if (viewBtn) {
        e.preventDefault();
        window.navigateTo(`/strategie/${viewBtn.dataset.id}`);
        return;
      }

      const editBtn = e.target.closest('[data-action="edit-strategie"]');
      if (editBtn) {
        e.preventDefault();
        this.openEditDrawer(editBtn.dataset.id);
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete-strategie"]');
      if (deleteBtn) {
        e.preventDefault();
        this.confirmDeleteStrategie(deleteBtn.dataset.id);
        return;
      }

      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'strategie') {
        e.preventDefault();
        window.navigateTo(`/strategie/${e.target.dataset.id}`);
        return;
      }

      const row = e.target.closest('.table-row-clickable');
      if (row && !e.target.closest('.actions-dropdown-container') && !e.target.closest('.table-link')) {
        const id = row.dataset.strategieId;
        if (id) window.navigateTo(`/strategie/${id}`);
      }
    });
    this._boundEventListeners.add(() => document.removeEventListener('click', this._globalClickHandler));
  }

  showHowToModal() {
    if (window.modalSystem) {
      window.modalSystem.open({
        title: 'Wie funktioniert die Strategie?',
        content: `
          <div class="how-to-content">
            <p><strong>1. Strategie erstellen</strong></p>
            <p>Klicke auf "Neue Strategie anlegen" und wähle Unternehmen, Marke und Kampagne aus.</p>
            <p><strong>2. Items hinzufügen</strong></p>
            <p>Füge Video-Konzepte, Hooks und andere Elemente zur Strategie hinzu.</p>
            <p><strong>3. Mit Kunden teilen</strong></p>
            <p>Kunden können die Strategie einsehen und Feedback geben.</p>
          </div>
        `,
        size: 'medium'
      });
    }
  }

  async confirmDeleteStrategie(id) {
    if (window.confirmationModal) {
      const result = await window.confirmationModal.open({
        title: 'Strategie löschen',
        message: 'Möchten Sie diese Strategie wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (result?.confirmed) {
        await this.deleteStrategie(id);
      }
    } else if (confirm('Möchten Sie diese Strategie wirklich löschen?')) {
      await this.deleteStrategie(id);
    }
  }

  async deleteStrategie(id) {
    try {
      const { error } = await window.supabase
        .from('strategie')
        .delete()
        .eq('id', id);

      if (error) throw error;
      window.toastSystem?.show('Strategie erfolgreich gelöscht', 'success');
      this._forceReload = true;
      this.strategien = [];
      await this.loadAndRender();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen der Strategie', 'error');
    }
  }

  openCreateDrawer() {
    this.closeCreateDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'strategie-create-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'strategie-create-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Neue Strategie</span>
        <p class="drawer-subtitle">Erstellen Sie eine neue Strategie für eine Kampagne</p>
      </div>
      <div>
        <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = window.formSystem.renderFormOnly('strategie');

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeCreateDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeCreateDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });

    window.formSystem.bindFormEvents('strategie', null);
    const form = panel.querySelector('#strategie-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleCreateFormSubmit(form);
      };
      const cancelBtn = form.querySelector('.mdc-btn--cancel');
      if (cancelBtn) {
        cancelBtn.onclick = (e) => {
          e.preventDefault();
          this.closeCreateDrawer();
        };
      }
    }
  }

  closeCreateDrawer() {
    const overlay = document.getElementById('strategie-create-drawer-overlay');
    const panel = document.getElementById('strategie-create-drawer');

    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        overlay?.remove();
        panel?.remove();
      }, 300);
    } else {
      overlay?.remove();
    }
  }

  async handleCreateFormSubmit(form) {
    try {
      const submitData = window.formSystem.collectSubmitData(form);
      if (!submitData.name || submitData.name.trim() === '') {
        const generatedName = await this.autoGeneration.autoGenerateStrategieName(
          submitData.kampagne_id,
          submitData.marke_id,
          submitData.unternehmen_id
        );
        if (generatedName) submitData.name = generatedName;
      }

      const newStrategie = await strategieService.createStrategie(submitData);
      if (newStrategie?.id) {
        window.toastSystem?.show('Strategie erfolgreich erstellt', 'success');
        this.closeCreateDrawer();
        window.navigateTo(`/strategie/${newStrategie.id}`);
      } else {
        throw new Error('Keine ID zurückgegeben');
      }
    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error);
      window.toastSystem?.show(`Fehler beim Erstellen: ${error.message}`, 'error');
    }
  }

  async openEditDrawer(strategieId) {
    this.closeEditDrawer();

    try {
      const strategie = await strategieService.getStrategieById(strategieId);
      if (!strategie) throw new Error('Strategie nicht gefunden');

      const overlay = document.createElement('div');
      overlay.className = 'drawer-overlay';
      overlay.id = 'strategie-edit-drawer-overlay';

      const panel = document.createElement('div');
      panel.setAttribute('role', 'dialog');
      panel.className = 'drawer-panel';
      panel.id = 'strategie-edit-drawer';

      const header = document.createElement('div');
      header.className = 'drawer-header';
      header.innerHTML = `
        <div>
          <span class="drawer-title">Strategie bearbeiten</span>
          <p class="drawer-subtitle">Zuordnungen ändern – der Name wird automatisch angepasst</p>
        </div>
        <div>
          <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
        </div>
      `;

      const body = document.createElement('div');
      body.className = 'drawer-body';
      body.innerHTML = `
        <form id="strategie-edit-form" class="mdc-form" novalidate>
          <input type="hidden" name="strategie_id" value="${strategie.id}" />

          <div class="mdc-field">
            <label class="mdc-label" for="edit-strategie-name">Name (auto-generiert)</label>
            <input type="text" id="edit-strategie-name" class="mdc-input" value="${this.sanitize(strategie.name || '')}" readonly disabled />
          </div>

          <div class="mdc-field">
            <label class="mdc-label" for="edit-strategie-unternehmen">Unternehmen <span class="required">*</span></label>
            <select id="edit-strategie-unternehmen" name="unternehmen_id" class="mdc-select" required>
              <option value="">Wird geladen...</option>
            </select>
          </div>

          <div class="mdc-field">
            <label class="mdc-label" for="edit-strategie-marke">Marke</label>
            <select id="edit-strategie-marke" name="marke_id" class="mdc-select">
              <option value="">Wird geladen...</option>
            </select>
          </div>

          <div class="mdc-field">
            <label class="mdc-label" for="edit-strategie-kampagne">Kampagne <span class="required">*</span></label>
            <select id="edit-strategie-kampagne" name="kampagne_id" class="mdc-select" required>
              <option value="">Wird geladen...</option>
            </select>
          </div>

          <div class="mdc-form-actions">
            <button type="button" class="mdc-btn mdc-btn--cancel">Abbrechen</button>
            <button type="submit" class="mdc-btn mdc-btn--primary">Speichern</button>
          </div>
        </form>
      `;

      panel.appendChild(header);
      panel.appendChild(body);

      overlay.addEventListener('click', () => this.closeEditDrawer());
      header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeEditDrawer());

      document.body.appendChild(overlay);
      document.body.appendChild(panel);

      requestAnimationFrame(() => {
        panel.classList.add('show');
      });

      await this._populateEditSelects(strategie);
      this._bindEditSelectCascades(strategie);

      const form = panel.querySelector('#strategie-edit-form');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          await this.handleEditFormSubmit(strategie.id, form);
        };
        const cancelBtn = form.querySelector('.mdc-btn--cancel');
        if (cancelBtn) {
          cancelBtn.onclick = (e) => {
            e.preventDefault();
            this.closeEditDrawer();
          };
        }
      }

    } catch (error) {
      console.error('Fehler beim Öffnen des Edit-Drawers:', error);
      window.toastSystem?.show('Fehler beim Laden der Strategie', 'error');
    }
  }

  closeEditDrawer() {
    const overlay = document.getElementById('strategie-edit-drawer-overlay');
    const panel = document.getElementById('strategie-edit-drawer');

    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        overlay?.remove();
        panel?.remove();
      }, 300);
    } else {
      overlay?.remove();
    }
  }

  async _populateEditSelects(strategie) {
    const unternehmenSelect = document.getElementById('edit-strategie-unternehmen');
    const markeSelect = document.getElementById('edit-strategie-marke');
    const kampagneSelect = document.getElementById('edit-strategie-kampagne');

    const unternehmen = await strategieService.getAllUnternehmen();
    unternehmenSelect.innerHTML = '<option value="">-- Unternehmen wählen --</option>' +
      unternehmen.map(u => `<option value="${u.id}" ${u.id === strategie.unternehmen_id ? 'selected' : ''}>${this.sanitize(u.firmenname)}</option>`).join('');

    if (strategie.unternehmen_id) {
      const marken = await strategieService.getAllMarken(strategie.unternehmen_id);
      markeSelect.innerHTML = '<option value="">-- Keine Marke --</option>' +
        marken.map(m => `<option value="${m.id}" ${m.id === strategie.marke_id ? 'selected' : ''}>${this.sanitize(m.markenname)}</option>`).join('');

      const kampagneFilter = strategie.marke_id || null;
      let kampagnen;
      if (kampagneFilter) {
        kampagnen = await strategieService.getAllKampagnen(kampagneFilter);
      } else {
        const { data } = await window.supabase
          .from('kampagne')
          .select('id, kampagnenname')
          .eq('unternehmen_id', strategie.unternehmen_id)
          .order('kampagnenname');
        kampagnen = data || [];
      }
      kampagneSelect.innerHTML = '<option value="">-- Kampagne wählen --</option>' +
        kampagnen.map(k => `<option value="${k.id}" ${k.id === strategie.kampagne_id ? 'selected' : ''}>${this.sanitize(k.kampagnenname)}</option>`).join('');
    } else {
      markeSelect.innerHTML = '<option value="">-- Zuerst Unternehmen wählen --</option>';
      kampagneSelect.innerHTML = '<option value="">-- Zuerst Unternehmen wählen --</option>';
    }
  }

  _bindEditSelectCascades() {
    const unternehmenSelect = document.getElementById('edit-strategie-unternehmen');
    const markeSelect = document.getElementById('edit-strategie-marke');
    const kampagneSelect = document.getElementById('edit-strategie-kampagne');
    const nameInput = document.getElementById('edit-strategie-name');

    if (!unternehmenSelect || !markeSelect || !kampagneSelect) return;

    unternehmenSelect.addEventListener('change', async () => {
      const unternehmenId = unternehmenSelect.value;
      markeSelect.innerHTML = '<option value="">Wird geladen...</option>';
      kampagneSelect.innerHTML = '<option value="">-- Zuerst Unternehmen/Marke wählen --</option>';

      if (!unternehmenId) {
        markeSelect.innerHTML = '<option value="">-- Zuerst Unternehmen wählen --</option>';
        return;
      }

      const marken = await strategieService.getAllMarken(unternehmenId);
      markeSelect.innerHTML = '<option value="">-- Keine Marke --</option>' +
        marken.map(m => `<option value="${m.id}">${this.sanitize(m.markenname)}</option>`).join('');

      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname')
        .eq('unternehmen_id', unternehmenId)
        .order('kampagnenname');
      kampagneSelect.innerHTML = '<option value="">-- Kampagne wählen --</option>' +
        (kampagnen || []).map(k => `<option value="${k.id}">${this.sanitize(k.kampagnenname)}</option>`).join('');
    });

    markeSelect.addEventListener('change', async () => {
      const markeId = markeSelect.value;
      const unternehmenId = unternehmenSelect.value;
      kampagneSelect.innerHTML = '<option value="">Wird geladen...</option>';

      let kampagnen;
      if (markeId) {
        kampagnen = await strategieService.getAllKampagnen(markeId);
      } else if (unternehmenId) {
        const { data } = await window.supabase
          .from('kampagne')
          .select('id, kampagnenname')
          .eq('unternehmen_id', unternehmenId)
          .order('kampagnenname');
        kampagnen = data || [];
      } else {
        kampagnen = [];
      }

      kampagneSelect.innerHTML = '<option value="">-- Kampagne wählen --</option>' +
        kampagnen.map(k => `<option value="${k.id}">${this.sanitize(k.kampagnenname)}</option>`).join('');
    });

    kampagneSelect.addEventListener('change', async () => {
      const kampagneId = kampagneSelect.value;
      if (!kampagneId || !nameInput) return;
      const generatedName = await this.autoGeneration.autoGenerateStrategieName(
        kampagneId,
        markeSelect.value || null,
        unternehmenSelect.value || null
      );
      if (generatedName) {
        nameInput.value = generatedName;
      }
    });
  }

  async handleEditFormSubmit(strategieId, form) {
    const submitBtn = form.querySelector('.mdc-btn--primary');
    const originalText = submitBtn?.textContent;
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Speichern...';
      }

      const unternehmenId = form.querySelector('[name="unternehmen_id"]').value;
      const markeId = form.querySelector('[name="marke_id"]').value || null;
      const kampagneId = form.querySelector('[name="kampagne_id"]').value;

      if (!unternehmenId) {
        window.toastSystem?.show('Bitte wählen Sie ein Unternehmen aus', 'error');
        return;
      }
      if (!kampagneId) {
        window.toastSystem?.show('Bitte wählen Sie eine Kampagne aus', 'error');
        return;
      }

      const generatedName = await this.autoGeneration.autoGenerateStrategieName(
        kampagneId, markeId, unternehmenId
      );

      const updates = {
        unternehmen_id: unternehmenId,
        marke_id: markeId,
        kampagne_id: kampagneId
      };
      if (generatedName) {
        updates.name = generatedName;
      }

      await strategieService.updateStrategie(strategieId, updates);

      window.toastSystem?.show('Strategie erfolgreich aktualisiert', 'success');
      this.closeEditDrawer();
      this._forceReload = true;
      this.strategien = [];
      await this.loadAndRender();

    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      window.toastSystem?.show(`Fehler beim Aktualisieren: ${error.message}`, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  showCreateForm() {
    if (window.location.pathname !== '/strategie') {
      window.navigateTo('/strategie');
      setTimeout(() => this.openCreateDrawer(), 100);
    } else {
      this.openCreateDrawer();
    }
  }

  destroy() {
    this._boundEventListeners.forEach((cleanup) => cleanup());
    this._boundEventListeners.clear();
    this.closeCreateDrawer();
    this.closeEditDrawer();
    this.strategien = [];
    this.companyFolders = [];
    this.brandFolders = [];
    this.companyOnlyItems = [];
    this.currentItems = [];
    this.pagination.destroy();
  }
}

export const strategieList = new StrategieList();

