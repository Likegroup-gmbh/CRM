// FilterDropdown.js (ES6-Modul)
// Dropdown-Komponente für Filter-Auswahl - basierend auf ActionsDropdown-Pattern

import { modularFilterSystem } from './ModularFilterSystem.js';
import { iconRegistry } from '../actions/IconRegistry.js';
import { extractOptionsFromCurrentData } from './FilterDropdownHelper.js';

export class FilterDropdown {
  constructor() {
    this.instances = new Map(); // Dropdown-Instanzen für verschiedene Entity-Types
    this.activeFilters = new Map(); // Aktive Filter pro Entity-Type
    this.filterConfigs = new Map(); // Cache für Filter-Konfigurationen
    this.optionsCache = new Map(); // Cache für dynamisch geladene Filter-Optionen
    this.currentEntityType = null;
    this.callbacks = new Map(); // Callbacks für Filter-Events
    this.eventsBound = false; // Guard: Events nur einmal binden
  }

  /**
   * Generiert Cache-Key für Filter-Optionen
   */
  getOptionsCacheKey(entityType, filterId) {
    return `${entityType}:${filterId}`;
  }

  /**
   * Holt gecachte Optionen oder null
   */
  getCachedOptions(entityType, filterId) {
    const key = this.getOptionsCacheKey(entityType, filterId);
    return this.optionsCache.get(key) || null;
  }

  /**
   * Speichert Optionen im Cache
   */
  setCachedOptions(entityType, filterId, options) {
    const key = this.getOptionsCacheKey(entityType, filterId);
    this.optionsCache.set(key, options);
  }

  /**
   * Invalidiert Cache für einen Entity-Type (bei Bedarf)
   */
  invalidateOptionsCache(entityType = null) {
    if (entityType) {
      // Nur Optionen für diesen Entity-Type löschen
      for (const key of this.optionsCache.keys()) {
        if (key.startsWith(`${entityType}:`)) {
          this.optionsCache.delete(key);
        }
      }
    } else {
      // Alle Optionen löschen
      this.optionsCache.clear();
    }
  }

  /**
   * Initialisiert das Filter-Dropdown für einen Entity-Type
   * @param {string} entityType - z.B. 'kampagne', 'unternehmen'
   * @param {HTMLElement} containerElement - Mount-Point im DOM
   * @param {Object} callbacks - { onFilterApply, onFilterReset }
   */
  async init(entityType, containerElement, callbacks = {}) {
    console.log(`🔍 FILTERDROPDOWN: Initialisiere für ${entityType}`);
    
    if (!containerElement) {
      console.error('❌ FILTERDROPDOWN: Container-Element nicht gefunden');
      return;
    }

    // Callbacks speichern
    this.callbacks.set(entityType, {
      onFilterApply: callbacks.onFilterApply || (() => {}),
      onFilterReset: callbacks.onFilterReset || (() => {})
    });

    // Filter-Konfiguration laden
    const config = await this.loadFilterConfig(entityType);
    
    if (!config || !config.filters || config.filters.length === 0) {
      console.warn(`⚠️ FILTERDROPDOWN: Keine Filter für ${entityType} verfügbar`);
      containerElement.innerHTML = '<p class="text-muted">Keine Filter verfügbar</p>';
      return;
    }

    // HTML rendern
    const html = this.renderDropdown(entityType, config);
    containerElement.innerHTML = html;

    // Instance speichern mit leerer activeFilters Map
    this.instances.set(entityType, {
      containerElement,
      config,
      activeFilters: new Map()
    });

    // Lade bestehende Filter aus filterSystem (falls vorhanden)
    const existingFilters = modularFilterSystem.getFilters(entityType);
    if (existingFilters && Object.keys(existingFilters).length > 0) {
      console.log(`♻️ FILTERDROPDOWN: Wiederherstelle Filter für ${entityType}:`, existingFilters);
      const instance = this.instances.get(entityType);
      Object.entries(existingFilters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          instance.activeFilters.set(key, value);
        }
      });
      
      // UI sofort aktualisieren um Filter-Chips anzuzeigen
      await this.updateUI(entityType);
    }

    // Globale Event-Listener nur einmal binden
    if (!this.eventsBound) {
      this.bindGlobalEvents();
      this.eventsBound = true;
    }

    console.log(`✅ FILTERDROPDOWN: ${entityType} initialisiert mit ${config.filters.length} Filtern`);
  }

  /**
   * Lädt Filter-Konfiguration für Entity-Type
   */
  async loadFilterConfig(entityType) {
    if (this.filterConfigs.has(entityType)) {
      return this.filterConfigs.get(entityType);
    }

    try {
      const config = await modularFilterSystem.loadDynamicFilters(entityType);
      this.filterConfigs.set(entityType, config);
      return config;
    } catch (error) {
      console.error(`❌ FILTERDROPDOWN: Fehler beim Laden der Filter-Config für ${entityType}:`, error);
      return { filters: [], groups: [], presets: [] };
    }
  }

  /**
   * Rendert das Dropdown-HTML
   */
  renderDropdown(entityType, config) {
    const activeFilterCount = this.getActiveFilterCount(entityType);
    const hasActiveFilters = activeFilterCount > 0;

    return `
      <div class="filter-dropdown-container" data-entity-type="${entityType}">
        <div class="filter-row">
          <!-- Filter-Button -->
          <button class="filter-dropdown-toggle" aria-expanded="false" aria-label="Filter hinzufügen">
            ${iconRegistry.get('filter')}
            <span>Filter hinzufügen</span>
            ${hasActiveFilters ? `<span class="filter-count-badge">${activeFilterCount}</span>` : ''}
          </button>

          <!-- Aktive Filter Chips -->
          <div class="active-filters" id="active-filters-${entityType}">
            ${this.renderActiveFilters(entityType)}
          </div>
        </div>

        <!-- Dropdown-Menü -->
        <div class="filter-dropdown">
          <div class="filter-dropdown-header">
            <span class="filter-dropdown-title">Filter auswählen</span>
            <button class="filter-dropdown-close" aria-label="Schließen">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="filter-dropdown-body">
            ${this.renderFilterOptions(config.filters)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Rendert die Filter-Optionen im Dropdown
   */
  renderFilterOptions(filters) {
    if (!filters || filters.length === 0) {
      return '<div class="filter-dropdown-empty">Keine Filter verfügbar</div>';
    }

    return filters.map(filter => `
      <div class="filter-option" data-filter-id="${filter.id}" data-filter-type="${filter.type}">
        <span class="filter-option-label">${filter.label}</span>
        <svg class="submenu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    `).join('');
  }

  /**
   * Rendert aktive Filter asynchron (lädt Labels nach)
   */
  async renderActiveFiltersAsync(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance || instance.activeFilters.size === 0) {
      return '';
    }

    const chips = [];
    for (const [filterId, filterValue] of instance.activeFilters.entries()) {
      const filterConfig = instance.config.filters.find(f => f.id === filterId);
      if (!filterConfig) continue;

      // Versuche Label aus Cache zu holen, sonst lade es
      let displayValue;
      const cacheKey = `${filterId}:${filterValue}`;
      
      if (instance.labelCache?.has(cacheKey)) {
        displayValue = instance.labelCache.get(cacheKey);
      } else {
        displayValue = await this.formatFilterValue(filterConfig, filterValue);
        // Cache das Label
        if (!instance.labelCache) {
          instance.labelCache = new Map();
        }
        instance.labelCache.set(cacheKey, displayValue);
      }
      
      chips.push(`
        <span class="filter-chip" data-filter-id="${filterId}">
          <span class="filter-chip-label">${filterConfig.label}: ${displayValue}</span>
          <button class="filter-chip-remove" data-filter-id="${filterId}" aria-label="Filter entfernen">
            ×
          </button>
        </span>
      `);
    }

    if (chips.length > 0) {
      chips.push(`
        <button class="secondary-btn filter-reset-all" data-entity-type="${entityType}">
          Alle zurücksetzen
        </button>
      `);
    }

    return chips.join('');
  }

  /**
   * Rendert aktive Filter als Chips (synchron für initiale Anzeige - verwendet Cache)
   */
  renderActiveFilters(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance || instance.activeFilters.size === 0) {
      return '';
    }

    const chips = [];
    instance.activeFilters.forEach((filterValue, filterId) => {
      const filterConfig = instance.config.filters.find(f => f.id === filterId);
      if (!filterConfig) return;

      // Versuche Label aus Cache zu holen
      const cachedLabel = instance.labelCache?.get(`${filterId}:${filterValue}`);
      const displayValue = cachedLabel || this.formatFilterValueSync(filterConfig, filterValue);
      
      chips.push(`
        <span class="filter-chip" data-filter-id="${filterId}">
          <span class="filter-chip-label">${filterConfig.label}: ${displayValue}</span>
          <button class="filter-chip-remove" data-filter-id="${filterId}" aria-label="Filter entfernen">
            ×
          </button>
        </span>
      `);
    });

    if (chips.length > 0) {
      chips.push(`
        <button class="secondary-btn filter-reset-all" data-entity-type="${entityType}">
          Alle zurücksetzen
        </button>
      `);
    }

    return chips.join('');
  }

  /**
   * Formatiert Filter-Wert synchron (für sofortige Anzeige)
   * Lädt Labels nachträglich wenn nötig
   */
  formatFilterValueSync(filterConfig, value) {
    // Boolean-Werte speziell behandeln
    if (filterConfig.type === 'boolean') {
      return value === true ? 'Ja' : value === false ? 'Nein' : '';
    }
    
    if (value === null || value === undefined || value === '') return '';
    
    // Versuche erst in Config-Optionen
    if (filterConfig.type === 'select') {
      const option = filterConfig.options?.find(opt => (opt.value || opt.id) === value);
      if (option) {
        return option.label || option.name || value;
      }
    }
    
    // Fallback: ID anzeigen, Label wird asynchron nachgeladen
    if (filterConfig.table && typeof value === 'string' && value.length > 10) {
      // Sieht aus wie UUID - zeige erstmal ID, lade Label asynchron
      this.loadFilterLabelAsync(filterConfig, value);
      return value;
    }
    
    return String(value);
  }

  /**
   * Lädt Filter-Label asynchron nach und aktualisiert UI
   */
  async loadFilterLabelAsync(filterConfig, value) {
    if (!filterConfig.table || !filterConfig.displayField || !filterConfig.valueField) {
      return;
    }

    try {
      const { data, error } = await window.supabase
        .from(filterConfig.table)
        .select(`${filterConfig.valueField}, ${filterConfig.displayField}`)
        .eq(filterConfig.valueField, value)
        .single();

      if (!error && data && data[filterConfig.displayField]) {
        const label = data[filterConfig.displayField];
        
        // Cache das Label
        const entityType = this.getEntityTypeForFilter(filterConfig.id);
        const instance = this.instances.get(entityType);
        if (instance) {
          if (!instance.labelCache) {
            instance.labelCache = new Map();
          }
          instance.labelCache.set(`${filterConfig.id}:${value}`, label);
          
          // UI aktualisieren
          await this.updateUI(entityType);
        }
      }
    } catch (error) {
      console.error('Fehler beim Nachladen des Labels:', error);
    }
  }

  /**
   * Hilfsfunktion: Finde Entity-Type für Filter-ID
   */
  getEntityTypeForFilter(filterId) {
    for (const [entityType, instance] of this.instances.entries()) {
      if (instance.config.filters.some(f => f.id === filterId)) {
        return entityType;
      }
    }
    return null;
  }

  /**
   * Formatiert Filter-Wert für Anzeige (async Version - für komplexe Fälle)
   */
  async formatFilterValue(filterConfig, value) {
    // Boolean-Werte speziell behandeln (false ist ein gültiger Wert)
    if (filterConfig.type === 'boolean') {
      return value === true ? 'Ja' : value === false ? 'Nein' : '';
    }
    
    if (value === null || value === undefined || value === '') return '';

    switch (filterConfig.type) {
      case 'select':
        // Finde Label für Value
        const option = filterConfig.options?.find(opt => 
          (opt.value || opt.id) === value
        );
        
        if (option) {
          return option.label || option.name || value;
        }
        
        // Falls Option nicht in Config: Lade aus DB
        if (filterConfig.table && filterConfig.displayField && filterConfig.valueField) {
          try {
            const { data, error } = await window.supabase
              .from(filterConfig.table)
              .select(`${filterConfig.valueField}, ${filterConfig.displayField}`)
              .eq(filterConfig.valueField, value)
              .single();
            
            if (!error && data) {
              return data[filterConfig.displayField] || value;
            }
          } catch (error) {
            console.error('Fehler beim Laden des Labels:', error);
          }
        }
        
        return value;

      case 'multiSelect':
        if (Array.isArray(value)) {
          const labels = await Promise.all(value.map(async (v) => {
            const opt = filterConfig.options?.find(o => (o.value || o.id) === v);
            if (opt) return opt.label || opt.name || v;
            
            // Falls Option nicht in Config: Lade aus DB
            if (filterConfig.table && filterConfig.displayField && filterConfig.valueField) {
              try {
                const { data, error } = await window.supabase
                  .from(filterConfig.table)
                  .select(`${filterConfig.valueField}, ${filterConfig.displayField}`)
                  .eq(filterConfig.valueField, v)
                  .single();
                
                if (!error && data) {
                  return data[filterConfig.displayField] || v;
                }
              } catch (error) {
                console.error('Fehler beim Laden des Labels:', error);
              }
            }
            
            return v;
          }));
          return labels.join(', ');
        }
        return value;

      case 'date':
      case 'dateRange':
        if (typeof value === 'object') {
          const parts = [];
          if (value.from) parts.push(`ab ${value.from}`);
          if (value.to) parts.push(`bis ${value.to}`);
          return parts.join(' ');
        }
        return value;

      case 'number':
      case 'numberRange':
        if (typeof value === 'object') {
          const parts = [];
          if (value.min !== undefined) parts.push(`min ${value.min}`);
          if (value.max !== undefined) parts.push(`max ${value.max}`);
          return parts.join(' - ');
        }
        return value;

      case 'boolean':
        return value ? 'Ja' : 'Nein';

      default:
        return String(value);
    }
  }

  /**
   * Anzahl aktiver Filter
   */
  getActiveFilterCount(entityType) {
    const instance = this.instances.get(entityType);
    return instance ? instance.activeFilters.size : 0;
  }

  /**
   * Bindet globale Event-Listener
   */
  bindGlobalEvents() {
    // Prevent multiple bindings
    if (this._eventsBound) {
      console.warn('⚠️ FILTERDROPDOWN: Events bereits gebunden, überspringe');
      return;
    }
    this._eventsBound = true;

    // Toggle Dropdown
    this._mainClickHandler = (e) => {
      const toggle = e.target.closest('.filter-dropdown-toggle');
      if (toggle) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.toggleDropdown(toggle);
        return;
      }

      // Close button
      const closeBtn = e.target.closest('.filter-dropdown-close');
      if (closeBtn) {
        e.preventDefault();
        this.closeAllDropdowns();
        return;
      }

      // Filter-Option clicked - show submenu
      const filterOption = e.target.closest('.filter-option');
      if (filterOption) {
        e.preventDefault();
        e.stopPropagation();
        this.showFilterSubmenu(filterOption);
        return;
      }

      // Filter-Chip entfernen
      const chipRemove = e.target.closest('.filter-chip-remove');
      if (chipRemove) {
        e.preventDefault();
        const filterId = chipRemove.dataset.filterId;
        const container = chipRemove.closest('.filter-dropdown-container');
        const entityType = container?.dataset.entityType;
        if (entityType && filterId) {
          this.removeFilter(entityType, filterId);
        }
        return;
      }

      // Alle Filter zurücksetzen
      const resetAll = e.target.closest('.filter-reset-all');
      if (resetAll) {
        e.preventDefault();
        const entityType = resetAll.dataset.entityType;
        if (entityType) {
          this.resetAllFilters(entityType);
        }
        return;
      }

      // Click außerhalb: Schließe nur wenn NICHT im Dropdown oder Submenu
      const isInDropdown = e.target.closest('.filter-dropdown-container');
      const isInSubmenu = e.target.closest('.filter-submenu');
      
      if (!isInDropdown && !isInSubmenu) {
        this.closeAllDropdowns();
      }
    };

    // Submenu-Apply-Button Handler
    this._applyClickHandler = async (e) => {
      const applyBtn = e.target.closest('.filter-submenu-apply');
      if (!applyBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const submenu = applyBtn.closest('.filter-submenu');
      if (!submenu) return;

      const filterId = submenu.dataset.filterId;
      const entityType = submenu.dataset.entityType;
      
      if (!filterId || !entityType) return;

      await this.applyFilterFromSubmenu(entityType, filterId, submenu);
    };

    // Event-Listener registrieren
    document.addEventListener('click', this._mainClickHandler);
    document.addEventListener('click', this._applyClickHandler);
  }

  /**
   * Toggle Dropdown öffnen/schließen
   */
  toggleDropdown(toggleButton) {
    const container = toggleButton.closest('.filter-dropdown-container');
    const dropdown = container?.querySelector('.filter-dropdown');
    const isOpen = dropdown?.classList.contains('show');

    // Alle anderen schließen
    this.closeAllDropdowns();

    if (!isOpen && dropdown) {
      dropdown.classList.add('show');
      toggleButton.setAttribute('aria-expanded', 'true');
      
      // Position anpassen falls nötig
      this.positionDropdown(dropdown, toggleButton);
    }
  }

  /**
   * Positioniert Dropdown
   */
  positionDropdown(dropdown, toggle) {
    const toggleRect = toggle.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = dropdown.offsetHeight;

    // Prüfe ob genug Platz nach unten ist
    const spaceBelow = viewportHeight - toggleRect.bottom;
    
    if (spaceBelow < dropdownHeight && toggleRect.top > dropdownHeight) {
      // Öffne nach oben
      dropdown.style.bottom = '100%';
      dropdown.style.top = 'auto';
      dropdown.style.marginBottom = '8px';
    } else {
      // Öffne nach unten (Standard)
      dropdown.style.top = '100%';
      dropdown.style.bottom = 'auto';
      dropdown.style.marginTop = '8px';
    }
  }

  /**
   * Schließt alle Dropdowns
   */
  closeAllDropdowns() {
    document.querySelectorAll('.filter-dropdown.show').forEach(dropdown => {
      dropdown.classList.remove('show');
    });

    document.querySelectorAll('.filter-dropdown-toggle').forEach(toggle => {
      toggle.setAttribute('aria-expanded', 'false');
    });

    // Entferne alle Submenus (die im body hängen)
    document.querySelectorAll('.filter-submenu').forEach(sub => sub.remove());
  }

  /**
   * Zeigt Submenu für Filter-Auswahl
   */
  async showFilterSubmenu(filterOption) {
    const dropdown = filterOption.closest('.filter-dropdown');
    const container = filterOption.closest('.filter-dropdown-container');
    const entityType = container?.dataset.entityType;
    const filterId = filterOption.dataset.filterId;
    const filterType = filterOption.dataset.filterType;

    if (!entityType || !filterId) return;

    // Guard: Verhindere mehrfaches Öffnen
    if (document.querySelector('.filter-submenu')) {
      console.log('⚠️ Submenu bereits geöffnet, schließe altes erst');
      document.querySelectorAll('.filter-submenu').forEach(sub => sub.remove());
    }

    // Entferne ALLE bestehenden Submenus (nicht nur die im Dropdown)
    document.querySelectorAll('.filter-submenu').forEach(sub => sub.remove());

    // Lade Filter-Config
    const instance = this.instances.get(entityType);
    const filterConfig = instance?.config.filters.find(f => f.id === filterId);

    if (!filterConfig) {
      console.error(`❌ Filter-Config nicht gefunden: ${filterId}`);
      return;
    }

    // Erstelle Submenu
    const submenu = document.createElement('div');
    submenu.className = 'filter-submenu';
    submenu.dataset.filterId = filterId;
    submenu.dataset.entityType = entityType;

    // Submenu-Inhalt rendern
    submenu.innerHTML = await this.renderFilterSubmenu(filterConfig, entityType);

    // Submenu an body anhängen (nicht an filterOption!) damit es aus dem Dropdown raus kann
    document.body.appendChild(submenu);
    
    // Position anpassen
    this.positionSubmenu(submenu, filterOption);

    // Fokussiere erstes Input-Feld
    const firstInput = submenu.querySelector('input, select');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 50);
    }
  }

  /**
   * Rendert Submenu-Inhalt basierend auf Filter-Typ
   */
  async renderFilterSubmenu(filterConfig, entityType) {
    const currentValue = this.instances.get(entityType)?.activeFilters.get(filterConfig.id);

    let inputHtml = '';

    switch (filterConfig.type) {
      case 'text':
        inputHtml = `
          <input type="text" 
                 class="filter-submenu-input" 
                 data-filter-id="${filterConfig.id}"
                 placeholder="${filterConfig.placeholder || 'Suchen...'}" 
                 value="${currentValue || ''}"
                 autocomplete="off">
        `;
        break;

      case 'select':
        // Prüfe ob Optionen bereits geladen sind
        let selectOptions = filterConfig.options || [];
        
        // Falls bereits Optionen in der Config definiert sind (z.B. Status), nutze diese
        if (selectOptions.length > 0) {
          console.log(`✅ Nutze vordefinierte Optionen für ${filterConfig.id}:`, selectOptions.length);
        }
        // Prüfe ob Optionen im Cache sind (Performance-Optimierung)
        else if (this.getCachedOptions(entityType, filterConfig.id)) {
          selectOptions = this.getCachedOptions(entityType, filterConfig.id);
          console.log(`⚡ Nutze gecachte Optionen für ${filterConfig.id}:`, selectOptions.length);
        }
        // Falls keine Optionen vorhanden UND dynamisch, lade sie
        else if (filterConfig.dynamic || filterConfig.table) {
          try {
            console.log(`🔄 Extrahiere Optionen aus aktuellen Daten für ${filterConfig.id}...`);
            
            // Versuche zuerst, Optionen aus den aktuell geladenen Daten zu extrahieren
            selectOptions = extractOptionsFromCurrentData(entityType, filterConfig);
            
            // Falls keine Daten gefunden, lade aus DB (Fallback)
            if (selectOptions.length === 0) {
              const tableName = filterConfig.table;
              const displayField = filterConfig.displayField || 'name';
              const valueField = filterConfig.valueField || 'id';
              
              if (window.supabase && tableName) {
                // Spezial-Handling für Junction Tables: Nur verwendete Einträge laden
                if (filterConfig.id === 'branche_id' && entityType === 'unternehmen') {
                  // Nur Branchen laden, die tatsächlich von Unternehmen verwendet werden
                  const { data, error } = await window.supabase
                    .from('unternehmen_branchen')
                    .select(`
                      branche_id,
                      branchen (
                        id,
                        name
                      )
                    `);
                  
                  if (!error && data) {
                    // Unique Branchen extrahieren
                    const uniqueBranchen = new Map();
                    data.forEach(item => {
                      if (item.branchen) {
                        uniqueBranchen.set(item.branchen.id, item.branchen.name);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueBranchen.entries())
                      .map(([id, name]) => ({ value: id, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} verwendete Branchen aus DB geladen für ${filterConfig.id}`);
                  }
                } else if (filterConfig.id === 'branche_id' && entityType === 'marke') {
                  // Nur Branchen laden, die tatsächlich von Marken verwendet werden
                  const { data, error } = await window.supabase
                    .from('marke_branchen')
                    .select(`
                      branche_id,
                      branche:branche_id (
                        id,
                        name
                      )
                    `);
                  
                  if (!error && data) {
                    // Unique Branchen extrahieren
                    const uniqueBranchen = new Map();
                    data.forEach(item => {
                      if (item.branche) {
                        uniqueBranchen.set(item.branche.id, item.branche.name);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueBranchen.entries())
                      .map(([id, name]) => ({ value: id, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} verwendete Branchen aus DB geladen für ${filterConfig.id}`);
                  }
                } else if (filterConfig.id === 'firmenname' && entityType === 'unternehmen') {
                  // Firmennamen aus Unternehmen-Tabelle laden (nur tatsächlich vorhandene)
                  const { data, error } = await window.supabase
                    .from('unternehmen')
                    .select('firmenname')
                    .not('firmenname', 'is', null)
                    .order('firmenname');
                  
                  if (!error && data) {
                    // Unique Firmennamen extrahieren
                    const uniqueFirmen = new Set();
                    data.forEach(item => {
                      if (item.firmenname) {
                        uniqueFirmen.add(item.firmenname);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueFirmen)
                      .map(name => ({ value: name, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} Firmennamen aus DB geladen für ${filterConfig.id}`);
                  }
                } else if (filterConfig.id === 'rechnungsadresse_stadt' && entityType === 'unternehmen') {
                  // Städte aus Unternehmen-Tabelle laden (nur tatsächlich verwendete)
                  const { data, error } = await window.supabase
                    .from('unternehmen')
                    .select('rechnungsadresse_stadt')
                    .not('rechnungsadresse_stadt', 'is', null)
                    .order('rechnungsadresse_stadt');
                  
                  if (!error && data) {
                    // Unique Städte extrahieren
                    const uniqueStaedte = new Set();
                    data.forEach(item => {
                      if (item.rechnungsadresse_stadt) {
                        uniqueStaedte.add(item.rechnungsadresse_stadt);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueStaedte)
                      .map(name => ({ value: name, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} Städte aus DB geladen für ${filterConfig.id}`);
                  }
                } else if (filterConfig.id === 'rechnungsadresse_land' && entityType === 'unternehmen') {
                  // Länder aus Unternehmen-Tabelle laden (nur tatsächlich verwendete)
                  const { data, error } = await window.supabase
                    .from('unternehmen')
                    .select('rechnungsadresse_land')
                    .not('rechnungsadresse_land', 'is', null)
                    .order('rechnungsadresse_land');
                  
                  if (!error && data) {
                    // Unique Länder extrahieren
                    const uniqueLaender = new Set();
                    data.forEach(item => {
                      if (item.rechnungsadresse_land) {
                        uniqueLaender.add(item.rechnungsadresse_land);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueLaender)
                      .map(name => ({ value: name, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} Länder aus DB geladen für ${filterConfig.id}`);
                  }
                } else if (filterConfig.id === 'markenname' && entityType === 'marke') {
                  // Markennamen aus Marke-Tabelle laden (nur tatsächlich vorhandene)
                  const { data, error } = await window.supabase
                    .from('marke')
                    .select('markenname')
                    .not('markenname', 'is', null)
                    .order('markenname');
                  
                  if (!error && data) {
                    // Unique Markennamen extrahieren
                    const uniqueMarken = new Set();
                    data.forEach(item => {
                      if (item.markenname) {
                        uniqueMarken.add(item.markenname);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueMarken)
                      .map(name => ({ value: name, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} Markennamen aus DB geladen für ${filterConfig.id}`);
                  }
                } else if (filterConfig.id === 'auftragsname' && entityType === 'auftrag') {
                  // Auftragsnamen aus Auftrag-Tabelle laden (nur tatsächlich vorhandene)
                  const { data, error } = await window.supabase
                    .from('auftrag')
                    .select('auftragsname')
                    .not('auftragsname', 'is', null)
                    .order('auftragsname');
                  
                  if (!error && data) {
                    // Unique Auftragsnamen extrahieren
                    const uniqueAuftraege = new Set();
                    data.forEach(item => {
                      if (item.auftragsname) {
                        uniqueAuftraege.add(item.auftragsname);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueAuftraege)
                      .map(name => ({ value: name, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} Auftragsnamen aus DB geladen für ${filterConfig.id}`);
                  }
                } else if (filterConfig.id === 'auftragsname' && entityType === 'auftragsdetails') {
                  // Auftragsnamen für Auftragsdetails laden
                  const { data, error } = await window.supabase
                    .from('auftrag')
                    .select('auftragsname')
                    .not('auftragsname', 'is', null)
                    .order('auftragsname');
                  
                  if (!error && data) {
                    // Unique Auftragsnamen extrahieren
                    const uniqueAuftraege = new Set();
                    data.forEach(item => {
                      if (item.auftragsname) {
                        uniqueAuftraege.add(item.auftragsname);
                      }
                    });
                    
                    selectOptions = Array.from(uniqueAuftraege)
                      .map(name => ({ value: name, label: name }))
                      .sort((a, b) => a.label.localeCompare(b.label));
                    
                    console.log(`✅ ${selectOptions.length} Auftragsnamen aus DB geladen für Auftragsdetails`);
                  }
                } else {
                  // Standard-Laden aus Tabelle
                  const { data, error } = await window.supabase
                    .from(tableName)
                    .select(`${valueField}, ${displayField}`)
                    .order(displayField);
                  
                  if (!error && data) {
                    selectOptions = data.map(item => ({
                      value: item[valueField],
                      label: item[displayField]
                    }));
                    console.log(`✅ ${selectOptions.length} Optionen aus DB geladen für ${filterConfig.id}`);
                  }
                }
              }
            } else {
              console.log(`✅ ${selectOptions.length} Optionen aus aktuellen Daten extrahiert für ${filterConfig.id}`);
            }
            
            // Optionen im Cache speichern für spätere Verwendung
            if (selectOptions.length > 0) {
              this.setCachedOptions(entityType, filterConfig.id, selectOptions);
            }
          } catch (error) {
            console.error(`❌ Fehler beim Laden der Optionen:`, error);
          }
        }
        
        const optionsHtml = selectOptions.map(opt => {
          const value = opt.value || opt.id || '';
          const label = opt.label || opt.name || opt.value || 'Unbekannt';
          const selected = currentValue === value ? 'selected' : '';
          
          // Debug: Log wenn undefined
          if (!label || label === 'undefined') {
            console.warn('⚠️ Option ohne Label:', opt);
          }
          
          return `<option value="${value}" ${selected}>${label}</option>`;
        }).join('');

        inputHtml = `
          <select class="filter-submenu-select" data-filter-id="${filterConfig.id}">
            <option value="">Bitte wählen...</option>
            ${optionsHtml}
          </select>
        `;
        break;

      case 'multiSelect':
        // Prüfe ob Optionen bereits geladen sind
        let multiOptions = filterConfig.options || [];
        
        // Prüfe ob Optionen im Cache sind (Performance-Optimierung)
        if (multiOptions.length === 0 && this.getCachedOptions(entityType, filterConfig.id)) {
          multiOptions = this.getCachedOptions(entityType, filterConfig.id);
          console.log(`⚡ Nutze gecachte Optionen für ${filterConfig.id}:`, multiOptions.length);
        }
        // Falls keine Optionen vorhanden, extrahiere aus aktuellen Daten
        else if (multiOptions.length === 0 && (filterConfig.dynamic || filterConfig.table)) {
          try {
            console.log(`🔄 Extrahiere Optionen aus aktuellen Daten für ${filterConfig.id}...`);
            
            // Versuche zuerst, Optionen aus den aktuell geladenen Daten zu extrahieren
            multiOptions = extractOptionsFromCurrentData(entityType, filterConfig);
            
            // Falls keine Daten gefunden, lade aus DB (Fallback)
            if (multiOptions.length === 0) {
              const tableName = filterConfig.table;
              const displayField = filterConfig.displayField || 'name';
              const valueField = filterConfig.valueField || 'id';
              
              if (window.supabase && tableName) {
                const { data, error } = await window.supabase
                  .from(tableName)
                  .select(`${valueField}, ${displayField}`)
                  .order(displayField);
                
                if (!error && data) {
                  multiOptions = data.map(item => ({
                    value: item[valueField],
                    label: item[displayField]
                  }));
                  console.log(`✅ ${multiOptions.length} Optionen aus DB geladen für ${filterConfig.id}`);
                }
              }
            } else {
              console.log(`✅ ${multiOptions.length} Optionen aus aktuellen Daten extrahiert für ${filterConfig.id}`);
            }
            
            // Optionen im Cache speichern für spätere Verwendung
            if (multiOptions.length > 0) {
              this.setCachedOptions(entityType, filterConfig.id, multiOptions);
            }
          } catch (error) {
            console.error(`❌ Fehler beim Laden der Optionen:`, error);
          }
        }
        
        const checkboxesHtml = multiOptions.map(opt => {
          const value = opt.value || opt.id;
          const label = opt.label || opt.name;
          const checked = Array.isArray(currentValue) && currentValue.includes(value) ? 'checked' : '';
          return `
            <label class="filter-checkbox-option">
              <input type="checkbox" 
                     value="${value}" 
                     data-filter-id="${filterConfig.id}"
                     ${checked}>
              <span>${label}</span>
            </label>
          `;
        }).join('');

        inputHtml = `
          <div class="filter-submenu-checkboxes">
            ${checkboxesHtml}
          </div>
        `;
        break;

      case 'date':
        inputHtml = `
          <input type="date" 
                 class="filter-submenu-input" 
                 data-filter-id="${filterConfig.id}"
                 value="${currentValue || ''}">
        `;
        break;

      case 'dateRange':
        const dateFrom = currentValue?.from || '';
        const dateTo = currentValue?.to || '';
        inputHtml = `
          <div class="filter-range-inputs">
            <label class="filter-range-label">Von:</label>
            <input type="date" 
                   class="filter-submenu-input" 
                   data-filter-id="${filterConfig.id}"
                   data-range="from"
                   value="${dateFrom}">
            <label class="filter-range-label">Bis:</label>
            <input type="date" 
                   class="filter-submenu-input" 
                   data-filter-id="${filterConfig.id}"
                   data-range="to"
                   value="${dateTo}">
          </div>
        `;
        break;

      case 'number':
        inputHtml = `
          <input type="number" 
                 class="filter-submenu-input" 
                 data-filter-id="${filterConfig.id}"
                 placeholder="${filterConfig.placeholder || 'Zahl eingeben...'}"
                 min="${filterConfig.min || 0}"
                 max="${filterConfig.max || ''}"
                 step="${filterConfig.step || 1}"
                 value="${currentValue || ''}">
        `;
        break;

      case 'numberRange':
        const numMin = currentValue?.min ?? filterConfig.min ?? '';
        const numMax = currentValue?.max ?? filterConfig.max ?? '';
        inputHtml = `
          <div class="filter-range-inputs">
            <label class="filter-range-label">Min:</label>
            <input type="number" 
                   class="filter-submenu-input" 
                   data-filter-id="${filterConfig.id}"
                   data-range="min"
                   min="${filterConfig.min || 0}"
                   step="${filterConfig.step || 1}"
                   value="${numMin}">
            <label class="filter-range-label">Max:</label>
            <input type="number" 
                   class="filter-submenu-input" 
                   data-filter-id="${filterConfig.id}"
                   data-range="max"
                   max="${filterConfig.max || ''}"
                   step="${filterConfig.step || 1}"
                   value="${numMax}">
          </div>
        `;
        break;

      case 'boolean':
        const boolValue = currentValue === true ? 'true' : currentValue === false ? 'false' : '';
        inputHtml = `
          <select class="filter-submenu-select" data-filter-id="${filterConfig.id}">
            <option value="">Alle</option>
            <option value="true" ${boolValue === 'true' ? 'selected' : ''}>Ja</option>
            <option value="false" ${boolValue === 'false' ? 'selected' : ''}>Nein</option>
          </select>
        `;
        break;

      default:
        inputHtml = '<p class="text-muted">Unbekannter Filter-Typ</p>';
    }

    return `
      <div class="filter-submenu-header">
        <span class="filter-submenu-title">${filterConfig.label}</span>
      </div>
      <div class="filter-submenu-body">
        ${inputHtml}
      </div>
      <div class="filter-submenu-footer">
        <button class="filter-submenu-apply secondary-btn">Anwenden</button>
      </div>
    `;
  }

  /**
   * Positioniert Submenu mit fixed positioning (wie ActionsDropdown)
   */
  positionSubmenu(submenu, filterOption) {
    const optionRect = filterOption.getBoundingClientRect();
    const submenuWidth = submenu.offsetWidth;
    const submenuHeight = submenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Fixed positioning: Berechne Position relativ zum Viewport
    let left = optionRect.right + 8; // 8px Abstand rechts neben der Option
    let top = optionRect.top;
    
    // Prüfe ob genug Platz rechts ist
    if (left + submenuWidth > viewportWidth - 20) {
      // Öffne nach links
      left = optionRect.left - submenuWidth - 8;
    }

    // Prüfe ob genug Platz nach unten ist
    if (top + submenuHeight > viewportHeight - 20) {
      // Positioniere so dass es nach oben passt
      top = Math.max(20, viewportHeight - submenuHeight - 20);
    }

    submenu.style.left = `${left}px`;
    submenu.style.top = `${top}px`;
  }

  /**
   * Wendet Filter aus Submenu an
   */
  async applyFilterFromSubmenu(entityType, filterId, submenu) {
    const instance = this.instances.get(entityType);
    const filterConfig = instance?.config.filters.find(f => f.id === filterId);

    if (!filterConfig) {
      console.error(`❌ Filter-Config nicht gefunden: ${filterId}`);
      return;
    }

    let filterValue;

    switch (filterConfig.type) {
      case 'text':
      case 'date':
      case 'number':
        const input = submenu.querySelector(`[data-filter-id="${filterId}"]`);
        filterValue = input?.value?.trim();
        break;

      case 'select':
      case 'boolean':
        const select = submenu.querySelector(`[data-filter-id="${filterId}"]`);
        filterValue = select?.value;
        if (filterConfig.type === 'boolean') {
          filterValue = filterValue === 'true' ? true : filterValue === 'false' ? false : null;
        }
        break;

      case 'multiSelect':
        const checkboxes = submenu.querySelectorAll(`input[type="checkbox"][data-filter-id="${filterId}"]:checked`);
        filterValue = Array.from(checkboxes).map(cb => cb.value);
        break;

      case 'dateRange':
      case 'numberRange':
        const fromInput = submenu.querySelector(`[data-filter-id="${filterId}"][data-range="from"], [data-filter-id="${filterId}"][data-range="min"]`);
        const toInput = submenu.querySelector(`[data-filter-id="${filterId}"][data-range="to"], [data-filter-id="${filterId}"][data-range="max"]`);
        
        const fromValue = fromInput?.value;
        const toValue = toInput?.value;

        if (fromValue || toValue) {
          filterValue = {};
          if (fromValue) filterValue[filterConfig.type === 'dateRange' ? 'from' : 'min'] = fromValue;
          if (toValue) filterValue[filterConfig.type === 'dateRange' ? 'to' : 'max'] = toValue;
        }
        break;
    }

    // Setze oder entferne Filter
    // Boolean-Werte (true/false) sind gültig, daher spezielle Prüfung
    const hasValidValue = filterValue !== null && filterValue !== undefined && filterValue !== '' &&
      (typeof filterValue === 'boolean' || 
       (typeof filterValue !== 'object' || Object.keys(filterValue).length > 0) && 
       (!Array.isArray(filterValue) || filterValue.length > 0));
    
    if (hasValidValue) {
      instance.activeFilters.set(filterId, filterValue);
      console.log(`✅ Filter gesetzt: ${filterId} = `, filterValue);
      
      // Lade Label für dynamische Filter asynchron (falls UUID/ID)
      if (filterConfig.type === 'select' && filterConfig.table && filterConfig.displayField && filterConfig.valueField) {
        if (typeof filterValue === 'string' && filterValue.length > 10) {
          // Sieht aus wie UUID - lade Label
          this.loadFilterLabelAsync(filterConfig, filterValue);
        }
      }
    } else {
      instance.activeFilters.delete(filterId);
      console.log(`🗑️ Filter entfernt: ${filterId}`);
    }

    // UI aktualisieren
    await this.updateUI(entityType);

    // Callback ausführen
    await this.executeFilterCallback(entityType);

    // Dropdown schließen
    this.closeAllDropdowns();
  }

  /**
   * Entfernt einzelnen Filter
   */
  async removeFilter(entityType, filterId) {
    const instance = this.instances.get(entityType);
    if (!instance) return;

    instance.activeFilters.delete(filterId);
    console.log(`🗑️ Filter entfernt: ${filterId}`);

    // UI aktualisieren
    await this.updateUI(entityType);

    // Callback ausführen
    await this.executeFilterCallback(entityType);
  }

  /**
   * Setzt alle Filter zurück
   */
  async resetAllFilters(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance) return;

    instance.activeFilters.clear();
    console.log(`🔄 Alle Filter zurückgesetzt für ${entityType}`);

    // UI aktualisieren
    await this.updateUI(entityType);

    // Reset-Callback ausführen
    const callbacks = this.callbacks.get(entityType);
    if (callbacks?.onFilterReset) {
      await callbacks.onFilterReset();
    }
  }

  /**
   * Aktualisiert UI nach Filter-Änderung
   */
  async updateUI(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance) return;

    // Aktualisiere aktive Filter-Chips
    const activeFiltersContainer = document.getElementById(`active-filters-${entityType}`);
    if (activeFiltersContainer) {
      activeFiltersContainer.innerHTML = await this.renderActiveFiltersAsync(entityType);
    }

    // Aktualisiere Badge am Button
    const container = instance.containerElement.querySelector('.filter-dropdown-container');
    const toggle = container?.querySelector('.filter-dropdown-toggle');
    if (toggle) {
      const existingBadge = toggle.querySelector('.filter-count-badge');
      const count = this.getActiveFilterCount(entityType);
      
      if (count > 0) {
        if (existingBadge) {
          existingBadge.textContent = count;
        } else {
          toggle.insertAdjacentHTML('beforeend', `<span class="filter-count-badge">${count}</span>`);
        }
      } else if (existingBadge) {
        existingBadge.remove();
      }
    }
  }

  /**
   * Führt Filter-Apply-Callback aus
   */
  async executeFilterCallback(entityType) {
    const callbacks = this.callbacks.get(entityType);
    const instance = this.instances.get(entityType);

    if (!callbacks?.onFilterApply || !instance) return;

    // Konvertiere Map zu Object für Callback
    const filtersObject = {};
    instance.activeFilters.forEach((value, key) => {
      filtersObject[key] = value;
    });

    console.log(`🔍 FILTERDROPDOWN: Filter anwenden für ${entityType}:`, filtersObject);

    try {
      await callbacks.onFilterApply(filtersObject);
    } catch (error) {
      console.error(`❌ FILTERDROPDOWN: Fehler beim Anwenden der Filter:`, error);
    }
  }

  /**
   * Holt aktive Filter für Entity-Type
   */
  getActiveFilters(entityType) {
    const instance = this.instances.get(entityType);
    if (!instance) return {};

    const filtersObject = {};
    instance.activeFilters.forEach((value, key) => {
      filtersObject[key] = value;
    });

    return filtersObject;
  }

  /**
   * Setzt Filter programmatisch
   */
  async setFilters(entityType, filters) {
    const instance = this.instances.get(entityType);
    if (!instance) return;

    instance.activeFilters.clear();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        instance.activeFilters.set(key, value);
      }
    });

    await this.updateUI(entityType);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.instances.clear();
    this.activeFilters.clear();
    this.filterConfigs.clear();
    this.optionsCache.clear();
    this.callbacks.clear();
  }
}

// Singleton-Instanz exportieren
export const filterDropdown = new FilterDropdown();
export default filterDropdown;

