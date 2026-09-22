// CreatorAuswahlList.js
// Hierarchische Casting-Ansicht: Unternehmen, Marken, Listen.
// Rendern und Drawer liegen als Prototype-Mixins daneben.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { AutoGeneration } from '../../core/form/logic/AutoGeneration.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { creatorAuswahlListViewsMethods } from './CreatorAuswahlListViews.js';
import { creatorAuswahlListDrawersMethods } from './CreatorAuswahlListDrawers.js';

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
    const isKunde = window.isKunde();
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

    const canView = window.isAdmin() || window.currentUser?.permissions?.kampagne?.can_view;
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Castings anzuzeigen.</p>
        </div>
      `;
      return;
    }

    window.setHeadline('Castings');
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
        window.navigateTo(`/castings/${viewBtn.dataset.id}`);
        return;
      }

      const renameBtn = e.target.closest('[data-action="rename-liste"]');
      if (renameBtn) {
        e.preventDefault();
        if (!window.canEdit?.('sourcing')) return;
        this.openRenameDrawer(renameBtn.dataset.id, renameBtn.dataset.name);
        return;
      }

      const editBtn = e.target.closest('[data-action="edit-liste"]');
      if (editBtn) {
        e.preventDefault();
        if (!window.canEdit?.('sourcing')) return;
        window.navigateTo(`/castings/${editBtn.dataset.id}/edit`);
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete-liste"]');
      if (deleteBtn) {
        e.preventDefault();
        if (!window.canDelete?.('sourcing')) return;
        this.confirmDeleteListe(deleteBtn.dataset.id);
        return;
      }

      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'sourcing') {
        e.preventDefault();
        window.navigateTo(`/castings/${e.target.dataset.id}`);
        return;
      }

      const row = e.target.closest('.table-row-clickable');
      if (row && !e.target.closest('.actions-dropdown-container') && !e.target.closest('.table-link')) {
        const id = row.dataset.listeId;
        if (id) window.navigateTo(`/castings/${id}`);
      }
    });
    this._boundEventListeners.add(() => document.removeEventListener('click', this._globalClickHandler));
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

Object.assign(
  CreatorAuswahlList.prototype,
  creatorAuswahlListViewsMethods,
  creatorAuswahlListDrawersMethods
);

export const creatorAuswahlList = new CreatorAuswahlList();
