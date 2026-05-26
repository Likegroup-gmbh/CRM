// ContractList.js
// Listenseite fuer Contracting-Auftraege

import { PaginationSystem } from '../../core/PaginationSystem.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { loadContracts } from './ContractListDataLoader.js';
import { renderPageHtml, updateTable } from './ContractListRenderers.js';

export class ContractList {
  constructor() {
    this._abortController = null;
    this._isMounted = false;
    this._shellRendered = false;
    this._searchDebounceTimer = null;
    this.searchQuery = '';

    this.pagination = new PaginationSystem();

    this._handlers = {
      globalClick: this._handleGlobalClick.bind(this),
      entityUpdated: this._handleEntityUpdated.bind(this)
    };
  }

  _handleGlobalClick(e) {
    if (e.target.id === 'btn-contract-new') {
      e.preventDefault();
      window.navigateTo('/projekt-erstellen');
      return;
    }

    const link = e.target.closest('.table-link[data-table="contracts"]');
    if (link) {
      e.preventDefault();
      window.navigateTo(`/contracts/${link.dataset.id}`);
      return;
    }

    const row = e.target.closest('.table-row-clickable[data-id]');
    if (row && !e.target.closest('a, button, input')) {
      e.preventDefault();
      window.navigateTo(`/contracts/${row.dataset.id}`);
    }
  }

  _handleEntityUpdated(e) {
    if (e.detail?.entity === 'auftrag') {
      this.loadData();
    }
  }

  async init() {
    this._isMounted = true;
    this._shellRendered = false;

    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    window.setHeadline('Contracts');

    this.pagination.init('pagination-contracts', {
      itemsPerPage: 25,
      onPageChange: () => this.loadData(),
      onItemsPerPageChange: () => this.loadData(),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    const canView = window.canViewContracts?.();
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Contracts anzuzeigen.</p>
        </div>
      `;
      return;
    }

    this.renderShell();
    await this.loadData();
  }

  renderShell() {
    if (this._shellRendered) return;
    const html = renderPageHtml({ searchQuery: this.searchQuery });
    window.setContentSafely(window.content, html);
    this._shellRendered = true;
    this.bindEvents();
  }

  async loadData() {
    if (!this._isMounted) return;

    try {
      const result = await loadContracts(
        this.pagination.currentPage,
        this.pagination.itemsPerPage,
        { searchQuery: this.searchQuery }
      );

      if (!this._isMounted) return;

      this.pagination.updateTotal(result.count);
      updateTable(result.data);
      this.pagination.render();
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('❌ ContractList.loadData:', error);
    }
  }

  bindEvents() {
    SearchInput.bind('contracts', (value) => this.handleSearch(value), this._abortController.signal);

    document.addEventListener('click', this._handlers.globalClick, { signal: this._abortController.signal });
    window.addEventListener('entityUpdated', this._handlers.entityUpdated, { signal: this._abortController.signal });
  }

  handleSearch(query) {
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();
      this.pagination.currentPage = 1;
      this.loadData();
    }, 300);
  }

  destroy() {
    this._isMounted = false;
    this._shellRendered = false;
    clearTimeout(this._searchDebounceTimer);

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }
}

export const contractList = new ContractList();
