// SkriptList.js
// Hierarchische Skripte-Ansicht: Unternehmen → Marke → Kampagne → Items

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { skripteService } from './SkripteService.js';
import {
  renderCompaniesView, updateCompaniesGrid, updateCompaniesTable,
  renderBrandsView, updateBrandsGrid, updateBrandsTable,
  renderCampaignsView, updateCampaignsGrid, updateCampaignsTable, updateCampaignlessTable,
  renderItemsView, updateItemsTable as _updateItemsTable, initializeItemsFilterBar
} from './SkriptListRenderer.js';
import { bindEvents as _bindEvents } from './SkriptListEvents.js';
import { OHNE_QUERY, OHNE_MARKE_LABEL, OHNE_KAMPAGNE_LABEL } from './SkripteUtils.js';

export { OHNE_QUERY, OHNE_MARKE_LABEL, OHNE_KAMPAGNE_LABEL };

export function matchesMarke(item, markeId) {
  if (markeId == null) return !item.marke_id;
  return item.marke_id === markeId;
}

export function matchesKampagne(item, kampagneId) {
  if (kampagneId == null) return !item.kampagne_id;
  return item.kampagne_id === kampagneId;
}

export function scopedByUnternehmen(items, unternehmenId) {
  return items.filter((item) => item.unternehmen_id === unternehmenId);
}

export class SkriptList {
  constructor() {
    this.skripte = [];
    this.pagination = new PaginationSystem();
    this._boundEventListeners = new Set();
    this._forceReload = true;

    this.viewMode = 'companies';
    this.listViewMode = 'grid';

    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;

    this.companyFolders = [];
    this.brandFolders = [];
    this.campaignFolders = [];
    this.unbrandedItems = [];
    this.campaignlessItems = [];
    this.currentItems = [];
  }

  async init() {
    this._forceReload = true;
    this.applyQueryParams(new URLSearchParams(window.location.search));
    window.setHeadline('Skripte');
    this.updateBreadcrumbDisplay();
    await this.loadAndRender();
  }

  applyQueryParams(params) {
    const qUnternehmenId = params.get('unternehmen');
    const qUnternehmenName = params.get('unternehmen_name');
    const qMarke = params.get('marke');
    const qMarkeName = params.get('marke_name');
    const qKampagne = params.get('kampagne');
    const qKampagneName = params.get('kampagne_name');

    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this.viewMode = 'companies';

    if (!qUnternehmenId) return;

    this.currentUnternehmenId = qUnternehmenId;
    this.currentUnternehmenName = decodeURIComponent(qUnternehmenName || 'Unternehmen');

    if (qMarke === OHNE_QUERY) {
      this.currentMarkeId = null;
      this.currentMarkeName = OHNE_MARKE_LABEL;
    } else if (qMarke) {
      this.currentMarkeId = qMarke;
      this.currentMarkeName = decodeURIComponent(qMarkeName || 'Marke');
    }

    if (qKampagne === OHNE_QUERY) {
      this.viewMode = 'items';
      this.currentKampagneId = null;
      this.currentKampagneName = OHNE_KAMPAGNE_LABEL;
      if (qMarke == null) this.currentMarkeName = this.currentMarkeName || OHNE_MARKE_LABEL;
      return;
    }

    if (qKampagne) {
      this.viewMode = 'items';
      this.currentKampagneId = qKampagne;
      this.currentKampagneName = decodeURIComponent(qKampagneName || 'Kampagne');
      if (qMarke == null) this.currentMarkeName = this.currentMarkeName || OHNE_MARKE_LABEL;
      return;
    }

    if (qMarke != null) {
      this.viewMode = 'campaigns';
      return;
    }

    this.viewMode = 'brands';
  }

  listUrl(viewMode = this.viewMode) {
    if (viewMode === 'companies' || !this.currentUnternehmenId) return '/skripte';

    const params = new URLSearchParams();
    params.set('unternehmen', this.currentUnternehmenId);
    params.set('unternehmen_name', this.currentUnternehmenName || '');

    if (viewMode === 'brands') return `/skripte?${params}`;

    if (this.currentMarkeId) {
      params.set('marke', this.currentMarkeId);
      params.set('marke_name', this.currentMarkeName || '');
    } else {
      params.set('marke', OHNE_QUERY);
      params.set('marke_name', OHNE_MARKE_LABEL);
    }

    if (viewMode === 'campaigns') return `/skripte?${params}`;

    if (this.currentKampagneId) {
      params.set('kampagne', this.currentKampagneId);
      params.set('kampagne_name', this.currentKampagneName || '');
    } else {
      params.set('kampagne', OHNE_QUERY);
      params.set('kampagne_name', OHNE_KAMPAGNE_LABEL);
    }
    return `/skripte?${params}`;
  }

  syncListUrl() {
    const url = this.listUrl();
    window.history.replaceState({ route: url }, '', url);
  }

  async loadAndRender() {
    try {
      if (this.skripte.length === 0 || this._forceReload) {
        this.skripte = await this.loadSkripte();
        this._forceReload = false;
      }

      if (this.viewMode === 'companies') this.buildCompanyFolders();
      else if (this.viewMode === 'brands') this.buildBrandFolders();
      else if (this.viewMode === 'campaigns') this.buildCampaignFolders();
      else this.buildCurrentItems();

      this.render();
      this.bindEvents();

      if (this.viewMode === 'items') {
        this.pagination.init('pagination-container-skripte-items', {
          itemsPerPage: 25,
          onPageChange: () => this.updateItemsTable(),
          onItemsPerPageChange: () => this.updateItemsTable()
        });
        this.pagination.currentPage = this.pagination.currentPage || 1;
        this.updateItemsTable();
        await initializeItemsFilterBar(this);
      }
    } catch (error) {
      window.ErrorHandler?.handle(error, 'SkriptList.loadAndRender');
    }
  }

  async loadSkripte() {
    return skripteService.loadSkripte();
  }

  sanitize(value) {
    return window.validatorSystem?.sanitizeHtml(value) || value || '';
  }

  buildCompanyFolders() {
    const map = new Map();
    this.skripte.forEach((item) => {
      if (!item.unternehmen_id) return;
      const key = item.unternehmen_id;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          firmenname: item.unternehmen?.firmenname,
          logo_url: item.unternehmen?.logo_url,
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
    const scoped = scopedByUnternehmen(this.skripte, this.currentUnternehmenId);
    this.unbrandedItems = scoped.filter((item) => !item.marke_id);

    const brandMap = new Map();
    scoped.forEach((item) => {
      if (!item.marke_id) return;
      const key = item.marke_id;
      if (!brandMap.has(key)) {
        brandMap.set(key, {
          id: key,
          markenname: item.marke?.markenname,
          logo_url: item.marke?.logo_url,
          count: 0,
          virtual: false
        });
      }
      brandMap.get(key).count += 1;
    });

    this.brandFolders = Array.from(brandMap.values()).sort((a, b) =>
      (a.markenname || '').localeCompare(b.markenname || '', 'de')
    );

    if (this.unbrandedItems.length) {
      this.brandFolders.push({
        id: null,
        markenname: OHNE_MARKE_LABEL,
        logo_url: null,
        count: this.unbrandedItems.length,
        virtual: true
      });
    }
  }

  buildCampaignFolders() {
    const scoped = scopedByUnternehmen(this.skripte, this.currentUnternehmenId)
      .filter((item) => matchesMarke(item, this.currentMarkeId));

    this.campaignlessItems = scoped.filter((item) => !item.kampagne_id);

    const campaignMap = new Map();
    scoped.forEach((item) => {
      if (!item.kampagne_id) return;
      const key = item.kampagne_id;
      if (!campaignMap.has(key)) {
        campaignMap.set(key, {
          id: key,
          name: KampagneUtils.getDisplayName(item.kampagne),
          count: 0
        });
      }
      campaignMap.get(key).count += 1;
    });

    this.campaignFolders = Array.from(campaignMap.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'de')
    );
  }

  applyStatusFilter(items) {
    const status = filterSystem.getFilters('skripte')?.status;
    if (!status) return items;
    return items.filter((item) => item.status === status);
  }

  hasActiveFilters() {
    return Object.keys(filterSystem.getFilters('skripte')).length > 0;
  }

  buildCurrentItems() {
    const scoped = scopedByUnternehmen(this.skripte, this.currentUnternehmenId)
      .filter((item) => matchesMarke(item, this.currentMarkeId))
      .filter((item) => matchesKampagne(item, this.currentKampagneId));
    this.currentItems = this.applyStatusFilter(scoped);
  }

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;
    if (this.viewMode === 'companies') return;

    const crumbs = [
      { label: 'Skripte', url: '/skripte', clickable: true }
    ];

    if (this.viewMode === 'brands') {
      crumbs.push({ label: this.currentUnternehmenName || 'Unternehmen', url: '#', clickable: false });
      window.breadcrumbSystem.updateBreadcrumb(crumbs);
      return;
    }

    crumbs.push({
      label: this.currentUnternehmenName || 'Unternehmen',
      url: this.listUrl('brands'),
      clickable: true
    });

    if (this.viewMode === 'campaigns') {
      crumbs.push({ label: this.currentMarkeName || OHNE_MARKE_LABEL, url: '#', clickable: false });
      window.breadcrumbSystem.updateBreadcrumb(crumbs);
      return;
    }

    crumbs.push({
      label: this.currentMarkeName || OHNE_MARKE_LABEL,
      url: this.listUrl('campaigns'),
      clickable: true
    });
    crumbs.push({
      label: this.currentKampagneName || OHNE_KAMPAGNE_LABEL,
      url: '#',
      clickable: false
    });
    window.breadcrumbSystem.updateBreadcrumb(crumbs);
  }

  render() {
    this.updateBreadcrumbDisplay();
    this.syncListUrl();

    let html = '';
    if (this.viewMode === 'companies') html = renderCompaniesView(this);
    else if (this.viewMode === 'brands') html = renderBrandsView(this);
    else if (this.viewMode === 'campaigns') html = renderCampaignsView(this);
    else html = renderItemsView(this);

    window.setContentSafely(window.content, html);

    if (this.viewMode === 'companies') {
      if (this.listViewMode === 'grid') updateCompaniesGrid(this);
      else updateCompaniesTable(this);
    } else if (this.viewMode === 'brands') {
      if (this.listViewMode === 'grid') updateBrandsGrid(this);
      else updateBrandsTable(this);
    } else if (this.viewMode === 'campaigns') {
      if (this.listViewMode === 'grid') updateCampaignsGrid(this);
      else updateCampaignsTable(this);
      updateCampaignlessTable(this);
      window.ActionsDropdown?.init();
    } else {
      window.ActionsDropdown?.init();
    }
  }

  updateItemsTable() { _updateItemsTable(this); }
  bindEvents() { _bindEvents(this); }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('skripte', filters);
    this.buildCurrentItems();
    this.updateItemsTable();
  }

  onFiltersReset() {
    filterSystem.resetFilters('skripte');
    this.buildCurrentItems();
    this.updateItemsTable();
  }

  switchToCompaniesView() {
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this.loadAndRender();
  }

  switchToBrandsView(unternehmenId, unternehmenName) {
    this.viewMode = 'brands';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this.loadAndRender();
  }

  switchToCampaignsView(markeId, markeName) {
    this.viewMode = 'campaigns';
    this.currentMarkeId = markeId || null;
    this.currentMarkeName = markeName || (markeId ? 'Marke' : OHNE_MARKE_LABEL);
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this.loadAndRender();
  }

  switchToItemsView(kampagneId, kampagneName) {
    this.viewMode = 'items';
    this.currentKampagneId = kampagneId || null;
    this.currentKampagneName = kampagneName || (kampagneId ? 'Kampagne' : OHNE_KAMPAGNE_LABEL);
    this.pagination.currentPage = 1;
    this.loadAndRender();
  }

  destroy() {
    this._boundEventListeners.forEach((cleanup) => cleanup());
    this._boundEventListeners.clear();
    this.pagination.destroy();
    this.skripte = [];
    this.companyFolders = [];
    this.brandFolders = [];
    this.campaignFolders = [];
    this.unbrandedItems = [];
    this.campaignlessItems = [];
    this.currentItems = [];
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this._forceReload = true;
  }
}
