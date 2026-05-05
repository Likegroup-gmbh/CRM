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
      this.loadAndRender();
    }
  }

  async init() {
    this._isMounted = true;

    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    window.setHeadline('Contracts');

    this.pagination.init('pagination-contracts', {
      itemsPerPage: 25,
      onPageChange: () => this.loadAndRender(),
      onItemsPerPageChange: () => this.loadAndRender(),
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

    await this.loadAndRender();
  }

  async loadAndRender() {
    if (!this._isMounted) return;

    try {
      this.render();

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
      console.error('❌ ContractList.loadAndRender:', error);
    }
  }

  render() {
    const html = renderPageHtml({ searchQuery: this.searchQuery });
    window.setContentSafely(window.content, html);
    this.bindEvents();
  }

  bindEvents() {
    SearchInput.bind('contracts', (value) => this.handleSearch(value));

    document.addEventListener('click', this._handlers.globalClick, { signal: this._abortController.signal });
    window.addEventListener('entityUpdated', this._handlers.entityUpdated, { signal: this._abortController.signal });
  }

  handleSearch(query) {
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();
      this.pagination.currentPage = 1;
      this.loadAndRender();
    }, 300);
  }

  destroy() {
    this._isMounted = false;
    clearTimeout(this._searchDebounceTimer);

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }
}

export const contractList = new ContractList();
