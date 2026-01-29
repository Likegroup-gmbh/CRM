// BasePaginatedList.js (ES6-Modul)
// Abstrakte Basisklasse für alle paginierten Listen
// Bietet einheitliche Pagination, Race-Condition Prevention, Debouncing und Shell-Pattern

import { PaginationSystem } from './PaginationSystem.js';
import { TableAnimationHelper } from './TableAnimationHelper.js';
import { modularFilterSystem as filterSystem } from './filters/ModularFilterSystem.js';

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
    this.selectedItems = new Set();
    
    // Race-Condition Prevention
    this._requestCounter = 0;
    
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
      itemsPerPage: options.itemsPerPage || 15,
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
    
    // Suchbegriff hinzufügen wenn vorhanden
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
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
  
  // ══════════════════════════════════════════════════════════════════════════
  // STANDARD-IMPLEMENTIERUNGEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Hauptinitialisierung - wird von außen aufgerufen
   */
  async init() {
    // Headline setzen
    if (window.setHeadline) {
      window.setHeadline(this.options.headline);
    }
    
    // Breadcrumb setzen
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: this.options.breadcrumbLabel, url: `/${this.entityType}`, clickable: false }
      ]);
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
    const content = window.content || document.getElementById('dashboard-content');
    if (content) {
      content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, ${this.options.breadcrumbLabel} anzuzeigen.</p>
        </div>
      `;
    }
  }
  
  /**
   * Rendert die Shell (Struktur ohne Daten)
   */
  async renderShell() {
    if (this._shellRendered) return;
    
    const shellHtml = this.renderShellContent();
    const content = window.content || document.getElementById('dashboard-content');
    
    if (content) {
      if (window.setContentSafely) {
        window.setContentSafely(content, shellHtml);
      } else {
        content.innerHTML = shellHtml;
      }
    }
    
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
    // Race Condition Prevention: Neuer Request-Counter für jede Anfrage
    const currentRequestId = ++this._requestCounter;
    
    this._loadingInProgress = true;
    const startTime = performance.now();
    
    // Loading-Overlay anzeigen
    const tbody = document.querySelector(this.options.tbodySelector);
    TableAnimationHelper.showLoadingOverlay(tbody);
    
    try {
      const { currentPage, itemsPerPage } = this.pagination.getState();
      const filters = this.buildFilters();
      
      const result = await this.loadPageData(currentPage, itemsPerPage, filters);
      
      // Race Condition Check: Verwerfe veraltete Ergebnisse
      if (currentRequestId !== this._requestCounter) {
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
      
      // Callback
      this.onDataLoaded(result.data || []);
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ ${this.entityType.toUpperCase()}LIST: ${result.data?.length || 0} Einträge geladen in ${loadTime}ms`);
      
    } catch (error) {
      // Ignoriere Fehler wenn neuerer Request existiert
      if (currentRequestId !== this._requestCounter) return;
      
      console.error(`${this.entityType}List.loadData Error:`, error);
      
      // Fehler-Handler aufrufen
      if (window.ErrorHandler?.handle) {
        window.ErrorHandler.handle(error, `${this.entityType}List.loadData`);
      }
      
      // Error-UI anzeigen
      this.showErrorInTable(error.message);
      
    } finally {
      // Nur Loading-Flag zurücksetzen wenn dies der aktuelle Request ist
      if (currentRequestId === this._requestCounter) {
        this._loadingInProgress = false;
        // Loading-Overlay ausblenden (Safety-Net)
        const tbodyFinal = document.querySelector(this.options.tbodySelector);
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
    const tbody = document.querySelector(this.options.tbodySelector);
    if (!tbody) return;
    
    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${this.options.tableColspan}" class="no-data empty-state">Keine Einträge gefunden</td></tr>`;
        return;
      }
      
      tbody.innerHTML = items.map(item => this.renderSingleRow(item)).join('');
    });
  }
  
  /**
   * Zeigt einen Fehler in der Tabelle an
   */
  showErrorInTable(message) {
    const tbody = document.querySelector(this.options.tbodySelector);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${this.options.tableColspan}" class="table-state-cell table-state-cell--error">
            Fehler beim Laden: ${message || 'Unbekannter Fehler'}
          </td>
        </tr>
      `;
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLING
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Bindet alle Event-Listener
   */
  bindEvents() {
    // Cleanup vorheriger Listener
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    
    // Entity-spezifische Detail-Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === this.entityType) {
        e.preventDefault();
        const itemId = e.target.dataset.id;
        console.log(`🎯 ${this.entityType.toUpperCase()}LIST: Navigiere zu Details:`, itemId);
        window.navigateTo(`/${this.entityType}/${itemId}`);
      }
    }, { signal });
    
    // Select-All Checkbox
    document.addEventListener('change', (e) => {
      if (e.target.id === this.options.selectAllId) {
        const checkboxes = document.querySelectorAll(`.${this.options.checkboxClass}`);
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked && cb.dataset.id) {
            this.selectedItems.add(cb.dataset.id);
          } else if (cb.dataset.id) {
            this.selectedItems.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
      }
    }, { signal });
    
    // Einzelne Checkboxen
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains(this.options.checkboxClass)) {
        if (e.target.checked && e.target.dataset.id) {
          this.selectedItems.add(e.target.dataset.id);
        } else if (e.target.dataset.id) {
          this.selectedItems.delete(e.target.dataset.id);
        }
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    }, { signal });
    
    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll(`.${this.options.checkboxClass}`);
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedItems.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById(this.options.selectAllId);
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      }
    }, { signal });
    
    // Auswahl aufheben Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        this.deselectAll();
      }
    }, { signal });
    
    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === this.entityType) {
        this.loadDataDebounced(100);
      }
    }, { signal });
    
    // Filter-Tag X-Buttons
    document.addEventListener('click', (e) => {
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
    
    // Zusätzliche Events aus Unterklasse
    this.bindAdditionalEvents(signal);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // SELECTION HANDLING
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Aktualisiert die Auswahl-UI
   */
  updateSelection() {
    const selectedCount = this.selectedItems.size;
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
  
  /**
   * Aktualisiert den Status der Select-All Checkbox
   */
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById(this.options.selectAllId);
    const individualCheckboxes = document.querySelectorAll(`.${this.options.checkboxClass}`);
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll(`.${this.options.checkboxClass}:checked`);
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }
  
  /**
   * Hebt alle Auswahlen auf
   */
  deselectAll() {
    this.selectedItems.clear();
    
    const checkboxes = document.querySelectorAll(`.${this.options.checkboxClass}`);
    checkboxes.forEach(cb => { cb.checked = false; });
    
    const selectAllCheckbox = document.getElementById(this.options.selectAllId);
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
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
      this._isAdmin = window.currentUser?.rolle === 'admin' || 
                      window.currentUser?.rolle?.toLowerCase() === 'admin';
    }
    return this._isAdmin;
  }
  
  /**
   * Gecachter Edit-Permission Check
   */
  get canEdit() {
    if (this._canEdit === null) {
      this._canEdit = this.isAdmin || 
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
    console.log(`${this.entityType}List: Cleaning up...`);
    
    // Markiere als zerstört um laufende async Operationen zu stoppen
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
    
    // Destroyed-Flag zurücksetzen für Wiederverwendung
    this._destroyed = false;
    
    // Permission-Cache invalidieren
    this.invalidatePermissionCache();
  }
}
