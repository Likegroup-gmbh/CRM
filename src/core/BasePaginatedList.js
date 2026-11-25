// BasePaginatedList.js (ES6-Modul)
// Abstrakte Basisklasse für alle paginierten Listen
// Bietet einheitliche Pagination, Race-Condition Prevention, Debouncing und Shell-Pattern

import { PaginationSystem } from './PaginationSystem.js';
import { TableAnimationHelper } from './TableAnimationHelper.js';
import { modularFilterSystem as filterSystem } from './filters/ModularFilterSystem.js';
import { getSearchConfig } from './config/ListSearchConfig.js';
import { bindEmptyStateActions } from './components/EmptyState.js';
import { renderEmptyRow, renderErrorRow } from './list/tableStates.js';
import { ListScope } from './list/ListScope.js';
import { createLatestOnly, STALE } from './list/latestOnly.js';
import { TableSelection } from './list/TableSelection.js';

/**
 * Abstrakte Basisklasse für paginierte Listen
 * Konsolidiert Boilerplate-Code aus allen *List.js Modulen
 * 
 * @example
 * class MarkeList extends BasePaginatedList {
 *   constructor() {
 *     super('marke', {
 *       itemsPerPage: 10,
 *       headline: 'Marken Übersicht',
 *       breadcrumbLabel: 'Marke'
 *     });
 *   }
 *   
 *   async loadPageData(page, limit, filters) {
 *     return await MarkeService.getMarkenPaginated(page, limit, filters);
 *   }
 *   
 *   renderSingleRow(marke) { return `<tr>...</tr>`; }
 *   renderShellContent() { return `<div>...</div>`; }
 * }
 */
export class BasePaginatedList {
  /**
   * @param {string} entityType - Der Entity-Typ (z.B. 'marke', 'creator', 'unternehmen')
   * @param {Object} options - Konfigurationsoptionen
   */
  constructor(entityType, options = {}) {
    if (new.target === BasePaginatedList) {
      throw new TypeError('BasePaginatedList ist abstrakt und kann nicht direkt instanziiert werden');
    }
    
    this.entityType = entityType;
    this.pagination = new PaginationSystem();
    
    // Race-Condition Prevention (siehe list/latestOnly.js)
    this._latest = createLatestOnly();
    
    // Debouncing
    this._loadDebounceTimer = null;
    this._searchDebounceTimer = null;
    
    // State-Flags
    this._loadingInProgress = false;
    this._shellRendered = false;
    this._destroyed = false;
    
    // Event-Listener Management
    this._abortController = null;
    this._boundEventListeners = new Set();
    
    // Sortierung (Standard: alphabetisch nach nameField)
    this.currentSort = { 
      field: options.sortField || 'name', 
      ascending: options.sortAscending !== false 
    };
    
    // Suche
    this.searchQuery = '';
    
    // Konfigurierbare Optionen mit sinnvollen Defaults
    this.options = {
      itemsPerPage: options.itemsPerPage || 25,
      paginationContainerId: options.paginationContainerId || `pagination-${entityType}`,
      tbodySelector: options.tbodySelector || '.data-table tbody',
      tableColspan: options.tableColspan || 10,
      enableDynamicResize: options.enableDynamicResize !== false,
      enableDebounce: options.enableDebounce !== false,
      debounceDelay: options.debounceDelay || 50,
      searchDebounceDelay: options.searchDebounceDelay || 250,
      headline: options.headline || `${entityType} Übersicht`,
      breadcrumbLabel: options.breadcrumbLabel || entityType,
      permissionEntity: options.permissionEntity || entityType,
      checkboxClass: options.checkboxClass || `${entityType}-check`,
      selectAllId: options.selectAllId || `select-all-${entityType}`,
      ...options
    };
    
    // Performance: NumberFormatter einmal erstellen
    this._numberFormatter = new Intl.NumberFormat('de-DE');
    
    // Gecachte Werte
    this._isAdmin = null;
    this._canEdit = null;

    // Embedded: Liste rendert in ein fremdes Root (Produktions-Tab), nicht in window.content.
    this.embedded = false;
    this.mountRoot = null;

    // DOM-Scoping liest mountRoot lazy, Unterklassen setzen es direkt (mountEmbedded).
    this._scope = new ListScope(() => this.mountRoot);

    // Auswahl (Set bleibt dieselbe Instanz: Unterklassen halten Aliase darauf, z.B. selectedMarken)
    this._selection = new TableSelection({ scope: this._scope, getConfig: () => this.options });
    this.selectedItems = this._selection.items;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DOM-SCOPING (Delegation an list/ListScope.js)
  // ══════════════════════════════════════════════════════════════════════════

  byId(id) {
    return this._scope.byId(id);
  }

  query(selector) {
    return this._scope.query(selector);
  }

  queryAll(selector) {
    return this._scope.queryAll(selector);
  }

  eventRoot() {
    return this._scope.eventRoot();
  }

  contentTarget() {
    return this._scope.contentTarget();
  }

  writeContent(html) {
    this._scope.writeContent(html);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ABSTRAKTE METHODEN (MÜSSEN ÜBERSCHRIEBEN WERDEN)
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lädt die Daten für eine Seite
   * @abstract
   * @param {number} page - Aktuelle Seite (1-basiert)
   * @param {number} limit - Anzahl Items pro Seite
   * @param {Object} filters - Aktive Filter
   * @returns {Promise<{data: Array, total: number}>} - Daten und Gesamtzahl
   */
  async loadPageData(page, limit, filters) {
    throw new Error('loadPageData() muss in der Unterklasse implementiert werden');
  }
  
  /**
   * Rendert eine einzelne Tabellenzeile
   * @abstract
   * @param {Object} item - Das zu rendernde Item
   * @returns {string} HTML-String für die Zeile (<tr>...</tr>)
   */
  renderSingleRow(item) {
    throw new Error('renderSingleRow() muss in der Unterklasse implementiert werden');
  }
  
  /**
   * Rendert den Shell-Content (Struktur ohne Daten)
   * @abstract
   * @returns {string} HTML-String für den Shell-Content
   */
  renderShellContent() {
    throw new Error('renderShellContent() muss in der Unterklasse implementiert werden');
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // OPTIONALE ÜBERSCHREIBBARE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialisiert die Filter-Bar (Sort-Dropdown, Filter-Dropdown etc.)
   * Kann überschrieben werden für spezifische Filter-Konfiguration
   */
  async initializeFilterBar() {
    // Standard-Implementierung: nichts tun
    // Unterklassen können hier sortDropdown und filterDropdown initialisieren
  }
  
  /**
   * Hook für zusätzliche Events nach dem Standard-Binding
   * @param {AbortSignal} signal - AbortSignal für Cleanup
   */
  bindAdditionalEvents(signal) {
    // Standard-Implementierung: nichts tun
    // Unterklassen können hier zusätzliche Events binden
  }
  
  /**
   * Baut das Filter-Objekt für die Datenabfrage
   * Kann überschrieben werden für spezifische Filter-Logik
   * @returns {Object} Filter-Objekt
   */
  buildFilters() {
    const currentFilters = filterSystem.getFilters(this.entityType);
    const filters = {
      ...currentFilters,
      _sortBy: this.currentSort.field,
      _sortOrder: this.currentSort.ascending ? 'asc' : 'desc'
    };
    
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const searchConfig = getSearchConfig(this.entityType);
      filters._search = {
        query: this.searchQuery.trim(),
        fields: searchConfig.fields,
        relations: searchConfig.relations || []
      };
      // Legacy-Kompatibilitaet: filters.name weiterhin setzen fuer Services die noch nicht umgestellt sind
      filters.name = this.searchQuery.trim();
    }
    
    return filters;
  }
  
  /**
   * Hook für zusätzliche Berechtigungsprüfungen
   * @returns {Promise<boolean>}
   */
  async checkAdditionalPermissions() {
    return true;
  }
  
  /**
   * Callback nach erfolgreichem Laden der Daten
   * @param {Array} data - Die geladenen Daten
   */
  onDataLoaded(data) {
    // Standard-Implementierung: nichts tun
  }
  
  /**
   * Handler für Permission-Änderungen (z.B. Zuordnungen geändert)
   * Wird automatisch aufgerufen wenn permissionsChanged Event gefeuert wird
   * Kann überschrieben werden um spezifische Caches zu invalidieren
   * @param {Object} detail - Event-Details mit type, eventType, payload
   */
  handlePermissionsChanged(detail) {
    console.log(`🔄 ${this.entityType.toUpperCase()}LIST: Permission-Änderung verarbeiten`, detail.type);
    
    // 1) Permission-Cache invalidieren
    this.invalidatePermissionCache();
    
    // 2) Entity-spezifische Caches zurücksetzen (kann in Unterklasse überschrieben werden)
    this.resetEntityCaches();
    
    // 3) Tabelle komplett verstecken um Flackern zu verhindern
    // Verwendet spezielle Klasse die Daten vollständig ausblendet (nicht nur dimmt)
    const tbody = this.query(this.options.tbodySelector);
    if (tbody) {
      tbody.classList.add('table-permission-loading');
      tbody.classList.remove('table-loading-overlay'); // Falls gesetzt
    }
    
    // 4) Daten neu laden (leicht verzögert um UI-Update zu ermöglichen)
    setTimeout(async () => {
      await this.loadData();
      
      // 5) Nach dem Laden: Permission-Loading entfernen
      const tbodyAfter = this.query(this.options.tbodySelector);
      if (tbodyAfter) {
        tbodyAfter.classList.remove('table-permission-loading');
      }
    }, 50);
  }
  
  /**
   * Setzt entity-spezifische Caches zurück
   * Kann in Unterklassen überschrieben werden für zusätzliche Cache-Invalidierung
   */
  resetEntityCaches() {
    // Standard-Implementierung: nichts tun
    // Unterklassen können hier _allowedUnternehmenIds etc. zurücksetzen
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // STANDARD-IMPLEMENTIERUNGEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Hauptinitialisierung - wird von außen aufgerufen
   */
  async init() {
    this._destroyed = false;

    // Headline setzen
    if (window.setHeadline) {
      window.setHeadline(this.options.headline);
    }
    
    // Berechtigungsprüfung
    const canView = await this.checkViewPermission();
    if (!canView) {
      this.renderNoPermission();
      return;
    }
    
    // Zusätzliche Berechtigungsprüfung
    const additionalPermissions = await this.checkAdditionalPermissions();
    if (!additionalPermissions) {
      return;
    }
    
    // Shell rendern (Struktur)
    await this.renderShell();
    
    // Pagination initialisieren (nach Shell-Render!)
    this.initializePagination();
    
    // Events binden
    this.bindEvents();
    
    // BulkActionSystem registrieren
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList(this.entityType, this);
    }
    
    // Daten laden
    await this.loadData();
    
    console.log(`✅ ${this.entityType.toUpperCase()}LIST: Initialisierung abgeschlossen`);
  }
  
  /**
   * Prüft die View-Berechtigung
   */
  async checkViewPermission() {
    // Admin hat immer Zugriff
    if (this.isAdmin) return true;
    
    // Prüfe über canViewPage oder checkUserPermission
    if (window.canViewPage && window.canViewPage(this.options.permissionEntity)) {
      return true;
    }
    
    if (window.checkUserPermission) {
      return await window.checkUserPermission(this.options.permissionEntity, 'can_view');
    }
    
    // Fallback auf Permissions-Objekt
    return window.currentUser?.permissions?.[this.options.permissionEntity]?.can_view || false;
  }
  
  /**
   * Rendert die "Keine Berechtigung"-Meldung
   */
  renderNoPermission() {
    this.writeContent(`
      <div class="error-message">
        <p>Sie haben keine Berechtigung, ${this.options.breadcrumbLabel} anzuzeigen.</p>
      </div>
    `);
  }
  
  /**
   * Rendert die Shell (Struktur ohne Daten)
   */
  async renderShell() {
    if (this._shellRendered) return;
    
    this.writeContent(this.renderShellContent());
    
    this._shellRendered = true;
    
    // Filter-Bar initialisieren
    await this.initializeFilterBar();
  }
  
  /**
   * Initialisiert das PaginationSystem
   */
  initializePagination() {
    this.pagination.init(this.options.paginationContainerId, {
      itemsPerPage: this.options.itemsPerPage,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (itemsPerPage, page) => this.handleItemsPerPageChange(itemsPerPage, page),
      dynamicResize: this.options.enableDynamicResize,
      tbodySelector: this.options.tbodySelector,
      rowRenderer: (item) => this.renderSingleRow(item),
      dataLoader: async (offset, limit) => {
        const filters = this.buildFilters();
        const result = await this.loadPageData(1, offset + limit, filters);
        return result.data ? result.data.slice(offset) : [];
      }
    });
  }
  
  /**
   * Handler für Seiten-Wechsel
   */
  handlePageChange(page) {
    console.log(`📄 ${this.entityType.toUpperCase()}LIST: Wechsle zu Seite ${page}`);
    this.pagination.currentPage = page;
    this.loadDataDebounced();
  }
  
  /**
   * Handler für Einträge pro Seite Änderung
   */
  handleItemsPerPageChange(itemsPerPage, page) {
    console.log(`📊 ${this.entityType.toUpperCase()}LIST: Einträge pro Seite geändert auf ${itemsPerPage}, Seite ${page}`);
    this.pagination.currentPage = page;
    this.loadDataDebounced();
  }
  
  /**
   * Debounced Load für Filter/Pagination
   */
  loadDataDebounced(delay = null) {
    if (!this.options.enableDebounce) {
      this.loadData();
      return;
    }
    
    if (this._loadDebounceTimer) {
      clearTimeout(this._loadDebounceTimer);
    }
    
    this._loadDebounceTimer = setTimeout(() => {
      this.loadData();
    }, delay ?? this.options.debounceDelay);
  }
  
  /**
   * Lädt die Daten mit Race-Condition Prevention
   */
  async loadData() {
    // Race Condition Prevention: nur der zuletzt gestartete Request zählt
    const request = this._latest.start();
    
    this._loadingInProgress = true;
    const startTime = performance.now();
    
    // Loading-Overlay anzeigen
    const tbody = this.query(this.options.tbodySelector);
    TableAnimationHelper.showLoadingOverlay(tbody);
    
    try {
      const { currentPage, itemsPerPage } = this.pagination.getState();
      const filters = this.buildFilters();
      
      const result = await request.resolve(this.loadPageData(currentPage, itemsPerPage, filters));
      
      // Race Condition Check: Verwerfe veraltete Ergebnisse
      if (result === STALE) {
        console.log(`⏳ ${this.entityType.toUpperCase()}LIST: Veralteter Request, verwerfe Ergebnis`);
        return;
      }
      
      // Check ob Komponente zerstört wurde während Request lief
      if (this._destroyed) {
        console.log(`⏳ ${this.entityType.toUpperCase()}LIST: Komponente zerstört, verwerfe Ergebnis`);
        return;
      }
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(result.total || 0);
      this.pagination.render();
      
      // Tabelle aktualisieren
      await this.updateTable(result.data || []);

      // Neu gerenderte Zeilen haben leere Checkboxen: an selectedItems angleichen,
      // sonst zeigt der Zaehler eine Auswahl, die man nicht sieht
      this.restoreSelectionState();
      
      // Callback
      this.onDataLoaded(result.data || []);
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ ${this.entityType.toUpperCase()}LIST: ${result.data?.length || 0} Einträge geladen in ${loadTime}ms`);
      
    } catch (error) {
      // Ignoriere Fehler wenn neuerer Request existiert
      if (!request.isCurrent()) return;
      
      console.error(`${this.entityType}List.loadData Error:`, error);
      
      // Fehler-Handler aufrufen
      if (window.ErrorHandler?.handle) {
        window.ErrorHandler.handle(error, `${this.entityType}List.loadData`);
      }
      
      // Error-UI anzeigen
      this.showErrorInTable(error.message);
      
    } finally {
      // Nur Loading-Flag zurücksetzen wenn dies der aktuelle Request ist
      if (request.isCurrent()) {
        this._loadingInProgress = false;
        // Loading-Overlay ausblenden (Safety-Net)
        const tbodyFinal = this.query(this.options.tbodySelector);
        TableAnimationHelper.hideLoadingOverlay(tbodyFinal);
      }
    }
  }
  
  /**
   * Legacy-Wrapper für Kompatibilität
   */
  async loadAndRender() {
    if (!this._shellRendered) {
      await this.renderShell();
    }
    await this.loadData();
  }
  
  /**
   * Aktualisiert die Tabelle mit neuen Daten
   */
  async updateTable(items) {
    const tbody = this.query(this.options.tbodySelector);
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!items || items.length === 0) {
        this.renderEmptyTable(tbody);
        return;
      }

      tbody.innerHTML = items.map(item => this.renderSingleRow(item)).join('');
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE (zentrales System: core/components/EmptyState.js)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Empty-State der Liste ohne aktive Filter.
   * Kann ueber options.emptyState oder durch Ueberschreiben angepasst werden.
   * @returns {Object} State fuer renderEmptyState
   */
  getEmptyState() {
    return this.options.emptyState || {
      icon: 'inbox',
      title: `Keine ${this.options.breadcrumbLabel} vorhanden`
    };
  }

  /**
   * Prueft, ob Filter oder Suche aktiv sind (fuer den filtered-Empty-State).
   */
  hasActiveFilters() {
    const filters = filterSystem.getFilters(this.entityType) || {};
    const hasFilters = Object.values(filters).some(value =>
      value && (Array.isArray(value) ? value.length > 0 : value !== '')
    );
    return hasFilters || (this.searchQuery || '').trim().length > 0;
  }

  /**
   * Rendert den Empty-State in den tbody (filter-aware).
   * Der "Filter zurücksetzen"-Button wird global in bindEvents() delegiert.
   * @param {HTMLElement} tbody
   */
  renderEmptyTable(tbody) {
    tbody.innerHTML = renderEmptyRow({
      colspan: this.options.tableColspan,
      hasActiveFilters: this.hasActiveFilters(),
      state: this.getEmptyState()
    });
  }
  
  /**
   * Zeigt einen Fehler in der Tabelle an
   */
  showErrorInTable(message) {
    const tbody = this.query(this.options.tbodySelector);
    if (tbody) {
      tbody.innerHTML = renderErrorRow({
        colspan: this.options.tableColspan,
        message
      });
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLING
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Bindet alle Event-Listener
   */
  bindEvents() {
    if (this._destroyed) return;

    // Cleanup vorheriger Listener
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    const root = this.eventRoot();

    this._bindCoreEvents(root, signal);
    
    // Zusätzliche Events aus Unterklasse
    this.bindAdditionalEvents(signal);
  }

  /**
   * Standard-Events der Basisklasse (Reihenfolge der Registrierung bleibt stabil).
   * @private
   */
  _bindCoreEvents(root, signal) {
    this._bindNavigationEvents(root, signal);
    this._bindSelectionEvents(root, signal);
    this._bindGlobalEvents(signal);
    this._bindFilterEvents(root, signal);
  }

  /** @private Detail-Links */
  _bindNavigationEvents(root, signal) {
    // Entity-spezifische Detail-Links
    root.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === this.entityType) {
        e.preventDefault();
        const itemId = e.target.dataset.id;
        console.log(`🎯 ${this.entityType.toUpperCase()}LIST: Navigiere zu Details:`, itemId);
        window.navigateTo(this.resolveDetailRoute(itemId));
      }
    }, { signal });
  }

  /** @private Checkboxen und Auswahl-Buttons */
  _bindSelectionEvents(root, signal) {
    // Select-All Checkbox
    root.addEventListener('change', (e) => {
      if (e.target.id === this.options.selectAllId) {
        this._selection.setAllVisible(e.target.checked);
        this.updateSelection();
      }
    }, { signal });
    
    // Einzelne Checkboxen
    root.addEventListener('change', (e) => {
      if (e.target.classList.contains(this.options.checkboxClass)) {
        this._selection.toggle(e.target.dataset.id, e.target.checked);
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    }, { signal });
    
    // Alle auswählen Button
    root.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        this._selection.selectAllVisible();
        this.updateSelection();
      }
    }, { signal });
    
    // Auswahl aufheben Button
    root.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        this.deselectAll();
      }
    }, { signal });
  }

  /** @private Window-Events (entityUpdated, permissionsChanged) */
  _bindGlobalEvents(signal) {
    // Entity Updated Event
    // Unterklassen können handleEntityUpdated(detail) implementieren und true
    // zurückgeben, um den Full-Reload zu unterdrücken (z.B. Soft-Update einer Karte).
    window.addEventListener('entityUpdated', async (e) => {
      if (e.detail?.entity !== this.entityType) return;
      if (typeof this.handleEntityUpdated === 'function') {
        try {
          const handled = await this.handleEntityUpdated(e.detail);
          if (handled) return;
        } catch (err) {
          console.error(`❌ ${this.entityType.toUpperCase()}LIST: handleEntityUpdated fehlgeschlagen`, err);
        }
      }
      this.loadDataDebounced(100);
    }, { signal });
    
    // Permissions Changed Event (von AuthService bei Zuordnungs-Änderungen)
    window.addEventListener('permissionsChanged', (e) => {
      console.log(`🔔 ${this.entityType.toUpperCase()}LIST: permissionsChanged Event empfangen`, e.detail);
      this.handlePermissionsChanged(e.detail);
    }, { signal });
  }

  /** @private Empty-State-Actions und Filter-Tags */
  _bindFilterEvents(root, signal) {
    // Empty-State-Actions (z.B. "Filter zurücksetzen" im filtered-State)
    bindEmptyStateActions(root, {
      'reset-filters': () => this.onFiltersReset()
    }, { signal });

    // Filter-Tag X-Buttons
    root.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-x')) {
        e.preventDefault();
        e.stopPropagation();
        
        const tagElement = e.target.closest('.filter-tag');
        if (tagElement) {
          const key = tagElement.dataset.key;
          const currentFilters = filterSystem.getFilters(this.entityType);
          delete currentFilters[key];
          filterSystem.applyFilters(this.entityType, currentFilters);
          this.pagination.currentPage = 1;
          this.loadDataDebounced(50);
        }
      }
    }, { signal });
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // SELECTION HANDLING
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Aktualisiert die Auswahl-UI
   */
  updateSelection() {
    this._selection.renderSummary();
  }
  
  /**
   * Aktualisiert den Status der Select-All Checkbox
   */
  updateSelectAllCheckbox() {
    this._selection.syncSelectAll();
  }
  
  /**
   * Gleicht die sichtbaren Checkboxen nach einem Reload an die Auswahl an.
   */
  restoreSelectionState() {
    this.queryAll(`.${this.options.checkboxClass}`).forEach(cb => {
      cb.checked = this.selectedItems.has(cb.dataset.id);
    });
    this.updateSelectAllCheckbox();
    this.updateSelection();
  }

  /**
   * Hebt alle Auswahlen auf
   */
  deselectAll() {
    this._selection.clear();
    this.updateSelection();
    console.log(`✅ Alle ${this.entityType}-Auswahlen aufgehoben`);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // SORT & FILTER CALLBACKS
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Callback für Sortierungs-Änderung
   */
  onSortChange(sortConfig) {
    console.log('Sortierung geändert:', sortConfig);
    this.currentSort = sortConfig;
    this.pagination.currentPage = 1;
    this.loadDataDebounced(50);
  }
  
  /**
   * Callback für Filter-Anwendung
   */
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters(this.entityType, filters);
    this.pagination.currentPage = 1;
    this.loadDataDebounced(100);
  }
  
  /**
   * Callback für Filter-Reset
   */
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters(this.entityType);
    this.pagination.currentPage = 1;
    this.loadDataDebounced(50);
  }
  
  /**
   * Handler für Suche (debounced)
   */
  handleSearch(query) {
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
    }
    
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();
      this.pagination.currentPage = 1;
      this.loadDataDebounced(50);
    }, this.options.searchDebounceDelay);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // UTILITY GETTERS
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Gecachter Admin-Check
   */
  get isAdmin() {
    if (this._isAdmin === null) {
      this._isAdmin = window.isAdmin();
    }
    return this._isAdmin;
  }

  /**
   * Gecachter Bulk-Delete-Check (Admin oder Mitarbeiter)
   */
  get canBulkDelete() {
    return window.canBulkDelete();
  }
  
  /**
   * Gecachter Edit-Permission Check
   */
  get canEdit() {
    if (this._canEdit === null) {
      this._canEdit = window.isAdmin() || 
                      window.currentUser?.permissions?.[this.options.permissionEntity]?.can_edit || 
                      false;
    }
    return this._canEdit;
  }
  
  /**
   * Invalidiert den Permission-Cache (z.B. bei User-Wechsel)
   */
  invalidatePermissionCache() {
    this._isAdmin = null;
    this._canEdit = null;
  }
  
  /**
   * Sanitize-Helper
   */
  resolveDetailRoute(itemId) {
    return `/${this.entityType}/${itemId}`;
  }

  sanitize(value) {
    return window.validatorSystem?.sanitizeHtml(value) || value || '';
  }
  
  /**
   * Formatiert Zahlen mit deutschem Format
   */
  formatNumber(value) {
    return this._numberFormatter.format(value);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Cleanup-Methode für Komponenten-Zerstörung
   */
  destroy() {
    if (this._destroyed) return;
    console.log(`${this.entityType}List: Cleaning up...`);

    // Bleibt true, bis init()/mountEmbedded neu startet. Sonst bindet ein
    // noch laufender Mount nach dem Destroy wieder Listener.
    this._destroyed = true;
    
    // AbortController alle Event-Listener auf einmal entfernen
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    
    // Legacy-Cleanup (falls noch verwendet)
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    // Debounce-Timer aufräumen
    if (this._loadDebounceTimer) {
      clearTimeout(this._loadDebounceTimer);
      this._loadDebounceTimer = null;
    }
    
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
    
    // Pagination cleanup
    if (this.pagination?.destroy) {
      this.pagination.destroy();
    }
    
    // Selection leeren
    this.selectedItems.clear();
    
    // Shell-Flag zurücksetzen
    this._shellRendered = false;

    // Permission-Cache invalidieren
    this.invalidatePermissionCache();
  }
}
