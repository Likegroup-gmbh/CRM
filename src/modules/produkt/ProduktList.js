// ProduktList.js
// Grid: Unternehmen → Marken → Produkte. Liste: bisherige flache Tabelle.

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { ProduktFilterLogic } from './filters/ProduktFilterLogic.js';
import {
  ProduktService,
  produktFormRoute
} from './ProduktService.js';
import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  NUR_UNTERNEHMEN_LABEL,
  OHNE_QUERY
} from './ProduktFolders.js';
import {
  renderCompaniesView, updateCompaniesGrid,
  renderBrandsView, updateBrandsGrid,
  renderItemsView, updateItemsTable as _updateItemsTable
} from './ProduktFolderRenderer.js';

const PRODUKT_LIST_SELECT = `
  *,
  unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
  marken:produkt_marke(marke_id, marke:marke_id(id, markenname, logo_url)),
  varianten:produkt_variante(id),
  bilder:produkt_bilder(id, storage_pfad, position, ist_hauptbild, variante_id)
`;

export class ProduktList extends BasePaginatedList {
  constructor() {
    super('produkt', {
      itemsPerPage: 25,
      headline: 'Produkte Übersicht',
      breadcrumbLabel: 'Produkt',
      sortField: 'name',
      sortAscending: true,
      paginationContainerId: 'pagination-produkt',
      tbodySelector: '.data-table tbody',
      tableColspan: 9,
      checkboxClass: 'produkt-check',
      selectAllId: 'select-all-produkte'
    });

    this._lastScope = null;
    this._allProdukte = null;

    this.viewMode = 'companies';
    this.listViewMode = 'grid';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;

    this.companyFolders = [];
    this.brandFolders = [];
    this.currentItems = [];
  }

  getEmptyState() {
    const canEdit = this.canEdit;
    return {
      icon: 'cube',
      title: 'Keine Produkte vorhanden',
      text: canEdit
        ? 'Legen Sie Ihr erstes Produkt an, um loszulegen.'
        : 'Es sind noch keine Produkte für Sie freigegeben.',
      actionsHtml: canEdit ? '<button id="btn-produkt-new" class="mdc-btn">Produkt anlegen</button>' : ''
    };
  }

  resetEntityCaches() {
    this._lastScope = null;
    this._allProdukte = null;
  }

  applyQueryParams(params) {
    const qUnternehmenId = params.get('unternehmen');
    const qUnternehmenName = params.get('unternehmen_name');
    const qMarke = params.get('marke');
    const qMarkeName = params.get('marke_name');

    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.viewMode = 'companies';

    if (!qUnternehmenId) return;

    this.currentUnternehmenId = qUnternehmenId;
    this.currentUnternehmenName = decodeURIComponent(qUnternehmenName || 'Unternehmen');

    if (qMarke === OHNE_QUERY) {
      this.viewMode = 'items';
      this._ohneMarke = true;
      this.currentMarkeName = decodeURIComponent(qMarkeName || NUR_UNTERNEHMEN_LABEL);
      return;
    }

    if (qMarke) {
      this.viewMode = 'items';
      this.currentMarkeId = qMarke;
      this.currentMarkeName = decodeURIComponent(qMarkeName || 'Marke');
      return;
    }

    this.viewMode = 'brands';
  }

  listUrl(viewMode = this.viewMode) {
    if (viewMode === 'companies' || !this.currentUnternehmenId) return '/produkt';

    const params = new URLSearchParams();
    params.set('unternehmen', this.currentUnternehmenId);
    params.set('unternehmen_name', this.currentUnternehmenName || '');

    if (viewMode === 'brands') return `/produkt?${params}`;

    if (this._ohneMarke) {
      params.set('marke', OHNE_QUERY);
      params.set('marke_name', this.currentMarkeName || NUR_UNTERNEHMEN_LABEL);
    } else if (this.currentMarkeId) {
      params.set('marke', this.currentMarkeId);
      params.set('marke_name', this.currentMarkeName || '');
    }
    return `/produkt?${params}`;
  }

  syncListUrl() {
    const url = this.listViewMode === 'list' ? '/produkt' : this.listUrl();
    window.history.replaceState({ route: url }, '', url);
  }

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;

    if (this.listViewMode === 'list' || this.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Produkte', url: '/produkt', clickable: false }
      ]);
      return;
    }

    const crumbs = [
      { label: 'Produkte', url: '/produkt', clickable: true }
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
    crumbs.push({
      label: this.currentMarkeName || NUR_UNTERNEHMEN_LABEL,
      url: '#',
      clickable: false
    });
    window.breadcrumbSystem.updateBreadcrumb(crumbs);
  }

  async init() {
    this.applyQueryParams(new URLSearchParams(window.location.search));

    if (window.setHeadline) {
      window.setHeadline(this.options.headline);
    }

    const canView = await this.checkViewPermission();
    if (!canView) {
      this.renderNoPermission();
      return;
    }

    const additionalPermissions = await this.checkAdditionalPermissions();
    if (!additionalPermissions) return;

    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList(this.entityType, this);
    }

    await this.loadAndRender();
  }

  async loadAndRender() {
    if (this.listViewMode === 'list') {
      this.viewMode = 'companies';
      this._shellRendered = false;
      await this.renderShell();
      this.initializePagination();
      this.bindEvents();
      this.updateBreadcrumbDisplay();
      this.syncListUrl();
      await this.loadData();
      return;
    }

    this._shellRendered = false;
    await this.ensureAllProdukte();
    this.buildCurrentFolders();
    this.renderFolderView();
    this.bindEvents();

    if (this.viewMode === 'items') {
      this.pagination.init('pagination-produkt-items', {
        itemsPerPage: 25,
        onPageChange: () => this.updateItemsTable(),
        onItemsPerPageChange: () => this.updateItemsTable()
      });
      this.pagination.currentPage = this.pagination.currentPage || 1;
      this.updateItemsTable();
    }
  }

  async loadData() {
    if (this.listViewMode === 'grid') {
      this._allProdukte = null;
      await this.ensureAllProdukte();
      this.buildCurrentFolders();
      this.renderFolderView();
      if (this.viewMode === 'items') {
        this.pagination.init('pagination-produkt-items', {
          itemsPerPage: 25,
          onPageChange: () => this.updateItemsTable(),
          onItemsPerPageChange: () => this.updateItemsTable()
        });
        this.updateItemsTable();
      }
      return;
    }
    return super.loadData();
  }

  async ensureAllProdukte() {
    if (this._allProdukte) return this._allProdukte;
    this._allProdukte = await this.loadAllProdukte();
    return this._allProdukte;
  }

  async resolveAllowedProduktIds() {
    const isKunde = window.isKunde?.();
    if (this.isAdmin || isKunde) return null;

    const scope = await ProduktService.getAllowedProduktScopeForUser(window.currentUser?.id);
    this._lastScope = scope;
    if (scope.all) return null;
    return scope.produktIds || [];
  }

  async loadAllProdukte() {
    if (!window.supabase) return [];

    const allowedIds = await this.resolveAllowedProduktIds();
    if (allowedIds && allowedIds.length === 0) return [];

    let query = window.supabase
      .from('produkt')
      .select(PRODUKT_LIST_SELECT)
      .order('name', { ascending: true });

    if (allowedIds) query = query.in('id', allowedIds);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  buildCurrentFolders() {
    const produkte = this._allProdukte || [];
    if (this.viewMode === 'companies') {
      this.companyFolders = buildCompanyFolders(produkte);
      return;
    }
    if (this.viewMode === 'brands') {
      this.brandFolders = buildBrandFolders(produkte, this.currentUnternehmenId);
      return;
    }
    this.currentItems = buildCurrentItems(produkte, {
      unternehmenId: this.currentUnternehmenId,
      markeId: this.currentMarkeId,
      ohneMarke: this._ohneMarke
    });
  }

  renderFolderView() {
    this.updateBreadcrumbDisplay();
    this.syncListUrl();

    let html = '';
    if (this.viewMode === 'companies') html = renderCompaniesView(this);
    else if (this.viewMode === 'brands') html = renderBrandsView(this);
    else html = renderItemsView(this);

    window.setContentSafely(window.content, html);

    if (this.viewMode === 'companies') updateCompaniesGrid(this);
    else if (this.viewMode === 'brands') updateBrandsGrid(this);
  }

  updateItemsTable() { _updateItemsTable(this); }

  switchToCompaniesView() {
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.loadAndRender();
  }

  switchToBrandsView(unternehmenId, unternehmenName) {
    this.viewMode = 'brands';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.loadAndRender();
  }

  switchToItemsView(markeId, markeName, { ohneMarke = false } = {}) {
    this.viewMode = 'items';
    this.currentMarkeId = ohneMarke ? null : markeId;
    this.currentMarkeName = markeName;
    this._ohneMarke = ohneMarke;
    this.pagination.currentPage = 1;
    this.loadAndRender();
  }

  setListViewMode(mode) {
    if (this.listViewMode === mode && (mode === 'list' || this.viewMode === 'companies')) return;
    this.listViewMode = mode;
    this.viewMode = 'companies';
    this.pagination.currentPage = 1;
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this._shellRendered = false;
    this.loadAndRender();
  }

  async loadPageData(page, limit, filters) {
    try {
      if (!window.supabase) return { data: [], total: 0 };

      const allowedIds = await this.resolveAllowedProduktIds();
      if (allowedIds && allowedIds.length === 0) return { data: [], total: 0 };

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = window.supabase
        .from('produkt')
        .select(PRODUKT_LIST_SELECT, { count: 'exact' })
        .order(this.currentSort.field, { ascending: this.currentSort.ascending });

      if (allowedIds) {
        query = query.in('id', allowedIds);
      }

      if (filters.marke_id) {
        const { data: markenTreffer } = await window.supabase
          .from('produkt_marke')
          .select('produkt_id')
          .eq('marke_id', filters.marke_id);
        const markeProduktIds = (markenTreffer || []).map(r => r.produkt_id).filter(Boolean);
        if (!markeProduktIds.length) return { data: [], total: 0 };
        query = query.in('id', markeProduktIds);
      }

      const filtersForQuery = { ...filters };
      delete filtersForQuery.marke_id;
      delete filtersForQuery._sortBy;
      delete filtersForQuery._sortOrder;
      delete filtersForQuery._search;

      if (filtersForQuery.name) {
        const search = filtersForQuery.name;
        const { data: matchU } = await window.supabase
          .from('unternehmen')
          .select('id')
          .ilike('firmenname', `%${search}%`);
        const orParts = [
          `name.ilike.%${search}%`,
          `url.ilike.%${search}%`,
          `kurzbeschreibung.ilike.%${search}%`
        ];
        if (matchU?.length) {
          orParts.push(`unternehmen_id.in.(${matchU.map(u => u.id).join(',')})`);
        }
        query = query.or(orParts.join(','));
        delete filtersForQuery.name;
      }

      query = ProduktFilterLogic.buildSupabaseQuery(query, filtersForQuery);
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { data: data || [], total: count || 0 };
    } catch (error) {
      console.error('❌ Fehler beim Laden der Produkte:', error);
      throw error;
    }
  }

  renderSingleRow(produkt, options = {}) {
    const showCheckbox = options.checkbox !== false && this.canBulkDelete;
    const sanitize = this.sanitize.bind(this);
    const thumb = this.renderThumb(produkt);
    const marken = this.renderMarken(produkt);
    const variantenAnzahl = (produkt.varianten || []).length;

    return `
      <tr data-id="${produkt.id}" data-unternehmen-id="${produkt.unternehmen_id || ''}">
        ${showCheckbox ? `<td class="col-checkbox"><input type="checkbox" class="produkt-check" data-id="${produkt.id}"></td>` : ''}
        <td class="col-thumb">${thumb}</td>
        <td class="col-name col-name-with-icon">
          <a href="#" class="table-link produkt-row-open" data-produkt-id="${produkt.id}" data-unternehmen-id="${produkt.unternehmen_id || ''}">
            ${sanitize(produkt.name || '')}
          </a>
        </td>
        <td>${this.renderUnternehmen(produkt.unternehmen)}</td>
        <td>${marken}</td>
        <td>${sanitize(ProduktService.preisLabel(produkt))}</td>
        <td>${variantenAnzahl > 0 ? variantenAnzahl : '-'}</td>
        <td>${this._formatDate(produkt.created_at)}</td>
        <td class="col-actions">
          ${actionBuilder.create('produkt', produkt.id)}
        </td>
      </tr>
    `;
  }

  renderThumb(produkt) {
    const bild = ProduktService.hauptbild(produkt);
    const url = bild ? ProduktService.publicUrl(bild.storage_pfad) : null;
    if (!url) {
      return `<span class="table-avatar">${(produkt.name || '?')[0].toUpperCase()}</span>`;
    }
    return `<img src="${this.sanitize(url)}" class="table-logo" width="24" height="24" alt="" loading="lazy">`;
  }

  renderMarken(produkt) {
    const namen = ProduktService.markenNamen(produkt);
    if (!namen.length) return `<span class="text-muted">${NUR_UNTERNEHMEN_LABEL}</span>`;
    return namen.map(name => `<span class="status-badge">${this.sanitize(name)}</span>`).join(' ');
  }

  renderUnternehmen(unternehmen) {
    if (!unternehmen || !unternehmen.firmenname) return '-';
    return avatarBubbles.renderBubbles([{
      name: unternehmen.firmenname,
      label: unternehmen.internes_kuerzel || unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen',
      logo_url: unternehmen.logo_url || null
    }], { showLabel: true });
  }

  _formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  renderShellContent() {
    const canBulkDelete = this.canBulkDelete;
    const canEdit = this.canEdit;

    return `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${ViewModeToggle.render([
              { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.listViewMode === 'list' },
              { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.listViewMode === 'grid' }
            ])}
            ${SearchInput.render('produkt', {
              placeholder: 'Produkt suchen...',
              currentValue: this.searchQuery
            })}
            <div id="sort-dropdown-container"></div>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
          <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>` : ''}
          ${canEdit ? '<button id="btn-produkt-new" class="mdc-btn">Produkt anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-produkte"></th>` : ''}
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
          <tbody>
            <tr>
              <td colspan="${canBulkDelete ? '9' : '8'}" class="no-data">Lade Produkte...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-container" id="pagination-produkt"></div>
    `;
  }

  async initializeFilterBar() {
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('produkt', sortContainer, {
        nameField: 'name',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }

    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('produkt', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  bindAdditionalEvents(signal) {
    if (document.getElementById('produkt-search-input')) {
      SearchInput.bind('produkt', (value) => this.handleSearch(value), signal);
    }

    document.addEventListener('click', (e) => {
      const listBtn = e.target.closest('#btn-view-list');
      if (listBtn) {
        e.preventDefault();
        this.setListViewMode('list');
        return;
      }

      const gridBtn = e.target.closest('#btn-view-grid');
      if (gridBtn) {
        e.preventDefault();
        this.setListViewMode('grid');
        return;
      }

      const backCompanies = e.target.closest('#btn-back-to-companies');
      if (backCompanies) {
        e.preventDefault();
        this.switchToCompaniesView();
        return;
      }

      const backBrands = e.target.closest('#btn-back-to-brands');
      if (backBrands) {
        e.preventDefault();
        this.switchToBrandsView(this.currentUnternehmenId, this.currentUnternehmenName);
        return;
      }

      const companyCard = e.target.closest('#companies-grid .folder-card');
      if (companyCard) {
        this.switchToBrandsView(companyCard.dataset.unternehmenId, companyCard.dataset.unternehmenName);
        return;
      }

      const brandCard = e.target.closest('#brands-grid .folder-card');
      if (brandCard) {
        if (brandCard.dataset.ohneMarke === '1') {
          this.switchToItemsView(null, brandCard.dataset.markeName, { ohneMarke: true });
        } else {
          this.switchToItemsView(brandCard.dataset.markeId, brandCard.dataset.markeName);
        }
        return;
      }

      const openLink = e.target.closest('.produkt-row-open');
      if (openLink) {
        e.preventDefault();
        this.openProdukt(openLink.dataset.produktId, openLink.dataset.unternehmenId);
        return;
      }

      if (e.target.id === 'btn-produkt-new' || e.target.id === 'btn-produkt-new-filter') {
        e.preventDefault();
        window.navigateTo('/produkt/new');
      }
    }, { signal });
  }

  openProdukt(produktId, unternehmenId) {
    if (!produktId || !unternehmenId) return;
    window.navigateTo(produktFormRoute(unternehmenId, produktId));
  }

  showCreateForm() {
    window.navigateTo('/produkt/new');
  }

  async updateTable(produkte) {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!produkte || produkte.length === 0) {
        this.renderEmptyTable(tbody);
        return;
      }
      tbody.innerHTML = produkte.map(produkt => this.renderSingleRow(produkt)).join('');
    });
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('produkt');
    return Object.keys(filters).length > 0 || (this.searchQuery || '').trim().length > 0;
  }

  destroy() {
    super.destroy();
    this._allProdukte = null;
    this.companyFolders = [];
    this.brandFolders = [];
    this.currentItems = [];
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
  }
}

export const produktList = new ProduktList();
