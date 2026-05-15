// StrategieList.js
// Fassade: Hierarchische Strategie-Ansicht (Unternehmen -> Marken -> Inhalte)

import { strategieService } from './StrategieService.js';
import { AutoGeneration } from '../../core/form/logic/AutoGeneration.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import {
  renderCompaniesView, updateCompaniesGrid, updateCompaniesTable,
  renderBrandsView, updateBrandsTable, updateCompanyOnlyTable,
  renderItemsView, updateItemsTable as _updateItemsTable
} from './StrategieListRenderer.js';
import { bindEvents as _bindEvents } from './StrategieListEvents.js';
import {
  showHowToModal as _showHowToModal,
  confirmDeleteStrategie as _confirmDeleteStrategie,
  openCreateDrawer as _openCreateDrawer, closeCreateDrawer as _closeCreateDrawer,
  openEditDrawer as _openEditDrawer, closeEditDrawer as _closeEditDrawer
} from './StrategieListCrud.js';

export class StrategieList {
  constructor() {
    this.strategien = [];
    this.autoGeneration = new AutoGeneration();
    this.pagination = new PaginationSystem();
    this._boundEventListeners = new Set();

    this.viewMode = 'companies';
    this.listViewMode = 'grid';

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

    const params = new URLSearchParams(window.location.search);
    const qUnternehmenId = params.get('unternehmen');
    const qUnternehmenName = params.get('unternehmen_name');
    const qMarkeId = params.get('marke');
    const qMarkeName = params.get('marke_name');

    if (qUnternehmenId) {
      this.currentUnternehmenId = qUnternehmenId;
      this.currentUnternehmenName = decodeURIComponent(qUnternehmenName || 'Unternehmen');
      if (qMarkeId) {
        this.viewMode = 'items';
        this.currentMarkeId = qMarkeId;
        this.currentMarkeName = decodeURIComponent(qMarkeName || 'Marke');
      } else {
        this.viewMode = 'brands';
        this.currentMarkeId = null;
        this.currentMarkeName = null;
      }
    } else {
      this.viewMode = 'companies';
      this.currentUnternehmenId = null;
      this.currentUnternehmenName = null;
      this.currentMarkeId = null;
      this.currentMarkeName = null;
    }

    const canView = window.isAdmin() || window.currentUser?.permissions?.strategie?.can_view;
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

    if (this.viewMode === 'companies') return;

    if (this.viewMode === 'brands') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Strategien', url: '/strategie', clickable: true },
        { label: this.currentUnternehmenName || 'Unternehmen', url: '#', clickable: false }
      ]);
      return;
    }

    const uName = encodeURIComponent(this.currentUnternehmenName || '');
    const uId = this.currentUnternehmenId;
    window.breadcrumbSystem.updateBreadcrumb([
      { label: 'Strategien', url: '/strategie', clickable: true },
      { label: this.currentUnternehmenName || 'Unternehmen', url: `/strategie?unternehmen=${uId}&unternehmen_name=${uName}`, clickable: true },
      { label: this.currentMarkeName || 'Marke', url: '#', clickable: false }
    ]);
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

  // --- Delegations-Methoden (Renderer) ---
  render() {
    this.updateBreadcrumbDisplay();
    let html = '';
    if (this.viewMode === 'companies') {
      html = renderCompaniesView(this);
    } else if (this.viewMode === 'brands') {
      html = renderBrandsView(this);
    } else {
      html = renderItemsView(this);
    }

    window.setContentSafely(window.content, html);

    if (this.viewMode === 'companies') {
      if (this.listViewMode === 'grid') {
        updateCompaniesGrid(this);
      } else {
        updateCompaniesTable(this);
      }
    } else if (this.viewMode === 'brands') {
      updateBrandsTable(this);
      updateCompanyOnlyTable(this);
      if (window.ActionsDropdown) {
        window.ActionsDropdown.init();
      }
    }
  }

  updateItemsTable() { _updateItemsTable(this); }

  // --- Delegations-Methoden (Events) ---
  bindEvents() { _bindEvents(this); }

  // --- Delegations-Methoden (CRUD) ---
  showHowToModal() { _showHowToModal(); }
  confirmDeleteStrategie(id) { return _confirmDeleteStrategie(this, id); }
  openCreateDrawer() { _openCreateDrawer(this); }
  closeCreateDrawer() { _closeCreateDrawer(); }
  openEditDrawer(id) { return _openEditDrawer(this, id); }
  closeEditDrawer() { _closeEditDrawer(); }

  // --- Navigation ---
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
