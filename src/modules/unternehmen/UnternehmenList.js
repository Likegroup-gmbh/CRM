// UnternehmenList.js (ES6-Modul)
// Unternehmen-Liste: Orchestrierung. Daten, Zeilen, Create und Mitarbeiter-Filter liegen daneben.

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { MarkeService } from '../marke/services/MarkeService.js';
import { unternehmenCreate } from './UnternehmenCreate.js';
import {
  loadUnternehmenPage,
  loadAnsprechpartnerMap,
  loadMitarbeiterMap,
  loadMarkenMap,
  loadMarkeMitarbeiterMap
} from './UnternehmenListQueries.js';
import {
  renderUnternehmenRow,
  renderNestedMarkeRow,
  renderRowGroup
} from './UnternehmenListRows.js';
import {
  initializeMitarbeiterQuickFilter,
  bindMitarbeiterQuickFilterEvents,
  getSelectedMitarbeiterFilterIds,
  syncMitarbeiterQuickFilterUI
} from './UnternehmenListMitarbeiterFilter.js';

export class UnternehmenList extends BasePaginatedList {
  constructor() {
    super('unternehmen', {
      itemsPerPage: 25,
      headline: 'Unternehmen Übersicht',
      breadcrumbLabel: 'Unternehmen',
      sortField: 'firmenname',
      sortAscending: true,
      paginationContainerId: 'pagination-unternehmen',
      tbodySelector: '.data-table tbody',
      tableColspan: 11, // Mit Admin-Checkbox
      checkboxClass: 'unternehmen-check',
      selectAllId: 'select-all-unternehmen'
    });

    this.selectedUnternehmen = this.selectedItems;

    this._allowedUnternehmenIds = null;
    this._mitarbeiterQuickFilterOptions = [];
    this._expandedIds = new Set();
    this._matchedMarkeIds = new Set();
    this._unternehmenRows = [];
  }

  get canCreateMarke() {
    return window.isAdmin() || window.currentUser?.permissions?.marke?.can_edit || false;
  }

  getEmptyState() {
    const canEdit = window.isAdmin?.() || window.currentUser?.permissions?.unternehmen?.can_edit;
    return {
      icon: 'building',
      title: 'Keine Unternehmen vorhanden',
      text: canEdit
        ? 'Legen Sie Ihr erstes Unternehmen an, um loszulegen.'
        : 'Es sind noch keine Unternehmen für Sie freigegeben.',
      actionsHtml: canEdit ? '<button id="btn-unternehmen-new" class="mdc-btn">Neues Unternehmen anlegen</button>' : ''
    };
  }

  resetEntityCaches() {
    console.log('🔄 UNTERNEHMENLISTE: Cache zurückgesetzt');
    this._allowedUnternehmenIds = null;
  }

  async loadPageData(page, limit, filters) {
    return loadUnternehmenPage({
      page,
      limit,
      filters,
      sort: this.currentSort,
      isAdmin: this.isAdmin
    });
  }

  _rowCtx() {
    return {
      sanitize: (value) => this.sanitize(value),
      canBulkDelete: this.canBulkDelete,
      expandedIds: this._expandedIds,
      matchedMarkeIds: this._matchedMarkeIds
    };
  }

  renderSingleRow(u) {
    return renderUnternehmenRow(u, this._rowCtx());
  }

  renderShellContent() {
    const canBulkDelete = this.canBulkDelete;
    const canEdit = this.canEdit;

    return `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render('unternehmen', {
              placeholder: 'Unternehmen suchen...',
              currentValue: this.searchQuery
            })}
            <div id="sort-dropdown-container"></div>
            <div id="filter-dropdown-container"></div>
            <div id="unternehmen-mitarbeiter-filter-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
          <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>` : ''}
          ${canEdit ? '<button id="btn-unternehmen-new" class="mdc-btn">Neues Unternehmen anlegen</button>' : ''}
          ${this.canCreateMarke ? '<button id="btn-marke-new" class="mdc-btn">Neue Marke anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table data-table--unternehmen">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-unternehmen"></th>` : ''}
              <th class="col-name">Name</th>
              <th class="col-stadt">Stadt</th>
              <th class="col-land">Land</th>
              <th class="col-webseite table-cell-center">Webseite</th>
              <th class="col-branche">Branche</th>
              <th class="col-ansprechpartner">Ansprechpartner</th>
              <th class="col-mitarbeiter">Management</th>
              <th class="col-mitarbeiter">Lead</th>
              <th class="col-mitarbeiter">Mitarbeiter</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${canBulkDelete ? '11' : '10'}" class="no-data">Lade Unternehmen...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-container" id="pagination-unternehmen"></div>
    `;
  }

  async initializeFilterBar() {
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('unternehmen', sortContainer, {
        nameField: 'firmenname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }

    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('unternehmen', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }

    await initializeMitarbeiterQuickFilter(this);
  }

  bindAdditionalEvents(signal) {
    SearchInput.bind('unternehmen', (value) => this.handleSearch(value), signal);

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-unternehmen-new' || e.target.id === 'btn-unternehmen-new-filter') {
        e.preventDefault();
        window.navigateTo('/unternehmen/new');
      }
      if (e.target.id === 'btn-marke-new') {
        e.preventDefault();
        window.navigateTo('/marke/new');
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.unternehmen-marken-toggle');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleMarken(toggle);
        return;
      }

      const markeLink = e.target.closest('a.table-link[data-table="marke"]');
      if (markeLink?.dataset.id) {
        e.preventDefault();
        window.navigateTo(`/marke/${markeLink.dataset.id}`);
      }
    }, { signal });

    bindMitarbeiterQuickFilterEvents(this, signal);
  }

  onFiltersApplied(filters) {
    const selectedMitarbeiterIds = getSelectedMitarbeiterFilterIds();
    const mergedFilters = { ...(filters || {}) };
    if (selectedMitarbeiterIds.length > 0) {
      mergedFilters.mitarbeiter_ids = selectedMitarbeiterIds;
    }
    super.onFiltersApplied(mergedFilters);
    syncMitarbeiterQuickFilterUI(this);
  }

  onFiltersReset() {
    super.onFiltersReset();
    syncMitarbeiterQuickFilterUI(this);
  }

  async updateTable(unternehmen) {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!unternehmen || unternehmen.length === 0) {
        this.renderEmptyTable(tbody);
        return;
      }

      const unternehmenIds = unternehmen.map(u => u.id).filter(Boolean);
      const [apMap, mitarbeiterMap, markenMap] = await Promise.all([
        loadAnsprechpartnerMap(unternehmenIds),
        loadMitarbeiterMap(unternehmenIds),
        loadMarkenMap(unternehmenIds)
      ]);

      let allowedMarkeIds = null;
      if (!this.isAdmin && !window.isUnscoped?.()) {
        allowedMarkeIds = new Set(
          await MarkeService.getAllowedMarkeIdsForUser(window.currentUser?.id) || []
        );
      }

      unternehmen.forEach(u => {
        u._ansprechpartner = apMap.get(u.id) || [];
        u._mitarbeiter = mitarbeiterMap.get(u.id) || [];
        const marken = markenMap.get(u.id) || [];
        u._marken = allowedMarkeIds
          ? marken.filter(m => allowedMarkeIds.has(m.id))
          : marken;
      });

      const visibleMarkeIds = unternehmen.flatMap(u => u._marken || []).map(m => m.id).filter(Boolean);
      const markeMitarbeiterMap = await loadMarkeMitarbeiterMap(visibleMarkeIds);
      unternehmen.forEach(u => {
        (u._marken || []).forEach(m => {
          m._mitarbeiter = markeMitarbeiterMap.get(m.id) || [];
        });
      });

      this._applySearchExpand(unternehmen);
      this._unternehmenRows = unternehmen;
      this._renderRows();
    });
  }

  _applySearchExpand(unternehmen) {
    const q = (this.searchQuery || '').trim().toLowerCase();
    this._matchedMarkeIds = new Set();
    if (!q) {
      this._expandedIds = new Set();
      return;
    }
    const parents = new Set();
    for (const u of unternehmen) {
      for (const m of u._marken || []) {
        if ((m.markenname || '').toLowerCase().includes(q)) {
          this._matchedMarkeIds.add(m.id);
          parents.add(u.id);
        }
      }
    }
    this._expandedIds = parents;
  }

  _renderRows() {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;
    tbody.innerHTML = this._unternehmenRows.map(u => renderRowGroup(u, this._rowCtx())).join('');
    tbody.querySelectorAll(`.${this.options.checkboxClass}`).forEach(cb => {
      if (cb.dataset.id && this.selectedItems.has(cb.dataset.id)) cb.checked = true;
    });
    this.updateSelection();
    this.updateSelectAllCheckbox();
  }

  _toggleMarken(toggle) {
    const id = toggle.dataset.id;
    if (!id) return;
    const parentTr = toggle.closest('tr');
    const u = this._unternehmenRows.find(row => String(row.id) === String(id));
    if (!parentTr || !u) return;

    if (this._expandedIds.has(id)) {
      this._expandedIds.delete(id);
      [...parentTr.parentElement.querySelectorAll('.nested-marke-row')]
        .filter(row => row.dataset.parentId === id)
        .forEach(row => row.remove());
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Marken aufklappen');
      return;
    }

    this._expandedIds.add(id);
    parentTr.insertAdjacentHTML(
      'afterend',
      (u._marken || []).map(m => renderNestedMarkeRow(m, id, this._rowCtx())).join('')
    );
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Marken einklappen');
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('unternehmen');
    return Object.keys(filters).length > 0;
  }

  showCreateForm() {
    unternehmenCreate.showCreateForm();
  }
}

export const unternehmenList = new UnternehmenList();
