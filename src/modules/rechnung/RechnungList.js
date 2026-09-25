// RechnungList.js – Orchestrator for the Rechnung list page.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { ALL_TAB, UNDATED_TAB, getCurrentMonthSelection, parseMonthTab } from '../auftrag/logic/InvoiceMonthFilter.js';
import { renderInvoiceMonthSheet, updateInvoiceMonthTabUI } from '../auftrag/logic/InvoiceMonthSheet.js';
import { ENTITY_RECHNUNG, getRechnungTabKey, hydrateRechnungPdfs, loadCounts, loadRows } from './Monatsblatt.js';
import { loadKooperationCreatorKosten } from './creatorKostenSumme.js';
import { loadRechnungMitarbeiterScope, clearRechnungMitarbeiterScope } from './RechnungMitarbeiterScope.js';
import { renderPageShell, updateTableRows, updateSingleRow, updateStatusTabCounts, patchPdfCells, updateInvoiceSummary } from './RechnungListRenderer.js';
import { bindRechnungListEvents } from './RechnungListEvents.js';
import { RechnungListSelection } from './RechnungListSelection.js';
import * as QuickFilter from './RechnungUnternehmenQuickFilter.js';
import * as SortFilter from './RechnungSortQuickFilter.js';

export { getRechnungTabKey };

const STATUS_OPTIONS = [
  { id: 'Offen', name: 'Offen' }, { id: 'Rückfrage', name: 'Rückfrage' },
  { id: 'Bezahlt', name: 'Bezahlt' }, { id: 'An Qonto gesendet', name: 'An Qonto gesendet' },
  { id: 'Marc an Qonto gesendet', name: 'Marc an Qonto gesendet' }
];
const STATUS_TABS = [{ id: 'alle', label: 'Alle' }, ...STATUS_OPTIONS.map(o => ({ id: o.id, label: o.name }))];
const TYPE_TABS = [{ id: 'rechnung', label: 'Rechnungen' }, { id: 'contracting', label: 'Contracts' }];

export class RechnungList {
  _abortController = null;

  constructor() {
    this.selection = new RechnungListSelection();
    this.rechnungen = [];
    this._notizMap = new Map();
    this._bezahltUpdateInFlight = new Set();
    this.activeStatusTab = 'alle';
    this.activeTypeTab = 'rechnung';
    this.sortBy = SortFilter.DEFAULT_SORT;
    this.resetToCurrentMonth();
    this.searchQuery = '';
    this._searchDebounceTimer = null;
    this._blattCounts = { months: { undated: 0, alle: 0, months: Array(12).fill(0) }, type: { rechnung: 0, contracting: 0 } };
    this._loadRequestId = 0;
    this._creatorKostenSumme = 0;
    this._creatorKostenKey = null;
  }

  get statusOptions() { return STATUS_OPTIONS; }
  get statusTabs() { return STATUS_TABS; }
  get typeTabs() { return TYPE_TABS; }

  resetToCurrentMonth() {
    const { year, month } = getCurrentMonthSelection();
    this.currentYear = year;
    this.currentMonth = month;
  }

  // ═══════════════════════════ Lifecycle ═══════════════════

  async init() {
    this.resetToCurrentMonth();
    window.setHeadline('Rechnungen');
    window.bulkActionSystem?.registerList('rechnung', this);
    await this.loadAndRender();
    this._abortController?.abort();
    this._abortController = new AbortController();
    bindRechnungListEvents(this, this._abortController.signal);
  }

  destroy() {
    clearTimeout(this._searchDebounceTimer);
    this._abortController?.abort();
    this._abortController = null;
    clearRechnungMitarbeiterScope();
  }

  // ═══════════════════════════ Render ══════════════════════

  async render() {
    window.setContentSafely(window.content, renderPageShell({
      isAdmin: window.isAdmin(),
      canEdit: !!window.currentUser?.permissions?.rechnung?.can_edit,
      searchQuery: this.searchQuery,
      statusTabs: STATUS_TABS, typeTabs: TYPE_TABS,
      activeStatusTab: this.activeStatusTab, activeTypeTab: this.activeTypeTab,
      monthSheetHtml: this.renderMonthSheet()
    }));
  }

  renderMonthSheet() {
    return renderInvoiceMonthSheet({
      rootId: 'rechnung-month-tabs', yearSelectId: 'rechnung-year-select',
      year: this.currentYear, month: this.currentMonth
    });
  }

  // ═══════════════════════════ Data load ═══════════════════

  async loadAndRender() {
    try {
      const isReload = Boolean(document.getElementById('rechnungen-table-body'));
      if (!isReload) await this.render();
      else TableAnimationHelper.showLoadingOverlay(document.getElementById('rechnungen-table-body'));
      this.initializeFilterBar();
      await this.reloadBlatt({ withCounts: true, firstPaint: !isReload });
    } catch (error) {
      window.ErrorHandler?.handle?.(error, 'RechnungList.loadAndRender');
    }
  }

  _blattOpts() {
    const rawFilters = filterSystem.getFilters('rechnung');
    const { unternehmen_ids, ...filters } = rawFilters;
    if (Array.isArray(unternehmen_ids) && unternehmen_ids.length > 0) filters.unternehmen_ids = unternehmen_ids;
    return { entity: ENTITY_RECHNUNG, year: this.currentYear, month: this.currentMonth,
      filters, search: this.searchQuery, typeTab: this.activeTypeTab, statusIds: STATUS_TABS.map(t => t.id),
      sortBy: this.sortBy };
  }

  async reloadBlatt({ withCounts = false, firstPaint = false } = {}) {
    const requestId = ++this._loadRequestId;
    this.updateMonthTabUI();
    const tbody = document.getElementById('rechnungen-table-body');
    if (!firstPaint) TableAnimationHelper.showLoadingOverlay(tbody);

    const opts = this._blattOpts();
    if (!window.isAdmin() && window.isMitarbeiter()) opts.allowed = await loadRechnungMitarbeiterScope();

    const [{ rows }, creatorKosten] = await Promise.all([
      loadRows(opts),
      this._loadCreatorKosten(opts)
    ]);
    if (requestId !== this._loadRequestId) return;
    this.rechnungen = rows;
    this._creatorKostenSumme = creatorKosten;
    await this.updateTable(this.getFilteredRechnungen(), { animate: !firstPaint });
    this._loadNotizen();
    this._hydratePdfs(requestId);
    if (withCounts) this._hydrateCounts(opts, requestId);
    else this.updateStatusTabCounts();
  }

  async _hydratePdfs(requestId) {
    try {
      await hydrateRechnungPdfs(this.rechnungen);
      if (requestId !== this._loadRequestId) return;
      patchPdfCells(this.rechnungen);
    } catch (error) { console.warn('⚠️ Rechnung-PDFs nachladen fehlgeschlagen:', error); }
  }

  async _hydrateCounts(opts, requestId) {
    try {
      const counts = await loadCounts(opts);
      if (requestId !== this._loadRequestId) return;
      this._blattCounts = counts;
      this.updateMonthTabUI();
      this.updateStatusTabCounts();
    } catch (error) {
      console.warn('⚠️ Monatsblatt-Counts fehlgeschlagen:', error);
      this.updateStatusTabCounts();
    }
  }

  async _loadNotizen() {
    this._notizMap.clear();
    if (window.isKunde()) return;
    const ids = (this.rechnungen || []).filter(r => r.status === 'Rückfrage').map(r => r.id);
    if (!ids.length) return;
    try {
      const { data } = await window.supabase.from('rechnung_notizen').select('rechnung_id').in('rechnung_id', ids);
      for (const row of (data || [])) this._notizMap.set(row.rechnung_id, true);
    } catch (err) { console.warn('⚠️ Notizen laden fehlgeschlagen:', err?.message); }
  }

  // ═══════════════════════════ Table / tabs ════════════════

  getFilteredRechnungen() {
    if (this.activeStatusTab === 'alle') return this.rechnungen || [];
    return (this.rechnungen || []).filter(r => r.status === this.activeStatusTab);
  }

  async _loadCreatorKosten(opts) {
    const key = JSON.stringify({
      unternehmen: opts.filters?.unternehmen_ids || [],
      koops: opts.allowed?.koopIds || null
    });
    if (key === this._creatorKostenKey) return this._creatorKostenSumme;
    if (this._creatorKostenPromise?.key === key) return this._creatorKostenPromise.promise;

    this._creatorKostenKeyWanted = key;
    const promise = loadKooperationCreatorKosten({
      allowed: opts.allowed,
      unternehmenIds: opts.filters?.unternehmen_ids
    }).then(summe => {
      if (this._creatorKostenKeyWanted !== key) return summe;
      this._creatorKostenSumme = summe;
      this._creatorKostenKey = key;
      return summe;
    }).catch(error => {
      console.warn('⚠️ Creator-Kosten konnten nicht geladen werden:', error);
      return this._creatorKostenSumme || 0;
    });
    this._creatorKostenPromise = { key, promise };
    return promise;
  }

  async updateTable(rechnungen, { animate = false } = {}) {
    await updateTableRows(rechnungen, {
      isAdmin: window.isAdmin(), statusOptions: STATUS_OPTIONS,
      activeStatusTab: this.activeStatusTab, activeTypeTab: this.activeTypeTab,
      currentMonth: this.currentMonth, currentYear: this.currentYear,
      notizMap: this._notizMap, hasActiveFilters: this.hasActiveFilters(),
      animate,
      creatorKosten: this._creatorKostenSumme
    });
    this.selection.bind(this.rechnungen);
  }

  handleSingleRowUpdate(id, newStatus) {
    updateSingleRow(id, newStatus, {
      rechnungen: this.rechnungen, statusOptions: STATUS_OPTIONS,
      activeStatusTab: this.activeStatusTab, statusTabs: STATUS_TABS,
      blattCounts: this._blattCounts, typeTabs: TYPE_TABS,
      reloadCallback: () => this.loadAndRender()
    });
    updateInvoiceSummary(this.getFilteredRechnungen(), { creatorKosten: this._creatorKostenSumme });
  }

  updateStatusTabCounts() { updateStatusTabCounts(this.rechnungen, STATUS_TABS, this._blattCounts, TYPE_TABS); }

  updateMonthTabUI() {
    updateInvoiceMonthTabUI({
      rootId: 'rechnung-month-tabs', yearSelectId: 'rechnung-year-select',
      year: this.currentYear, month: this.currentMonth,
      counts: this._blattCounts?.months || { undated: 0, alle: 0, months: Array(12).fill(0) }
    });
  }

  // ═══════════════════════════ Navigation ══════════════════

  selectInvoiceMonth(tab) {
    const next = parseMonthTab(tab);
    if (Number.isNaN(next) && next !== UNDATED_TAB && next !== ALL_TAB) return;
    if (next === this.currentMonth) return;
    this.currentMonth = next;
    this.updateMonthTabUI();
    this.reloadBlatt({ withCounts: false });
  }

  selectInvoiceYear(year) {
    const nextYear = parseInt(year, 10);
    if (Number.isNaN(nextYear) || nextYear === this.currentYear) return;
    this.currentYear = nextYear;
    this.updateMonthTabUI();
    this.reloadBlatt({ withCounts: true });
  }

  // ═══════════════════════════ Filters ═════════════════════

  handleSearch(query) {
    clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();
      this.reloadBlatt({ withCounts: true });
    }, 300);
  }

  async initializeFilterBar() {
    const container = document.getElementById('filter-dropdown-container');
    if (!container) return;
    SearchInput.bind('rechnung', (value) => this.handleSearch(value));
    await filterDropdown.init('rechnung', container, {
      onFilterApply: (filters) => this.onFiltersApplied(filters),
      onFilterReset: () => this.onFiltersReset()
    });
    await QuickFilter.initializeQuickFilter(document.getElementById('rechnung-unternehmen-filter-container'));
    SortFilter.initializeSortFilter(document.getElementById('rechnung-sort-filter-container'), this.sortBy);
  }

  setSortBy(sortBy) {
    if (!SortFilter.SORT_OPTIONS.some(o => o.id === sortBy)) return;
    if (sortBy === this.sortBy) return;
    this.sortBy = sortBy;
    SortFilter.syncUI(this.sortBy);
    this.reloadBlatt({ withCounts: false });
  }

  onFiltersApplied(filters) {
    const ids = QuickFilter.getSelectedIds();
    const merged = { ...(filters || {}) };
    if (ids.length > 0) merged.unternehmen_ids = ids;
    filterSystem.applyFilters('rechnung', merged);
    this.loadAndRender();
    QuickFilter.syncUI();
  }

  onFiltersReset() {
    filterSystem.resetFilters('rechnung');
    this.loadAndRender();
    QuickFilter.syncUI();
  }

  hasActiveFilters() { return Object.keys(filterSystem.getFilters('rechnung')).length > 0; }

  applyUnternehmenQuickFilter(selectedIds) {
    QuickFilter.applyQuickFilter(selectedIds, () => this.loadAndRender());
  }
}

export const rechnungList = new RechnungList();
