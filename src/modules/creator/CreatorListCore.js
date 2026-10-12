// CreatorListCore.js
// Klasse, Laden, Sortierung, URL und Filter der Creator-Liste. Mixins: View, Bulk, Form

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { CreatorGridView } from './CreatorGridView.js';
import { GENERATIONEN, GROESSEN } from './creatorProfil.js';
import { settleRezensionFilters } from './rezension.js';
import { formatCreatorSumme, queryToSelection, selectionToQuery } from './creatorFilterQuery.js';
import { ANZAHL_SORTS, normalizeSort, sortiereNachAnzahl, sortiereNachName } from './creatorBuchung.js';
import { paintFilterValues } from './creatorFilterColumn.js';
import { syncFilterSelect } from '../../core/filters/FilterSelect.js';

export const ANSICHT_KEY = 'creator-ansicht';

function readAnsicht() {
  try {
    return localStorage.getItem(ANSICHT_KEY) === 'liste' ? 'liste' : 'grid';
  } catch {
    return 'grid';
  }
}

export class CreatorList extends BasePaginatedList {
  constructor(opts = {}) {
    const mode = opts.mode || 'all'; // 'all' | 'management'
    const isManagement = mode === 'management';

    super('creator', {
      itemsPerPage: 25,
      headline: isManagement ? 'Management-Creator Übersicht' : 'Creator Übersicht',
      breadcrumbLabel: 'Creator',
      sortField: 'nachname',
      sortAscending: true,
      paginationContainerId: 'pagination-container-creator',
      tbodySelector: '.data-table tbody',
      tableColspan: 14, // Mit Admin-Checkbox
      checkboxClass: 'creator-check',
      selectAllId: 'select-all-creators',
      ...opts
    });

    this.mode = mode;
    this._managementCreatorIds = null;

    // Bulk-Connect-Status
    this._bulkConnectRunning = false;
    this._bulkConnectAbort = false;

    // Zusätzliche Creator-spezifische Properties
    this.selectedCreator = this.selectedItems; // Alias für Kompatibilität

    this.groesseFilter = [];
    this.generationFilter = '';
    this.ansicht = readAnsicht();
    this.sort = 'name';
    this.videoTage = 0;
    this._countKey = '';
    this._countOrder = [];
    this.gridView = new CreatorGridView(this);
    this._gridLoadedOnce = false;

    // Referenz auf Basis-loadData, um aus der Override heraus die Tabellen-Logik
    // aufrufen zu können.
    this._superLoadData = BasePaginatedList.prototype.loadData.bind(this);
  }

  /**
   * Lädt die Creator-Daten für eine Seite
   */
  usesFilterColumn() {
    return this.mode === 'all';
  }

  async loadPageData(page, limit, filters) {
    const sort = normalizeSort(filters?._sort);
    if (sort === 'name') return this.loadNamePage(page, limit, filters);
    if (ANZAHL_SORTS[sort]) return this.loadAnzahlPage(page, limit, filters, sort);
    return this.loadCreatorPage(page, limit, filters);
  }

  async loadCreatorPage(page, limit, filters) {
    const queryFilters = { ...filters };
    delete queryFilters._sort;
    // Summe über den Karten ist die genaue Trefferzahl, nicht die Schätzung fürs Weiterladen.
    if (this.usesFilterColumn() && page === 1 && !queryFilters._idOnly) queryFilters._countExact = true;

    // Management-Modus: nur Creator mit aktiver Management-Verknüpfung laden
    if (this.mode === 'management' && window.supabase) {
      const ids = await this.loadManagementCreatorIds();
      if (!ids || ids.length === 0) {
        return { data: [], total: 0 };
      }
      queryFilters._allowedIds = ids;
    }

    const result = await window.dataService.loadEntitiesWithPagination(
      'creator',
      queryFilters,
      page,
      limit
    );
    
    return {
      data: result.data || [],
      total: result.total || 0
    };
  }

  orderBase(filters) {
    const base = { ...filters };
    delete base._sort;
    delete base._sortBy;
    delete base._sortOrder;
    delete base._countExact;
    delete base._idOnly;
    return base;
  }

  async pageFromOrder(page, limit, order, stamp) {
    const start = (page - 1) * limit;
    const slice = (order || []).slice(start, start + limit);
    if (!slice.length) return { data: [], total: order?.length || 0 };
    const result = await this.loadCreatorPage(1, slice.length, { _allowedIds: slice.map((row) => row.id) });
    const byId = new Map((result.data || []).map((creator) => [creator.id, creator]));
    const data = slice.map((row) => {
      const creator = byId.get(row.id);
      if (creator && stamp) stamp(creator, row);
      return creator;
    }).filter(Boolean);
    return { data, total: order.length };
  }

  async loadNamePage(page, limit, filters) {
    const base = this.orderBase(filters);
    const key = JSON.stringify(base);
    if (this._nameKey !== key) {
      const creators = await this.loadAllMatchingIds(base);
      this._nameOrder = sortiereNachName(creators);
      this._nameKey = key;
    }
    return this.pageFromOrder(page, limit, this._nameOrder);
  }

  async loadAnzahlPage(page, limit, filters, sort) {
    const art = ANZAHL_SORTS[sort];
    const base = this.orderBase(filters);
    const key = `${sort}|${JSON.stringify(base)}`;
    if (this._countKey !== key) {
      try {
        const [creators, counts] = await Promise.all([
          this.loadAllMatchingIds(base),
          art.laden(window.supabase)
        ]);
        this._countOrder = sortiereNachAnzahl(creators, counts);
        this._countKey = key;
      } catch (error) {
        console.error(art.fehler, error);
        window.toastSystem?.show(art.fehler, 'error');
        this.setSort('name', { reload: false });
        return this.loadNamePage(page, limit, base);
      }
    }
    const stamp = art.stempel ? (creator, row) => { creator.videos = row.anzahl; } : null;
    return this.pageFromOrder(page, limit, this._countOrder, stamp);
  }

  async loadAllMatchingIds(filters) {
    const creators = [];
    const limit = 500;
    let page = 1;
    while (page < 20) {
      const result = await this.loadCreatorPage(page, limit, { ...filters, _idOnly: true });
      creators.push(...(result.data || []));
      if ((result.data || []).length < limit) break;
      page += 1;
    }
    return creators;
  }

  /**
   * Lädt alle creator_id mit aktiver Management-Verknüpfung (Cache pro Modul-Instanz)
   */
  async loadManagementCreatorIds() {
    if (this._managementCreatorIds !== null) return this._managementCreatorIds;

    try {
      const { data, error } = await window.supabase
        .from('creator_management')
        .select('creator_id')
        .eq('ist_aktiv', true);

      if (error) {
        console.error('❌ CREATORLIST: Fehler beim Laden der Management-Verknüpfungen:', error);
        return null;
      }

      const unique = [...new Set((data || []).map(r => r.creator_id).filter(Boolean))];
      this._managementCreatorIds = unique;
      return unique;
    } catch (err) {
      console.error('❌ CREATORLIST: Exception beim Laden der Management-Verknüpfungen:', err);
      return null;
    }
  }

  resetEntityCaches() {
    this._managementCreatorIds = null;
  }

  /** Override: die Uebersicht ist immer das Grid, nie die Tabelle. */
  async loadData() {
    if (this._destroyed) return;
    const scrollTop = this._gridLoadedOnce;
    this._gridLoadedOnce = true;
    this._nameKey = '';
    this._countKey = '';
    this.writeSelectionToUrl();
    await this.gridView.reload({ scrollTop });
  }

  onResultTotal(total) {
    const el = document.getElementById('creator-result-count');
    if (el) el.textContent = formatCreatorSumme(total);
  }

  readBarFromLocation() {
    const selection = queryToSelection(window.location.search, {
      groessen: GROESSEN,
      generationen: GENERATIONEN.map((entry) => entry.label)
    });
    this.searchQuery = selection.search;
    this.groesseFilter = selection.groesse;
    this.generationFilter = selection.generation[0] || '';
    this.sort = selection.sort || 'name';
    this.videoTage = this.sort === 'video30' ? 30 : this.sort === 'video90' ? 90 : 0;
  }

  writeSelectionToUrl() {
    if (!this.usesFilterColumn()) return;
    const filterIds = this._filterColumn
      ? new Set(this._filterColumn.filters.map((filter) => filter.id))
      : null;
    const values = { ...filterSystem.getFilters(this.entityType) };
    const params = selectionToQuery({
      search: this.searchQuery,
      groesse: this.usesFilterColumn() ? (Array.isArray(values.groesse) ? values.groesse : []) : this.groesseFilter,
      generation: this.usesFilterColumn() ? values.generation : this.generationFilter,
      sort: this.sort,
      filters: values,
      filterIds
    });
    const next = params.toString();
    const url = next ? `/creator?${next}` : '/creator';
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === url) return;
    try {
      window.history.replaceState({ ...(window.history.state || {}), route: url }, '', url);
    } catch {
      // History nicht verfügbar
    }
  }

  async renderShell() {
    if (this.usesFilterColumn() && !this._shellRendered) this.readBarFromLocation();
    return super.renderShell();
  }

  /**
   * Soft-Update nach Connect/Refresh: nur die betroffene Grid-Karte ersetzen,
   * damit die Scroll-Position nicht nach oben springt.
   * @returns {Promise<boolean>} true = Full-Reload unterdrücken
   */
  async loadMoreForScroll() {
    if (!this.gridView) return false;
    return this.gridView.loadMoreForScroll();
  }

  async handleEntityUpdated(detail) {
    if (!detail?.id) return false;

    const action = detail.action || '';
    if (action === 'deleted' || action === 'bulk-deleted' || action === 'created') {
      return false;
    }

    return this.gridView.refreshCard(detail.id);
  }

  destroy() {
    clearTimeout(this._filterColumn?.timer);
    this.gridView?.destroy();
    this._gridLoadedOnce = false;
    super.destroy();
  }

  /**
   * Baut die Filter für Creator inkl. Suche
   */
  buildFilters() {
    const filters = super.buildFilters();
    
    // Suchbegriff als name-Filter hinzufügen (sucht in vorname UND nachname)
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      filters.name = this.searchQuery.trim();
    }
    if (!this.usesFilterColumn()) {
      if (this.groesseFilter?.length) filters.groesse = [...this.groesseFilter];
      if (this.generationFilter) filters.generation = this.generationFilter;
    }
    if (this.usesFilterColumn()) {
      const sort = normalizeSort(this.sort);
      filters._sort = sort;
      if (sort === 'follower') {
        filters._sortBy = 'instagram_follower';
        filters._sortOrder = 'desc';
      } else if (sort === 'rezension') {
        filters._sortBy = 'rezension_schnitt';
        filters._sortOrder = 'desc';
      }
    }

    return settleRezensionFilters(filters);
  }

  setSort(sort, { reload = true } = {}) {
    const next = normalizeSort(sort);
    this.sort = next;
    this.videoTage = next === 'video30' ? 30 : next === 'video90' ? 90 : 0;
    document.querySelectorAll('[name="creator-sort"]').forEach((input) => {
      input.value = next;
      const wrapper = input.closest('[data-filter-select]');
      if (wrapper) syncFilterSelect(wrapper);
    });
    if (reload) this.loadData();
  }

  setFavoritVon(userId) {
    if (!userId) return;
    const current = { ...filterSystem.getFilters(this.entityType) };
    current.favorit_von = [userId];
    filterSystem.applyFilters(this.entityType, current);
    const column = document.getElementById('creator-filter-column');
    if (column && this._filterColumn) paintFilterValues(column, this._filterColumn.filters, current);
    this._filterColumn?.renderChips();
    this.pagination.currentPage = 1;
    this.loadDataDebounced(50);
  }

  onFiltersReset() {
    const column = document.getElementById('creator-filter-column');
    if (column && this._filterColumn) paintFilterValues(column, this._filterColumn.filters, {});
    filterSystem.resetFilters(this.entityType);
    this.pagination.currentPage = 1;
    this._filterColumn?.renderChips();
    this.loadDataDebounced(50);
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('creator');
    return Object.keys(filters).length > 0;
  }
}
