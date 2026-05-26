// AuftragListCore.js
// Kern-Klasse fuer die Auftrags-Liste
// Methoden werden via Prototype-Mixins aus Formatters, DataLoader, Renderers und Events hinzugefuegt

import { SearchInput } from '../../core/components/SearchInput.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { AuftragCashFlowCalendar } from './AuftragCashFlowCalendar.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

const VIEW_LIST_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" /></svg>`;
const VIEW_CAL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;

export class AuftragList {
  constructor() {
    this.selectedAuftraege = new Set();
    this._boundEventListeners = new Set();
    this.boundFilterResetHandler = null;
    this.pagination = new PaginationSystem();
    this.contractsPagination = new PaginationSystem();
    this.currentView = 'list';
    this.activeTab = 'auftraege';
    this.cashFlowCalendar = null;
    this._auftragNewBound = false;
    this._globalEventsBound = false;
    this._inlineDatePickerCleanup = null;
    this._isAdmin = null;
    this._isKunde = null;
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.statusOptions = [
      { id: 'Beauftragt', name: 'Beauftragt' },
      { id: 'Abgeschlossen', name: 'Abgeschlossen' },
      { id: 'Storniert', name: 'Storniert' }
    ];
    this.dragScrollContainer = null;
    this._dragToScrollCleanup = null;

    this.searchQuery = '';
    this.contractsSearchQuery = '';
    this._searchDebounceTimer = null;
    this._contractsSearchDebounceTimer = null;
    this._shellRendered = false;
  }

  get isAdmin() {
    if (this._isAdmin === null) {
      this._isAdmin = window.isAdmin();
    }
    return this._isAdmin;
  }

  get isKunde() {
    if (this._isKunde === null) {
      this._isKunde = window.isKunde();
    }
    return this._isKunde;
  }

  invalidateAdminCache() {
    this._isAdmin = null;
    this._isKunde = null;
  }

  _getSortField() {
    return 'angebotsnummer';
  }

  async init() {
    if (this._pendingTab) {
      this.activeTab = this._pendingTab;
      this._pendingTab = null;
    }

    this.pagination.init('pagination-auftrag', {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    try {
      window.bulkActionSystem?.registerList('auftrag', this);

      if (this.isKunde && window.supabase) {
        const { count } = await window.supabase
          .from('kunde_marke')
          .select('*', { count: 'exact', head: true })
          .eq('kunde_id', window.currentUser.id);
        this._kundeHasMultipleMarken = (count || 0) > 1;
      } else {
        this._kundeHasMultipleMarken = false;
      }

      await this.loadAndRender();
      this.bindEvents();
      this.refreshInactiveTabCount();
    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'AuftragList.init');
    }
  }

  async loadAndRender() {
    try {
      if (!this._shellRendered) {
        await this.render();
        this.bindEvents();
      }

      if (this.currentView === 'calendar' && this.activeTab !== 'contracts') {
        return;
      }

      const tbody = document.querySelector('.data-table tbody');
      TableAnimationHelper.showLoadingOverlay(tbody);

      if (this.activeTab === 'contracts') {
        this.contractsPagination.init('pagination-auftrag', {
          itemsPerPage: 25,
          onPageChange: () => this.loadContractsData(),
          onItemsPerPageChange: () => this.loadContractsData(),
          dynamicResize: true,
          tbodySelector: '.data-table tbody'
        });
        await this.loadContractsData();
        return;
      }

      if (!this._shellRendered) {
        await this.initializeFilterBar();
      }
      await this.loadAuftraegeData();

    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler beim Laden und Rendern:', error);
      const tbodyError = document.querySelector('.data-table tbody');
      TableAnimationHelper.hideLoadingOverlay(tbodyError);
      if (window.ErrorHandler?.handle) {
        window.ErrorHandler.handle(error, 'AuftragList.loadAndRender');
      }
    }
  }

  handlePageChange(page) {
    this.loadAuftraegeData();
  }

  handleItemsPerPageChange(limit, page) {
    this.loadAuftraegeData();
  }

  async render() {
    window.setHeadline('Aufträge');

    const isContracts = this.activeTab === 'contracts';
    const viewToggleDisabled = isContracts ? 'disabled' : '';

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-list" class="secondary-btn ${this.currentView === 'list' ? 'active' : ''}" ${viewToggleDisabled}>${VIEW_LIST_ICON} Liste</button>
            <button id="btn-view-calendar" class="secondary-btn ${this.currentView === 'calendar' ? 'active' : ''}" ${viewToggleDisabled}>${VIEW_CAL_ICON} Kalender</button>
          </div>
        </div>
      </div>

      <div id="page-tab-content"></div>
    `;

    window.setContentSafely(window.content, html);
    this._shellRendered = true;

    this.renderAuftraegeContent();
    if (!isContracts && this.currentView === 'calendar') {
      await this.initCashFlowCalendar();
    }
  }

  renderTabNavigation() {
    if (!window.canViewContracts?.()) return '';
    const isContracts = this.activeTab === 'contracts';
    return `
      <div class="tab-navigation auftrag-tabs">
        <button class="tab-button ${!isContracts ? 'active' : ''}" data-tab="auftraege">
          Aufträge<span class="tab-count" data-tab-count="auftraege">0</span>
        </button>
        <button class="tab-button ${isContracts ? 'active' : ''}" data-tab="contracts">
          Contracts<span class="tab-count" data-tab-count="contracts">0</span>
        </button>
      </div>
    `;
  }

  renderAuftraegeContent() {
    const container = document.getElementById('page-tab-content');
    if (!container) return;

    const isContracts = this.activeTab === 'contracts';

    if (this.currentView === 'calendar') {
      container.innerHTML = `
        <div id="auftrag-content-container">
          <div id="calendar-container"></div>
        </div>
      `;
      return;
    }

    const filterDropdownStyle = isContracts ? 'style="display:none;"' : '';
    const placeholder = isContracts ? 'Contract suchen...' : 'Auftrag suchen...';

    container.innerHTML = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render('auftrag', {
              placeholder,
              currentValue: this.searchQuery
            })}
            ${!this.isKunde ? `<div id="filter-dropdown-container" ${filterDropdownStyle}></div>` : ''}
          </div>
        </div>
        <div class="table-actions">
          ${this.isAdmin ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
          ${this.isAdmin ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          ${this.isAdmin ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
        </div>
      </div>

      ${this.renderTabNavigation()}

      <div id="auftrag-table-wrapper">
        ${this.renderListView(isContracts ? 'contracts' : 'auftraege')}
      </div>
    `;
  }

  updateTabCount(tab, count) {
    const el = document.querySelector(`[data-tab-count="${tab}"]`);
    if (el) el.textContent = count ?? 0;
  }

  // Tab-Wechsel: nur tbody + CSS-Klasse aktualisieren (kein DOM-Neuaufbau)
  async switchTab(tab) {
    if (this.activeTab === tab) return;

    this.activeTab = tab;

    document.querySelectorAll('.auftrag-tabs .tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.querySelectorAll('.view-toggle .secondary-btn').forEach(b => {
      b.disabled = (tab === 'contracts');
    });

    const filterDropdownContainer = document.getElementById('filter-dropdown-container');
    if (filterDropdownContainer) {
      filterDropdownContainer.style.display = (tab === 'contracts') ? 'none' : '';
    }

    if (tab === 'contracts') {
      ['btn-deselect-all', 'btn-delete-selected'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = 'none';
      });
      const counter = document.getElementById('selected-count');
      if (counter) counter.style.display = 'none';
      this.selectedAuftraege.clear();
    }

    const searchInput = document.querySelector('input[name="auftrag-search"], #auftrag-search-input, input[data-search-key="auftrag"]');
    if (searchInput) {
      searchInput.placeholder = (tab === 'contracts') ? 'Contract suchen...' : 'Auftrag suchen...';
    }

    const table = document.querySelector('#auftrag-table-container .data-table');
    if (table) {
      table.classList.toggle('contracts-table', tab === 'contracts');
    }

    // Alte Daten gedimmt lassen (wie bei Rechnungen), kein Loading-Text-Sprung
    const tbody = document.getElementById('auftraege-table-body');
    TableAnimationHelper.showLoadingOverlay(tbody);

    if (tab === 'contracts') {
      if (this.cashFlowCalendar) {
        this.cashFlowCalendar.destroy();
        this.cashFlowCalendar = null;
      }
      this.contractsPagination.init('pagination-auftrag', {
        itemsPerPage: 25,
        onPageChange: () => this.loadContractsData(),
        onItemsPerPageChange: () => this.loadContractsData(),
        dynamicResize: true,
        tbodySelector: '.data-table tbody'
      });
      await this.loadContractsData();
    } else {
      this.pagination.init('pagination-auftrag', {
        itemsPerPage: 25,
        onPageChange: (page) => this.handlePageChange(page),
        onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
        dynamicResize: true,
        tbodySelector: '.data-table tbody'
      });
      await this.loadAuftraegeData();
    }
  }

  async initCashFlowCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) {
      console.error('❌ Calendar-Container nicht gefunden');
      return;
    }

    this.cashFlowCalendar = new AuftragCashFlowCalendar();
    await this.cashFlowCalendar.init(container);
  }

  showCreateForm() {
    window.navigateTo('/projekt-erstellen');
  }

  destroy() {
    this._shellRendered = false;
    clearTimeout(this._searchDebounceTimer);
    clearTimeout(this._contractsSearchDebounceTimer);

    if (this.pagination) {
      this.pagination.destroy();
    }
    if (this.contractsPagination) {
      this.contractsPagination.destroy();
    }

    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();

    if (this._globalClickHandler) {
      document.removeEventListener('click', this._globalClickHandler);
      this._globalClickHandler = null;
    }
    if (this._globalChangeHandler) {
      document.removeEventListener('change', this._globalChangeHandler);
      this._globalChangeHandler = null;
    }
    if (this._entityUpdatedHandler) {
      window.removeEventListener('entityUpdated', this._entityUpdatedHandler);
      this._entityUpdatedHandler = null;
    }
    if (this._inlineDatePickerCleanup) {
      this._inlineDatePickerCleanup();
      this._inlineDatePickerCleanup = null;
    }
    if (this._dragToScrollCleanup) {
      this._dragToScrollCleanup();
      this._dragToScrollCleanup = null;
    }

    this._globalEventsBound = false;
    this._auftragNewBound = false;
    this._isAdmin = null;

    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }
}
