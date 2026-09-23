// PersonaList.js
// Grid: Unternehmen → Marken → Personas. Liste: flache Tabelle.

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { PersonaFilterLogic } from './filters/PersonaFilterLogic.js';
import { PersonaService } from './PersonaService.js';
import {
  renderVerknuepfungen,
  namedLinks,
  skriptLinks,
  acceptedProduktLinks,
  attachBriefingsToPersonas
} from '../../core/ui/tableVerknuepfungen.js';
import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems,
  NUR_UNTERNEHMEN_LABEL
} from './PersonaFolders.js';
import {
  parseFolderQuery,
  folderListUrl,
  folderCrumbs,
  withFolderQuery
} from '../../core/folderListNav.js';
import {
  renderCompaniesView, updateCompaniesGrid,
  renderBrandsView, updateBrandsGrid,
  renderItemsView, updateItemsTable as _updateItemsTable
} from './PersonaFolderRenderer.js';
import { openPersonaCreateDrawer } from './PersonaCreateDrawer.js';

const PERSONA_LIST_SELECT = `
  *,
  unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
  marken:persona_marke(marke_id, marke:marke_id(id, markenname, logo_url)),
  produkte:produkt_persona_vorschlag(status, produkt:produkt_id(id, name)),
  skripte(id, titel)
`;

export class PersonaList extends BasePaginatedList {
  constructor() {
    super('persona', {
      itemsPerPage: 25,
      headline: 'Personas Übersicht',
      breadcrumbLabel: 'Persona',
      sortField: 'name',
      sortAscending: true,
      paginationContainerId: 'pagination-persona',
      tbodySelector: '.data-table tbody',
      tableColspan: 13,
      checkboxClass: 'persona-check',
      selectAllId: 'select-all-personas'
    });

    this._allPersonas = null;

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
      icon: 'users',
      title: 'Keine Personas vorhanden',
      text: canEdit
        ? 'Legen Sie Ihre erste Persona an, um loszulegen.'
        : 'Es sind noch keine Personas für Sie freigegeben.',
      actionsHtml: canEdit ? '<button id="btn-persona-new" class="mdc-btn">Persona anlegen</button>' : ''
    };
  }

  resetEntityCaches() {
    this._allPersonas = null;
  }

  applyQueryParams(params) {
    const folder = parseFolderQuery(params);

    this.currentUnternehmenId = folder.unternehmenId;
    this.currentUnternehmenName = folder.unternehmenName;
    this.currentMarkeId = folder.markeId;
    this.currentMarkeName = folder.markeName;
    this._ohneMarke = folder.ohneMarke;
    this.viewMode = folder.viewMode;
  }

  currentFolder() {
    return {
      unternehmenId: this.currentUnternehmenId,
      unternehmenName: this.currentUnternehmenName,
      markeId: this.currentMarkeId,
      markeName: this.currentMarkeName,
      ohneMarke: this._ohneMarke
    };
  }

  listUrl(viewMode = this.viewMode) {
    return folderListUrl('/persona', this.currentFolder(), viewMode);
  }

  syncListUrl() {
    const url = this.listViewMode === 'list' ? '/persona' : this.listUrl();
    window.history.replaceState({ route: url }, '', url);
  }

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;

    if (this.listViewMode === 'list' || this.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Personas', url: '/persona', clickable: false }
      ]);
      return;
    }

    window.breadcrumbSystem.updateBreadcrumb(folderCrumbs({
      listLabel: 'Personas',
      basePath: '/persona',
      folder: this.currentFolder()
    }));
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
    await this.ensureAllPersonas();
    this.buildCurrentFolders();
    this.renderFolderView();
    this.bindEvents();

    if (this.viewMode === 'items') {
      this.pagination.init('pagination-persona-items', {
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
      this._allPersonas = null;
      await this.ensureAllPersonas();
      this.buildCurrentFolders();
      this.renderFolderView();
      if (this.viewMode === 'items') {
        this.pagination.init('pagination-persona-items', {
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

  async ensureAllPersonas() {
    if (this._allPersonas) return this._allPersonas;
    this._allPersonas = await this.loadAllPersonas();
    return this._allPersonas;
  }

  async loadAllPersonas() {
    if (!window.supabase) return [];

    const { data, error } = await window.supabase
      .from('personas')
      .select(PERSONA_LIST_SELECT)
      .not('unternehmen_id', 'is', null)
      .order('name', { ascending: true });

    if (error) throw error;
    return this.attachBriefings(data || []);
  }

  async attachBriefings(personas) {
    const ids = (personas || []).map((persona) => persona.id).filter(Boolean);
    if (!ids.length || !window.supabase) return personas || [];

    const briefings = [];
    for (let i = 0; i < ids.length; i += 80) {
      const chunk = ids.slice(i, i + 80);
      const { data, error } = await window.supabase
        .from('campaign_briefings')
        .select('id, aktivierung_name, persona_ids')
        .overlaps('persona_ids', chunk);
      if (error) throw error;
      briefings.push(...(data || []));
    }

    const unique = [...new Map(briefings.map((row) => [row.id, row])).values()];
    return attachBriefingsToPersonas(personas, unique);
  }

  buildCurrentFolders() {
    const personas = this._allPersonas || [];
    if (this.viewMode === 'companies') {
      this.companyFolders = buildCompanyFolders(personas);
      return;
    }
    if (this.viewMode === 'brands') {
      this.brandFolders = buildBrandFolders(personas, this.currentUnternehmenId);
      return;
    }
    this.currentItems = buildCurrentItems(personas, {
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

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = window.supabase
        .from('personas')
        .select(PERSONA_LIST_SELECT, { count: 'exact' })
        .not('unternehmen_id', 'is', null)
        .order(this.currentSort.field, { ascending: this.currentSort.ascending });

      if (filters.marke_id) {
        const { data: markenTreffer } = await window.supabase
          .from('persona_marke')
          .select('persona_id')
          .eq('marke_id', filters.marke_id);
        const markePersonaIds = (markenTreffer || []).map(r => r.persona_id).filter(Boolean);
        if (!markePersonaIds.length) return { data: [], total: 0 };
        query = query.in('id', markePersonaIds);
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
          `oberbegriff.ilike.%${search}%`,
          `beruf.ilike.%${search}%`,
          `wohnort_region.ilike.%${search}%`
        ];
        if (matchU?.length) {
          orParts.push(`unternehmen_id.in.(${matchU.map(u => u.id).join(',')})`);
        }
        query = query.or(orParts.join(','));
        delete filtersForQuery.name;
      }

      query = PersonaFilterLogic.buildSupabaseQuery(query, filtersForQuery);
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { data: await this.attachBriefings(data || []), total: count || 0 };
    } catch (error) {
      console.error('❌ Fehler beim Laden der Personas:', error);
      throw error;
    }
  }

  renderSingleRow(persona, options = {}) {
    const showCheckbox = options.checkbox !== false && this.canBulkDelete;
    const sanitize = this.sanitize.bind(this);
    const marken = this.renderMarken(persona);

    return `
      <tr data-id="${persona.id}" data-unternehmen-id="${persona.unternehmen_id || ''}">
        ${showCheckbox ? `<td class="col-checkbox"><input type="checkbox" class="persona-check" data-id="${persona.id}"></td>` : ''}
        <td>${sanitize(persona.oberbegriff || '-')}</td>
        <td class="col-name">
          <a href="#" class="table-link persona-row-open" data-persona-id="${persona.id}">
            ${sanitize(persona.name || '')}
          </a>
        </td>
        <td>${this.renderUnternehmen(persona.unternehmen)}</td>
        <td>${marken}</td>
        <td>${sanitize(PersonaService.alterLabel(persona))}</td>
        <td>${sanitize(persona.geschlecht || '-')}</td>
        <td>${sanitize(persona.wohnort_region || '-')}</td>
        <td>${this._formatDate(persona.created_at)}</td>
        <td>${renderVerknuepfungen(acceptedProduktLinks(persona.produkte))}</td>
        <td>${renderVerknuepfungen(namedLinks(persona.verknuepfte_briefings, { labelKey: 'aktivierung_name', kind: 'briefing' }))}</td>
        <td>${renderVerknuepfungen(skriptLinks(persona.skripte))}</td>
        <td class="col-actions">
          ${actionBuilder.create('persona', persona.id)}
        </td>
      </tr>
    `;
  }

  renderMarken(persona) {
    const namen = PersonaService.markenNamen(persona);
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
            ${SearchInput.render('persona', {
              placeholder: 'Persona suchen...',
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
          ${canEdit ? '<button id="btn-persona-new" class="mdc-btn">Persona anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-personas"></th>` : ''}
              <th>Oberbegriff</th>
              <th class="col-name">Name</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Alter</th>
              <th>Geschlecht</th>
              <th>Region</th>
              <th>Erstellt</th>
              <th>Produkte</th>
              <th>Briefings</th>
              <th>Skripte</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${canBulkDelete ? '13' : '12'}" class="no-data">Lade Personas...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-container" id="pagination-persona"></div>
    `;
  }

  async initializeFilterBar() {
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('persona', sortContainer, {
        nameField: 'name',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }

    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('persona', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  bindAdditionalEvents(signal) {
    if (document.getElementById('persona-search-input')) {
      SearchInput.bind('persona', (value) => this.handleSearch(value), signal);
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

      const openLink = e.target.closest('.persona-row-open');
      if (openLink) {
        e.preventDefault();
        this.openPersona(openLink.dataset.personaId);
        return;
      }

      if (e.target.id === 'btn-persona-new' || e.target.closest('#btn-persona-new')) {
        e.preventDefault();
        this.openCreateDrawer();
      }
    }, { signal });
  }

  openPersona(personaId) {
    if (!personaId) return;
    window.navigateTo(withFolderQuery(`/persona/${personaId}`));
  }

  openCreateDrawer() {
    const folder = this.currentFolder();
    openPersonaCreateDrawer({
      origin: 'liste',
      unternehmen_id: folder.unternehmenId || null,
      unternehmenName: folder.unternehmenName || null,
      marke_id: folder.ohneMarke ? null : (folder.markeId || null),
      markeName: folder.ohneMarke ? null : (folder.markeName || null)
    });
  }

  showCreateForm() {
    this.openCreateDrawer();
  }

  async updateTable(personas) {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!personas || personas.length === 0) {
        this.renderEmptyTable(tbody);
        return;
      }
      tbody.innerHTML = personas.map(persona => this.renderSingleRow(persona)).join('');
    });
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('persona');
    return Object.keys(filters).length > 0 || (this.searchQuery || '').trim().length > 0;
  }

  destroy() {
    super.destroy();
    this._allPersonas = null;
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

export const personaList = new PersonaList();
