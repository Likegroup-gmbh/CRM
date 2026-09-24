// CreatorListCore.js
// Klasse, Datenladen, View-Switch und Filter-Bau fuer CreatorList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { CreatorGridView } from './CreatorGridView.js';

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

    // View-Switch (Liste/Grid) mit separater Persistenz pro Modus
    this._viewStorageKey = `creator-view-mode-${this.mode}`;
    this.viewMode = this._readStoredViewMode(); // 'grid' (Default) | 'list'
    this.gridView = new CreatorGridView(this);

    // Getrennte Zustände: welche Ansicht wurde mit welchen Kriterien geladen
    this._listLoadedOnce = false;
    this._gridLoadedOnce = false;
    this._listSignature = null;

    // Referenz auf Basis-loadData, um aus der Override heraus die Tabellen-Logik
    // aufrufen zu können.
    this._superLoadData = BasePaginatedList.prototype.loadData.bind(this);
  }

  _readStoredViewMode() {
    try {
      const stored = window.localStorage?.getItem(this._viewStorageKey);
      return stored === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  }

  _computeSignature() {
    try {
      return JSON.stringify(this.buildFilters());
    } catch {
      return String(Date.now());
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Lädt die Creator-Daten für eine Seite
   */
  async loadPageData(page, limit, filters) {
    // Management-Modus: nur Creator mit aktiver Management-Verknüpfung laden
    if (this.mode === 'management' && window.supabase) {
      const ids = await this.loadManagementCreatorIds();
      if (!ids || ids.length === 0) {
        return { data: [], total: 0 };
      }
      filters._allowedIds = ids;
    }

    const result = await window.dataService.loadEntitiesWithPagination(
      'creator',
      filters,
      page,
      limit
    );

    return {
      data: result.data || [],
      total: result.total || 0
    };
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

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW-SWITCH (LISTE / GRID)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Override: lädt die aktuell aktive Ansicht. Die jeweils inaktive Ansicht
   * wird dadurch veraltet und beim nächsten Wechsel neu synchronisiert.
   */
  async loadData() {
    if (this.viewMode === 'grid') {
      this._gridLoadedOnce = true;
      await this.gridView.reload();
      return;
    }
    this._listLoadedOnce = true;
    await this._superLoadData();
    this._listSignature = this._computeSignature();
  }

  /**
   * Soft-Update nach Connect/Refresh: nur die betroffene Grid-Karte ersetzen,
   * damit die Scroll-Position nicht nach oben springt.
   * @returns {Promise<boolean>} true = Full-Reload unterdrücken
   */
  async loadMoreForScroll() {
    if (this.viewMode !== 'grid' || !this.gridView) return false;
    return this.gridView.loadMoreForScroll();
  }

  async handleEntityUpdated(detail) {
    if (this.viewMode !== 'grid') return false;
    if (!detail?.id) return false;

    const action = detail.action || '';
    if (action === 'deleted' || action === 'bulk-deleted' || action === 'created') {
      return false;
    }

    return this.gridView.refreshCard(detail.id);
  }

  switchView(mode) {
    if (mode !== 'grid' && mode !== 'list') return;
    if (mode === this.viewMode) return;

    this.viewMode = mode;
    try { window.localStorage?.setItem(this._viewStorageKey, mode); } catch { /* ignore */ }

    this._applyViewVisibility();
    this._updateViewToggleButtons();

    const needsLoad = mode === 'grid'
      ? (!this._gridLoadedOnce || this.gridView.isStale())
      : (!this._listLoadedOnce || this._listSignature !== this._computeSignature());

    if (needsLoad) {
      this.loadData();
    }
  }

  _applyViewVisibility() {
    const root = document.getElementById(`creator-views-${this.mode}`);
    if (root) {
      root.classList.toggle('view-grid', this.viewMode === 'grid');
      root.classList.toggle('view-list', this.viewMode === 'list');
    }
  }

  _updateViewToggleButtons() {
    const listBtn = document.getElementById('btn-view-list');
    const gridBtn = document.getElementById('btn-view-grid');
    listBtn?.classList.toggle('active', this.viewMode === 'list');
    gridBtn?.classList.toggle('active', this.viewMode === 'grid');
  }

  destroy() {
    this.gridView?.destroy();
    this._listLoadedOnce = false;
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

    return filters;
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('creator');
    return Object.keys(filters).length > 0;
  }
}
