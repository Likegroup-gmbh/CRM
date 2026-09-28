// KampagneList.js (ES6-Modul)
// Kampagnen-Liste mit Filtersystem und Kalender-View

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { KampagneCalendarView } from './KampagneCalendarView.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { bindToolbarMenu } from '../../core/components/ToolbarMenu.js';

import { debugLog, debounce, bindDragToScroll, destroyDragToScroll } from './KampagneListUtils.js';
import { loadKampagnenWithRelations, loadUserPermissions } from './KampagneListDataLoader.js';
import { renderPageHtml, renderTableWrapper, updateTable, renderFolderRows } from './KampagneListRenderers.js';
import { KampagneCreateHandler } from './KampagneCreateHandler.js';
import { bindEmptyStateActions } from '../../core/components/EmptyState.js';
import { getShowCompleted, setShowCompleted, shouldHideCompleted } from './kampagneListPrefs.js';
import {
  KampagneGridView,
  initialKampagneView,
  setKampagneAnsicht,
  loadKampagnenGrid
} from './KampagneGridView.js';
import { parseFolderQuery, folderListUrl, folderCrumbs, NUR_UNTERNEHMEN_LABEL, markenEbeneEntfaellt } from '../../core/folderListNav.js';
import { icon } from '../../core/icons/IconSystem.js';

const createHandler = new KampagneCreateHandler();

export class KampagneList {
  constructor() {
    this.selectedKampagnen = new Set();
    this._boundEventListeners = new Set();
    this.kampagneArtMap = new Map();
    this.currentView = 'list'; // 'list' | 'calendar' | 'grid'
    this.calendarView = null;
    this.gridView = null;
    
    // AbortController und Mount-Status für Race Condition Prevention
    this._abortController = null;
    this._isMounted = false;
    this._shellRendered = false;
    
    // Named Event-Handler References (für sauberes Cleanup)
    this._handlers = {
      globalClick: this._handleGlobalClick.bind(this),
      globalChange: this._handleGlobalChange.bind(this),
      entityUpdated: this._handleEntityUpdated.bind(this),
      kampagneUpdated: this._handleKampagneUpdated.bind(this)
    };
    
    // Pagination
    this.pagination = new PaginationSystem();
    
    // Suchfeld
    this.searchQuery = '';
    this._searchDebounceTimer = null;
    
    // Debounced Methoden (verhindert multiple API-Calls bei schnellen Filter-Änderungen)
    this._debouncedLoadAndRender = debounce(() => {
      if (this._isMounted) {
        this.loadData();
      }
    }, 300);

    // CreateHandler mit dieser Instanz verbinden
    createHandler.init(this);
  }

  // ========================================
  // EVENT HANDLER (Named References für Cleanup)
  // ========================================

  _handleGlobalClick(e) {
    // Neue Kampagne anlegen Button
    if (e.target.id === 'btn-kampagne-new' || e.target.id === 'btn-kampagne-new-filter') {
      e.preventDefault();
      window.navigateTo('/projekt-erstellen');
      return;
    }
    
    // Kampagne Detail Link
    if (e.target.classList.contains('table-link') && e.target.dataset.table === 'kampagne') {
      e.preventDefault();
      const kampagneId = e.target.dataset.id;
      window.navigateTo(`/kampagne/${kampagneId}`);
      return;
    }

    // Auftragsdetails Detail Link
    if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftragsdetails') {
      e.preventDefault();
      window.navigateTo(`/auftragsdetails/${e.target.dataset.id}`);
      return;
    }
    
    // Filter-Tag X-Buttons
    if (e.target.classList.contains('tag-x')) {
      e.preventDefault();
      e.stopPropagation();
      const tagElement = e.target.closest('.filter-tag');
      const key = tagElement?.dataset.key;
      if (key) {
        const currentFilters = filterSystem.getFilters('kampagne');
        delete currentFilters[key];
        filterSystem.applyFilters('kampagne', currentFilters);
        this.loadData();
      }
      return;
    }
    
    // List-View spezifische Clicks
    if (this.currentView === 'list') {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.kampagne-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedKampagnen.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-kampagnen');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
        return;
      }
      
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        this.deselectAll();
        return;
      }
    }
  }

  _handleGlobalChange(e) {
    if (this.currentView !== 'list') return;
    
    if (e.target.id === 'select-all-kampagnen') {
      const checkboxes = document.querySelectorAll('.kampagne-check');
      const isChecked = e.target.checked;
      
      checkboxes.forEach(cb => {
        cb.checked = isChecked;
        if (isChecked) {
          this.selectedKampagnen.add(cb.dataset.id);
        } else {
          this.selectedKampagnen.delete(cb.dataset.id);
        }
      });
      
      this.updateSelection();
      return;
    }
    
    if (e.target.classList.contains('kampagne-check')) {
      if (e.target.checked) {
        this.selectedKampagnen.add(e.target.dataset.id);
      } else {
        this.selectedKampagnen.delete(e.target.dataset.id);
      }
      this.updateSelection();
      this.updateSelectAllCheckbox();
    }
  }

  _handleEntityUpdated(e) {
    if (e.detail.entity === 'kampagne') {
      if (this.currentView === 'calendar' && this.calendarView) {
        this.calendarView.refresh();
      } else if (this.currentView === 'grid' && this.gridView) {
        this.gridView.reload();
      } else {
        this.loadData();
      }
    }
  }

  _handleKampagneUpdated() {
    if (this.currentView === 'calendar' && this.calendarView) {
      this.calendarView.refresh();
    } else if (this.currentView === 'grid' && this.gridView) {
      this.gridView.reload();
    } else {
      this.loadData();
    }
  }

  // ========================================
  // INIT & LIFECYCLE
  // ========================================

  async init() {
    this._isMounted = true;
    
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();

    this.currentView = initialKampagneView();
    
    window.setHeadline('Kampagnen Übersicht');
    
    if (window.bulkActionSystem) {
      window.bulkActionSystem.hideForKunden();
    }
    
    this.pagination.init('pagination-kampagne', {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });
    
    const canView = (window.canViewPage && window.canViewPage('kampagne')) || await window.checkUserPermission('kampagne', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kampagnen anzuzeigen.</p>
        </div>
      `;
      return;
    }
    
    await this.loadAndRender();
  }

  async loadAndRender() {
    const checkMounted = () => this._isMounted && !this._abortController?.signal.aborted;
    
    try {
      if (!checkMounted()) return;
      
      if (!this._shellRendered) {
        await this.render();
        if (!checkMounted()) return;
      }
      
      await this.loadData();
      
    } catch (error) {
      if (error.name === 'AbortError') return;
      window.ErrorHandler.handle(error, 'KampagneList.loadAndRender');
    }
  }

  async loadData() {
    const checkMounted = () => this._isMounted && !this._abortController?.signal.aborted;

    try {
      if (!checkMounted()) return;

      if (this.currentView === 'grid') {
        if (this.gridView) await this.gridView.reload();
        else await this.initGridView();
        return;
      }

      if (this.currentView === 'list') {
        const folder = parseFolderQuery(window.location.search);
        const hasQuery = this.hasActiveFilters();

        if (folder.viewMode !== 'items' && !hasQuery) {
          await this._loadFolderRows(folder);
          return;
        }

        if (folder.ohneMarke && !hasQuery && !this._markenEbeneBekannt(folder)) {
          await this._resolveMarkenEbeneWeg(folder);
          this.updateBreadcrumbForFolder(folder);
        }

        const scope = hasQuery ? null : folder;
        const container = document.getElementById('kampagnen-content-container');
        if (container && !container.querySelector('.data-table--kampagne')) {
          container.innerHTML = renderTableWrapper();
        }

        const [, result] = await Promise.all([
          this._shellRendered ? Promise.resolve() : this.initializeFilterBar(),
          loadKampagnenWithRelations(
            this.pagination.currentPage,
            this.pagination.itemsPerPage,
            { searchQuery: this.searchQuery, folder: scope }
          )
        ]);

        if (!checkMounted()) return;

        if (result.kampagneArtMap) this.kampagneArtMap = result.kampagneArtMap;

        const filteredKampagnen = result?.data ?? result ?? [];
        const totalCount = result?.count ?? filteredKampagnen.length;

        this.pagination.updateTotal(totalCount);
        await updateTable(filteredKampagnen, {
          bindDragToScroll: () => this.bindDragToScroll(),
          hasActiveFilters: this.hasActiveFilters(),
          hideCompletedActive: shouldHideCompleted(this.searchQuery)
        });
        this.syncShowCompletedToggle();
        this.updateToolbarFilterBadge();
        this.pagination.render();
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      window.ErrorHandler.handle(error, 'KampagneList.loadData');
    }
  }

  _rememberMarkenEbene(unternehmenId, weg) {
    this._markenEbeneWegFirma = unternehmenId;
    this._markenEbeneWeg = !!weg;
    this._markenEbeneWegKnown = true;
  }

  _markenEbeneBekannt(folder) {
    return !!(this._markenEbeneWegKnown && this._markenEbeneWegFirma === folder?.unternehmenId);
  }

  _istMarkenEbeneWeg(folder) {
    return !!(folder?.ohneMarke && this._markenEbeneBekannt(folder) && this._markenEbeneWeg);
  }

  async _resolveMarkenEbeneWeg(folder) {
    if (!folder?.ohneMarke || !folder.unternehmenId) return false;
    if (this._markenEbeneBekannt(folder)) return this._markenEbeneWeg;
    const data = await loadKampagnenGrid(
      { unternehmenId: folder.unternehmenId, viewMode: 'brands' },
      shouldHideCompleted(this.searchQuery)
    );
    const weg = markenEbeneEntfaellt((data?.marken || []).length, data?.ohne_marke_count || 0);
    this._rememberMarkenEbene(folder.unternehmenId, weg);
    return weg;
  }

  async _loadFolderRows(folder) {
    const container = document.getElementById('kampagnen-content-container');
    if (!container) return;

    const mode = folder.viewMode || 'companies';

    try {
      const data = await loadKampagnenGrid(folder, shouldHideCompleted(this.searchQuery));
      if (!this._isMounted) return;

      if (mode === 'brands') {
        const weg = markenEbeneEntfaellt((data?.marken || []).length, data?.ohne_marke_count || 0);
        this._rememberMarkenEbene(folder.unternehmenId, weg);
        if (weg) {
          return this._navigateFolder({
            viewMode: 'items',
            unternehmenId: folder.unternehmenId,
            unternehmenName: folder.unternehmenName,
            markeId: null,
            markeName: NUR_UNTERNEHMEN_LABEL,
            ohneMarke: true
          });
        }
      }

      container.innerHTML = this._folderShell(mode, '');
      const tbody = document.getElementById('kampagnen-folder-body');
      if (!tbody) return;

      if (mode === 'companies') {
        tbody.innerHTML = renderFolderRows(data?.unternehmen || [], { mode: 'companies' });
      } else {
        const folders = [...(data?.marken || [])];
        if ((data?.ohne_marke_count || 0) > 0) {
          folders.push({
            id: null,
            markenname: NUR_UNTERNEHMEN_LABEL,
            logo_url: null,
            count: data.ohne_marke_count,
            virtual: true
          });
        }
        tbody.innerHTML = renderFolderRows(folders, { mode: 'brands' });
      }
      this.pagination.updateTotal(0);
      this.pagination.render();
    } catch (error) {
      if (!this._isMounted) return;
      window.ErrorHandler?.handle(error, 'KampagneList._loadFolderRows');
      const tbody = document.getElementById('kampagnen-folder-body');
      if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="error-message">Ordner konnten nicht geladen werden.</td></tr>';
    }
  }

  _folderShell(mode, rowsHtml) {
    const back = mode === 'brands'
      ? `<button type="button" id="btn-back-to-companies" class="mdc-btn mdc-btn--secondary">${icon('arrow-left')} Zurück</button>`
      : '';
    return `
      <div class="list-container">
        ${back ? `<div class="table-filter-wrapper"><div class="filter-bar"><div class="filter-left">${back}</div></div></div>` : ''}
        <div class="table-container">
          <table class="data-table data-table--kampagne-folders">
            <thead>
              <tr>
                <th class="col-thumb">Bild</th>
                <th class="col-folder-name">Name</th>
                <th class="col-folder-count">Anzahl</th>
              </tr>
            </thead>
            <tbody id="kampagnen-folder-body">${rowsHtml}</tbody>
          </table>
        </div>
        <div class="pagination-container" id="pagination-kampagne"></div>
      </div>
    `;
  }

  updateBreadcrumbForFolder(folder) {
    if (!window.breadcrumbSystem) return;
    if (!folder?.unternehmenId || folder.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kampagnen', url: '/kampagne', clickable: false }
      ]);
      return;
    }
    const crumbs = folderCrumbs({
      listLabel: 'Kampagnen',
      basePath: '/kampagne',
      folder,
      markenEbeneWeg: this._istMarkenEbeneWeg(folder)
    }).map((crumb) => {
      if (!crumb.url || crumb.url === '#') return crumb;
      const url = new URL(crumb.url, window.location.origin);
      url.searchParams.delete('ansicht');
      return { ...crumb, url: `${url.pathname}${url.search}` };
    });
    window.breadcrumbSystem.updateBreadcrumb(crumbs);
  }

  /**
   * @deprecated Nutze stattdessen KampagneUtils.loadAllowedKampagneIds()
   */
  async loadUserPermissions() {
    return loadUserPermissions();
  }

  // ========================================
  // RENDER
  // ========================================

  async render() {
    const html = renderPageHtml({
      currentView: this.currentView,
      searchQuery: this.searchQuery
    });

    window.setContentSafely(window.content, html);
    this._shellRendered = true;

    this.updateViewClass();
    await this.initializeFilterBar();

    if (this.currentView === 'calendar') {
      await this.initCalendarView();
    }

    this.syncShellForView(this.currentView);
    this.bindEvents();

    if (this.currentView === 'list') {
      this.updateBreadcrumbForFolder(parseFolderQuery(window.location.search));
    }
  }

  // ========================================
  // VIEW INIT
  // ========================================

  async initCalendarView() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    if (this.calendarView) {
      this.calendarView.destroy();
    }

    this.calendarView = new KampagneCalendarView();
    await this.calendarView.init(container);
    
    if (this.searchQuery) {
      this.calendarView.setSearchQuery(this.searchQuery);
    }
  }

  async initGridView() {
    const container = document.getElementById('kampagnen-grid-root');
    if (!container) return;

    if (this.gridView) {
      this.gridView.destroy();
    }

    this.gridView = new KampagneGridView(container);
    await this.gridView.mount();
    if (this.gridView) {
      const folder = this.gridView.currentFolder();
      if (folder.ohneMarke) {
        this._rememberMarkenEbene(folder.unternehmenId, !!this.gridView.markenEbeneWeg);
      }
      this.updateBreadcrumbForFolder(folder);
    }
  }

  destroyGridView() {
    if (!this.gridView) return;
    this.gridView.destroy();
    this.gridView = null;
  }

  syncShellForView(view) {
    const search = document.querySelector('.kampagne-list-page .search-input-container');
    const filter = document.getElementById('filter-dropdown-container');
    if (search) search.hidden = view === 'grid';
    if (filter) filter.hidden = view === 'grid';

    document.getElementById('btn-view-list')?.classList.toggle('active', view === 'list');
    document.getElementById('btn-view-grid')?.classList.toggle('active', view === 'grid');
    document.getElementById('btn-view-calendar')?.classList.toggle('active', view === 'calendar');
  }

  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('kampagne', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
      this.updateToolbarFilterBadge();
    }
  }

  // ========================================
  // FILTER & PAGINATION
  // ========================================

  onFiltersApplied(filters) {
    filterSystem.applyFilters('kampagne', filters);
    this.pagination.currentPage = 1;
    this.updateToolbarFilterBadge();
    this.updateBreadcrumbForFolder(null);
    this._debouncedLoadAndRender();
  }

  onFiltersReset() {
    debugLog('🔄 KampagneList: Filter zurückgesetzt');
    filterSystem.resetFilters('kampagne');
    this.pagination.currentPage = 1;
    this.updateToolbarFilterBadge();
    this.updateBreadcrumbForFolder(parseFolderQuery(window.location.search));
    this.loadData();
  }

  handlePageChange(page) {
    this.loadData();
  }

  handleItemsPerPageChange(limit, page) {
    this.loadData();
  }

  updateViewClass() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('calendar-view-active');
      
      if (this.currentView === 'calendar') {
        mainContent.classList.add('calendar-view-active');
      }
    }
  }

  handleSearch(query) {
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();

      if (this.currentView === 'calendar' && this.calendarView) {
        void this.calendarView.setSearchQuery(this.searchQuery);
        return;
      }
      if (this.currentView === 'grid') return;

      this.pagination.currentPage = 1;
      if (this.searchQuery) {
        this.updateBreadcrumbForFolder(null);
      } else {
        this.updateBreadcrumbForFolder(parseFolderQuery(window.location.search));
      }
      this.loadData();
    }, 300);
  }

  // ========================================
  // EVENTS
  // ========================================

  bindEvents() {
    SearchInput.bind('kampagne', (value) => this.handleSearch(value));
    this._bindToolbarMenu();
    this._bindFolderClicks();

    // View-Toggle (list/calendar/grid)
    const switchView = async (targetView) => {
      if (!this._isMounted || this.currentView === targetView) return;

      if (targetView !== 'calendar' && this.calendarView) {
        this.calendarView.destroy();
        this.calendarView = null;
      }
      if (targetView !== 'grid') {
        this.destroyGridView();
      }

      this.currentView = targetView;
      this.updateViewClass();
      this.syncShellForView(targetView);
      if (targetView !== 'calendar') {
        setKampagneAnsicht(targetView);
      }

      const container = document.getElementById('kampagnen-content-container');
      if (container) {
        if (targetView === 'calendar') {
          container.innerHTML = '<div id="calendar-container"></div>';
          await this.initCalendarView();
        } else if (targetView === 'grid') {
          container.innerHTML = '<div id="kampagnen-grid-root"></div>';
          await this.initGridView();
        } else {
          await this.loadData();
        }
      }
    };

    document.getElementById('btn-view-list')?.addEventListener('click', () => switchView('list'));
    document.getElementById('btn-view-grid')?.addEventListener('click', () => switchView('grid'));
    document.getElementById('btn-view-calendar')?.addEventListener('click', () => switchView('calendar'));

    if (this.currentView === 'list') {
      if (window.bulkActionSystem) {
        window.bulkActionSystem.registerList('kampagne', this);
      }
    }

    document.addEventListener('click', this._handlers.globalClick, { signal: this._abortController.signal });
    document.addEventListener('change', this._handlers.globalChange, { signal: this._abortController.signal });
    window.addEventListener('entityUpdated', this._handlers.entityUpdated, { signal: this._abortController.signal });
    window.addEventListener('kampagneUpdated', this._handlers.kampagneUpdated, { signal: this._abortController.signal });

    // Empty-State-Actions (z.B. "Filter zurücksetzen")
    bindEmptyStateActions(document, {
      'reset-filters': () => this.onFiltersReset(),
      'show-completed': () => this.applyShowCompleted(true)
    }, { signal: this._abortController.signal });
  }

  _bindFolderClicks() {
    const container = document.getElementById('kampagnen-content-container');
    if (!container) return;
    container.addEventListener('click', (e) => {
      if (this.currentView !== 'list') return;
      const back = e.target.closest('#btn-back-to-companies');
      if (back) {
        e.preventDefault();
        this._navigateFolder({ viewMode: 'companies' });
        return;
      }
      const row = e.target.closest('.kampagne-folder-row');
      if (!row) return;
      e.preventDefault();
      if (row.dataset.unternehmenId) {
        this._navigateFolder({
          viewMode: 'brands',
          unternehmenId: row.dataset.unternehmenId,
          unternehmenName: row.dataset.unternehmenName
        });
        return;
      }
      const current = parseFolderQuery(window.location.search);
      if (row.dataset.ohneMarke === '1') {
        this._navigateFolder({
          viewMode: 'items',
          unternehmenId: current.unternehmenId,
          unternehmenName: current.unternehmenName,
          markeId: null,
          markeName: row.dataset.markeName,
          ohneMarke: true
        });
        return;
      }
      if (row.dataset.markeId) {
        this._navigateFolder({
          viewMode: 'items',
          unternehmenId: current.unternehmenId,
          unternehmenName: current.unternehmenName,
          markeId: row.dataset.markeId,
          markeName: row.dataset.markeName,
          ohneMarke: false
        });
      }
    }, { signal: this._abortController.signal });
  }

  _navigateFolder(folder) {
    const url = folderListUrl('/kampagne', folder, folder.viewMode);
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.delete('ansicht');
    const clean = `${parsed.pathname}${parsed.search}`;
    window.history.replaceState({ route: clean }, '', clean);
    this.pagination.currentPage = 1;
    this.updateBreadcrumbForFolder(folder);
    return this.loadData();
  }

  _bindToolbarMenu() {
    const menu = document.querySelector('.kampagne-list-page .toolbar-menu');
    if (!menu) return;
    const cleanup = bindToolbarMenu(menu);
    this._abortController.signal.addEventListener('abort', cleanup, { once: true });

    const toggle = document.getElementById('kampagne-show-completed');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        this.applyShowCompleted(e.target.checked);
      }, { signal: this._abortController.signal });
    }

    const filterBtn = document.getElementById('btn-kampagne-list-filter');
    if (filterBtn) {
      filterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.querySelector('.toolbar-menu-dropdown')?.classList.remove('show');
        menu.querySelector('.toolbar-menu-toggle')?.setAttribute('aria-expanded', 'false');
        const plus = document.getElementById('btn-kampagne-list-toolbar-menu');
        if (this.currentView === 'grid') return;
        filterDropdown.openFromAnchor('kampagne', plus || filterBtn);
      }, { signal: this._abortController.signal });
    }

    this.updateToolbarFilterBadge();
  }

  applyShowCompleted(value) {
    setShowCompleted(value);
    this.syncShowCompletedToggle();
    this.pagination.currentPage = 1;
    if (this.currentView === 'calendar' && this.calendarView) {
      this.calendarView.reload();
      return;
    }
    if (this.currentView === 'grid' && this.gridView) {
      this.gridView.reload();
      return;
    }
    this.loadData();
  }

  syncShowCompletedToggle() {
    const toggle = document.getElementById('kampagne-show-completed');
    if (toggle) toggle.checked = getShowCompleted();
  }

  updateToolbarFilterBadge() {
    const badge = document.getElementById('kampagne-list-plus-badge');
    if (!badge) return;
    const count = filterDropdown.getActiveFilterCount?.('kampagne') || 0;
    badge.hidden = count < 1;
    badge.textContent = count > 0 ? String(count) : '';
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('kampagne');
    return Object.keys(filters).some((key) => {
      const value = filters[key];
      return value !== null && value !== undefined && value !== '';
    }) || !!String(this.searchQuery || '').trim();
  }

  // ========================================
  // SELECTION
  // ========================================

  updateSelection() {
    const selectedCount = this.selectedKampagnen.size;
    const selectedCountElement = document.getElementById('selected-count');
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (selectBtn) {
      selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
  }

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-kampagnen');
    const individualCheckboxes = document.querySelectorAll('.kampagne-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.kampagne-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  deselectAll() {
    this.selectedKampagnen.clear();
    
    const checkboxes = document.querySelectorAll('.kampagne-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const selectAllCheckbox = document.getElementById('select-all-kampagnen');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
    console.log('✅ Alle Kampagnen-Auswahlen aufgehoben');
  }

  bindDragToScroll() {
    bindDragToScroll(this);
  }

  // ========================================
  // DELEGATION: Create & Delete (via CreateHandler)
  // ========================================

  showCreateForm() {
    window.navigateTo('/projekt-erstellen');
  }

  async handleFormSubmit() {
    return createHandler.handleFormSubmit();
  }

  showValidationErrors(errors) {
    createHandler.showValidationErrors(errors);
  }

  showSuccessMessage(message) {
    createHandler.showSuccessMessage(message);
  }

  showErrorMessage(message) {
    createHandler.showErrorMessage(message);
  }

  async transferKampagneDataToAuftragsdetails(submitData, kampagneId) {
    return createHandler.transferKampagneDataToAuftragsdetails(submitData, kampagneId);
  }

  async showDeleteSelectedConfirmation() {
    return createHandler.showDeleteSelectedConfirmation();
  }

  async deleteSelectedKampagnen() {
    return createHandler.deleteSelectedKampagnen();
  }

  // ========================================
  // CLEANUP
  // ========================================

  destroy() {
    this._isMounted = false;
    this._shellRendered = false;
    clearTimeout(this._searchDebounceTimer);
    
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    
    if (this._handlers) {
      document.removeEventListener('click', this._handlers.globalClick);
      document.removeEventListener('change', this._handlers.globalChange);
      window.removeEventListener('entityUpdated', this._handlers.entityUpdated);
      window.removeEventListener('kampagneUpdated', this._handlers.kampagneUpdated);
    }
    
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }

    destroyDragToScroll(this);
    
    if (this.calendarView) {
      this.calendarView.destroy();
      this.calendarView = null;
    }
    this.destroyGridView();
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('calendar-view-active');
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneList = new KampagneList();
