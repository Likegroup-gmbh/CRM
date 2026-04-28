// CreatorAuswahlList.js
// Hierarchische Sourcing-Ansicht: Unternehmen -> Marken -> Inhalte

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { AutoGeneration } from '../../core/form/logic/AutoGeneration.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';

export class CreatorAuswahlList {
  constructor() {
    this.listen = [];
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
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    if (isKunde) {
      const quickMenuContainer = document.getElementById('quick-menu-container');
      if (quickMenuContainer) {
        quickMenuContainer.style.display = 'none';
      }
    }

    this._forceReload = true;
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;

    const canView = window.currentUser?.rolle === 'admin' || window.currentUser?.permissions?.kampagne?.can_view;
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Sourcing anzuzeigen.</p>
        </div>
      `;
      return;
    }

    window.setHeadline('Sourcing');
    this.updateBreadcrumb();
    await this.loadAndRender();
  }

  async loadAndRender() {
    if (this.listen.length === 0 || this._forceReload) {
      this.listen = await creatorAuswahlService.getAllListen();
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
      this.pagination.init('pagination-container-creator-auswahl-items', {
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

  updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;
    if (this.viewMode === 'companies') {
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

  buildBrandFolders() {
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

  buildCurrentItems() {
    this.currentItems = this.listen.filter(
      (item) => item.unternehmen_id === this.currentUnternehmenId && item.marke_id === this.currentMarkeId
    );
  }

  renderCompaniesView() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.kampagne?.can_edit);

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
            ${canCreate ? `<button class="primary-btn" data-action="create-liste">Neue Creator-Auswahl</button>` : ''}
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
            <th>Sourcing-Listen</th>
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
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Keine Sourcing-Listen vorhanden.</p></div>`;
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
          <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Liste' : 'Listen'}</span>
        </div>
      </div>
    `).join('');
  }

  updateCompaniesTable() {
    const tbody = document.getElementById('companies-table-body');
    if (!tbody) return;

    if (this.companyFolders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="no-data">Keine Sourcing-Listen vorhanden.</td></tr>`;
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
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.kampagne?.can_edit);
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
            ${canCreate ? `<button class="primary-btn" data-action="create-liste">Neue Creator-Auswahl</button>` : ''}
          </div>
        </div>

        ${showBrandsSection ? `
          <div class="table-container">
            <h3 class="table-section-title">Sourcing-Listen mit Marke</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Marke</th>
                  <th>Sourcing-Listen</th>
                </tr>
              </thead>
              <tbody id="brands-table-body"></tbody>
            </table>
          </div>
        ` : ''}

        ${showCompanyOnlySection ? `
          <div class="table-container table-container--spaced">
            <h3 class="table-section-title">Sourcing-Listen ohne Marke (nur Unternehmen)</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kampagne</th>
                  <th>Creator</th>
                  <th>Erstellt von</th>
                  <th>Erstellt am</th>
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
      tbody.innerHTML = `<tr><td colspan="2" class="no-data">Keine markenbezogenen Sourcing-Listen vorhanden.</td></tr>`;
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
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return items.map((liste) => {
      const rolle = window.currentUser?.rolle?.toLowerCase();
      const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
      const kampagneName = KampagneUtils.getDisplayName(liste.kampagne);
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
          <td class="col-actions">
            <div class="actions-dropdown-container" data-entity-type="creator-auswahl">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
              <div class="actions-dropdown">
                <a href="#" class="action-item" data-action="view-liste" data-id="${liste.id}">
                  ${window.ActionsDropdown?.getHeroIcon('view') || ''}
                  Details anzeigen
                </a>
                ${!isKunde ? `
                  <a href="#" class="action-item" data-action="rename-liste" data-id="${liste.id}" data-name="${this.sanitize(liste.name || '')}">
                    ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                    Name bearbeiten
                  </a>
                  <a href="#" class="action-item" data-action="edit-liste" data-id="${liste.id}">
                    ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                    Bearbeiten
                  </a>
                  <div class="action-separator"></div>
                  <a href="#" class="action-item action-danger" data-action="delete-liste" data-id="${liste.id}">
                    ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                    Löschen
                  </a>
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
      tbody.innerHTML = `<tr><td colspan="6" class="no-data">Keine unternehmensweiten Einträge ohne Marke.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.renderItemsRows(this.companyOnlyItems);
  }

  renderItemsView() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.kampagne?.can_edit);
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
            ${canCreate ? `<button class="primary-btn" data-action="create-liste">Neue Creator-Auswahl</button>` : ''}
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
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="creator-auswahl-table-body">
              <tr><td colspan="6" class="table-state-cell">Lade Creator-Auswahl-Listen...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="pagination-container-creator-auswahl-items"></div>
      </div>
    `;
  }

  updateItemsTable() {
    const tbody = document.getElementById('creator-auswahl-table-body');
    if (!tbody) return;

    if (this.currentItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-state-cell">Keine Sourcing-Listen für diese Marke vorhanden.</td></tr>`;
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
    this.updateBreadcrumb();
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
      if (e.target.closest('[data-action="create-liste"]')) {
        e.preventDefault();
        this.openCreateDrawer();
        return;
      }

      const viewBtn = e.target.closest('[data-action="view-liste"]');
      if (viewBtn) {
        e.preventDefault();
        window.navigateTo(`/sourcing/${viewBtn.dataset.id}`);
        return;
      }

      const renameBtn = e.target.closest('[data-action="rename-liste"]');
      if (renameBtn) {
        e.preventDefault();
        this.openRenameDrawer(renameBtn.dataset.id, renameBtn.dataset.name);
        return;
      }

      const editBtn = e.target.closest('[data-action="edit-liste"]');
      if (editBtn) {
        e.preventDefault();
        window.navigateTo(`/sourcing/${editBtn.dataset.id}/edit`);
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete-liste"]');
      if (deleteBtn) {
        e.preventDefault();
        this.confirmDeleteListe(deleteBtn.dataset.id);
        return;
      }

      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'sourcing') {
        e.preventDefault();
        window.navigateTo(`/sourcing/${e.target.dataset.id}`);
        return;
      }

      const row = e.target.closest('.table-row-clickable');
      if (row && !e.target.closest('.actions-dropdown-container') && !e.target.closest('.table-link')) {
        const id = row.dataset.listeId;
        if (id) window.navigateTo(`/sourcing/${id}`);
      }
    });
    this._boundEventListeners.add(() => document.removeEventListener('click', this._globalClickHandler));
  }

  async confirmDeleteListe(id) {
    if (window.confirmationModal) {
      const result = await window.confirmationModal.open({
        title: 'Creator-Auswahl löschen',
        message: 'Möchten Sie diese Creator-Auswahl wirklich löschen? Alle zugeordneten Creator werden entfernt.',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (result?.confirmed) {
        await this.deleteListe(id);
      }
    } else if (confirm('Möchten Sie diese Creator-Auswahl wirklich löschen?')) {
      await this.deleteListe(id);
    }
  }

  async deleteListe(id) {
    try {
      await creatorAuswahlService.deleteListe(id);
      window.toastSystem?.show('Creator-Auswahl erfolgreich gelöscht', 'success');
      this._forceReload = true;
      this.listen = [];
      await this.loadAndRender();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen der Creator-Auswahl', 'error');
    }
  }

  openRenameDrawer(listeId, currentName) {
    this.closeRenameDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'sourcing-rename-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'sourcing-rename-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Name bearbeiten</span>
        <p class="drawer-subtitle">Ändern Sie den Namen dieser Sourcing-Liste</p>
      </div>
      <div>
        <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="sourcing-rename-form">
        <div class="form-group">
          <label class="form-label" for="rename-liste-name">Name</label>
          <input type="text" id="rename-liste-name" class="form-input" value="${currentName}" required>
        </div>
        <div class="drawer-footer" style="margin-top: var(--space-lg, 24px);">
          <button type="submit" class="primary-btn">Speichern</button>
          <button type="button" class="secondary-btn rename-cancel-btn">Abbrechen</button>
        </div>
      </form>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeRenameDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeRenameDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });

    const form = panel.querySelector('#sourcing-rename-form');
    const input = panel.querySelector('#rename-liste-name');
    input.focus();
    input.select();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const newName = input.value.trim();
      if (!newName) {
        window.toastSystem?.show('Name darf nicht leer sein', 'warning');
        return;
      }
      await this.handleRenameSubmit(listeId, newName);
    };

    body.querySelector('.rename-cancel-btn').addEventListener('click', () => this.closeRenameDrawer());
  }

  closeRenameDrawer() {
    const overlay = document.getElementById('sourcing-rename-drawer-overlay');
    const panel = document.getElementById('sourcing-rename-drawer');

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

  async handleRenameSubmit(listeId, newName) {
    try {
      await creatorAuswahlService.updateListe(listeId, { name: newName });

      const liste = this.listen.find(l => l.id === listeId);
      if (liste) liste.name = newName;

      window.toastSystem?.show('Name erfolgreich geändert', 'success');
      this.closeRenameDrawer();
      this.loadAndRender();
    } catch (error) {
      console.error('Fehler beim Umbenennen:', error);
      window.toastSystem?.show('Fehler beim Umbenennen der Liste', 'error');
    }
  }

  openCreateDrawer() {
    this.closeCreateDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'sourcing-create-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'sourcing-create-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Neue Creator-Auswahl</span>
        <p class="drawer-subtitle">Erstellen Sie eine neue Sourcing-Liste für eine Kampagne</p>
      </div>
      <div>
        <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = window.formSystem.renderFormOnly('sourcing');

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeCreateDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeCreateDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });

    window.formSystem.bindFormEvents('sourcing', null);

    const form = panel.querySelector('#sourcing-form');
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
    const overlay = document.getElementById('sourcing-create-drawer-overlay');
    const panel = document.getElementById('sourcing-create-drawer');

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
        const generatedName = await this.autoGeneration.autoGenerateSourcingName(
          submitData.kampagne_id,
          submitData.marke_id,
          submitData.unternehmen_id
        );
        if (generatedName) submitData.name = generatedName;
      }

      const newListe = await creatorAuswahlService.createListe(submitData);
      if (newListe?.id) {
        window.toastSystem?.show('Creator-Auswahl erfolgreich erstellt', 'success');
        this.closeCreateDrawer();
        window.navigateTo(`/sourcing/${newListe.id}`);
      } else {
        throw new Error('Keine ID zurückgegeben');
      }
    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error);
      window.toastSystem?.show(`Fehler beim Erstellen: ${error.message}`, 'error');
    }
  }

  showCreateForm() {
    if (window.location.pathname !== '/sourcing') {
      window.navigateTo('/sourcing');
      setTimeout(() => this.openCreateDrawer(), 100);
    } else {
      this.openCreateDrawer();
    }
  }

  destroy() {
    this._boundEventListeners.forEach((cleanup) => cleanup());
    this._boundEventListeners.clear();
    this.closeCreateDrawer();
    this.closeRenameDrawer();
    this.listen = [];
    this.companyFolders = [];
    this.brandFolders = [];
    this.companyOnlyItems = [];
    this.currentItems = [];
    this.pagination.destroy();
  }
}

export const creatorAuswahlList = new CreatorAuswahlList();

