// KampagneList.js (ES6-Modul)
// Kampagnen-Liste mit Filtersystem und Kalender-View

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { KampagneCalendarView } from './KampagneCalendarView.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { SearchInput } from '../../core/components/SearchInput.js';

import { debugLog, debounce, bindDragToScroll, destroyDragToScroll } from './KampagneListUtils.js';
import { loadKampagnenWithRelations, loadUserPermissions } from './KampagneListDataLoader.js';
import { renderPageHtml, updateTable } from './KampagneListRenderers.js';
import { KampagneCreateHandler } from './KampagneCreateHandler.js';

const createHandler = new KampagneCreateHandler();

export class KampagneList {
  constructor() {
    this.selectedKampagnen = new Set();
    this._boundEventListeners = new Set();
    this.kampagneArtMap = new Map();
    this.currentView = 'list'; // 'list' oder 'calendar'
    this.calendarView = null;
    
    // AbortController und Mount-Status für Race Condition Prevention
    this._abortController = null;
    this._isMounted = false;
    
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
        this.loadAndRender();
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
      window.navigateTo('/kampagne/new');
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
        this.loadAndRender();
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
      } else {
        this.loadAndRender();
      }
    }
  }

  _handleKampagneUpdated() {
    if (this.currentView === 'calendar' && this.calendarView) {
      this.calendarView.refresh();
    } else {
      this.loadAndRender();
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
      
      await this.render();
      
      if (!checkMounted()) return;
      
      if (this.currentView === 'list') {
        await this.initializeFilterBar();
        
        if (!checkMounted()) return;
        
        const result = await loadKampagnenWithRelations(
          this.pagination.currentPage,
          this.pagination.itemsPerPage,
          { searchQuery: this.searchQuery }
        );

        if (result.kampagneArtMap) this.kampagneArtMap = result.kampagneArtMap;

        const filteredKampagnen = result?.data ?? result ?? [];
        const totalCount = result?.count ?? filteredKampagnen.length;
        
        if (!checkMounted()) return;
        
        this.pagination.updateTotal(totalCount);
        await updateTable(filteredKampagnen, {
          bindDragToScroll: () => this.bindDragToScroll()
        });
        this.pagination.render();
      }
      
    } catch (error) {
      if (error.name === 'AbortError') return;
      window.ErrorHandler.handle(error, 'KampagneList.loadAndRender');
    }
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

    this.updateViewClass();

    if (this.currentView === 'calendar') {
      await this.initCalendarView();
    }
    
    this.bindEvents();
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

  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('kampagne', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // ========================================
  // FILTER & PAGINATION
  // ========================================

  onFiltersApplied(filters) {
    filterSystem.applyFilters('kampagne', filters);
    this.pagination.currentPage = 1;
    this._debouncedLoadAndRender();
  }

  onFiltersReset() {
    debugLog('🔄 KampagneList: Filter zurückgesetzt');
    filterSystem.resetFilters('kampagne');
    this.pagination.currentPage = 1;
    this.loadAndRender();
  }

  handlePageChange(page) {
    this.loadAndRender();
  }

  handleItemsPerPageChange(limit, page) {
    this.loadAndRender();
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
        this.calendarView.setSearchQuery(this.searchQuery);
        return;
      }
      
      this.pagination.currentPage = 1;
      this.loadAndRender();
    }, 300);
  }

  // ========================================
  // EVENTS
  // ========================================

  bindEvents() {
    SearchInput.bind('kampagne', (value) => this.handleSearch(value));

    // View-Toggle (list/calendar)
    const switchView = async (targetView) => {
      if (!this._isMounted || this.currentView === targetView) return;

      if (targetView !== 'calendar' && this.calendarView) {
        this.calendarView.destroy();
        this.calendarView = null;
      }

      this.currentView = targetView;
      this.updateViewClass();
      targetView === 'list' ? await this.loadAndRender() : await this.render();
    };

    document.getElementById('btn-view-list')?.addEventListener('click', () => switchView('list'));
    document.getElementById('btn-view-calendar')?.addEventListener('click', () => switchView('calendar'));

    if (this.currentView === 'list') {
      if (window.bulkActionSystem) {
        window.bulkActionSystem.registerList('kampagne', this);
      }
    }

    document.addEventListener('click', this._handlers.globalClick);
    document.addEventListener('change', this._handlers.globalChange);
    window.addEventListener('entityUpdated', this._handlers.entityUpdated);
    window.addEventListener('kampagneUpdated', this._handlers.kampagneUpdated);
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('kampagne');
    return Object.keys(filters).length > 0;
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
    createHandler.showCreateForm();
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
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('calendar-view-active');
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneList = new KampagneList();
