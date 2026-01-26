// SortDropdown.js (ES6-Modul)
// Wiederverwendbare Sortier-Dropdown Komponente für Listen

export class SortDropdown {
  constructor() {
    this.instances = new Map();
    this.eventsBound = false;
  }

  /**
   * Sortier-Optionen Definition
   */
  static SORT_OPTIONS = [
    { value: 'name_asc', label: 'A-Z', icon: 'sort-asc' },
    { value: 'name_desc', label: 'Z-A', icon: 'sort-desc' },
    { value: 'created_desc', label: 'Neueste zuerst', icon: 'calendar-desc' },
    { value: 'created_asc', label: 'Älteste zuerst', icon: 'calendar-asc' }
  ];

  /**
   * Initialisiert das Sort-Dropdown für einen Entity-Type
   * @param {string} entityType - z.B. 'unternehmen', 'marke'
   * @param {HTMLElement} containerElement - Mount-Point im DOM
   * @param {Object} options - { nameField: 'firmenname', defaultSort: 'name_asc', onSortChange: (sort) => {} }
   */
  init(entityType, containerElement, options = {}) {
    if (!containerElement) {
      console.error('❌ SORTDROPDOWN: Container-Element nicht gefunden');
      return;
    }

    const config = {
      nameField: options.nameField || 'name',
      defaultSort: options.defaultSort || 'name_asc',
      onSortChange: options.onSortChange || (() => {})
    };

    // Prüfe ob bereits eine Instance existiert und behalte currentSort
    const existingInstance = this.instances.get(entityType);
    const currentSort = existingInstance?.currentSort || config.defaultSort;

    // Instance speichern (mit beibehaltener Sortierung falls vorhanden)
    this.instances.set(entityType, {
      containerElement,
      config,
      currentSort: currentSort
    });

    // HTML rendern (mit aktueller Sortierung, nicht default)
    containerElement.innerHTML = this.renderDropdown(entityType, currentSort);

    // Globale Events nur einmal binden
    if (!this.eventsBound) {
      this.bindGlobalEvents();
      this.eventsBound = true;
    }

    console.log(`✅ SORTDROPDOWN: ${entityType} initialisiert mit ${currentSort}`);
  }

  /**
   * Rendert das Dropdown-HTML
   */
  renderDropdown(entityType, currentSort) {
    const currentOption = SortDropdown.SORT_OPTIONS.find(opt => opt.value === currentSort) || SortDropdown.SORT_OPTIONS[0];

    return `
      <div class="sort-dropdown" data-entity-type="${entityType}">
        <button class="sort-dropdown-toggle secondary-btn" aria-expanded="false" aria-label="Sortierung ändern">
          <span class="sort-dropdown-label">${currentOption.label}</span>
          ${this.getChevronIcon()}
        </button>
        <div class="sort-dropdown-menu">
          ${SortDropdown.SORT_OPTIONS.map(opt => `
            <button class="sort-option${opt.value === currentSort ? ' active' : ''}" data-sort="${opt.value}">
              ${opt.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Chevron Icon SVG
   */
  getChevronIcon() {
    return `<svg class="sort-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>`;
  }

  /**
   * Bindet globale Event-Listener
   */
  bindGlobalEvents() {
    // Toggle Dropdown
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.sort-dropdown-toggle');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleDropdown(toggle);
        return;
      }

      // Sort Option geklickt - prüfe ob innerhalb eines sort-dropdown
      const sortOption = e.target.closest('.sort-option');
      if (sortOption) {
        // Stelle sicher, dass wir im richtigen Dropdown sind
        const parentDropdown = sortOption.closest('.sort-dropdown');
        if (parentDropdown) {
          e.preventDefault();
          e.stopPropagation();
          console.log('🎯 SORTDROPDOWN: Option geklickt:', sortOption.dataset.sort);
          this.selectOption(sortOption);
          return;
        }
      }

      // Click außerhalb: Schließe alle Dropdowns
      if (!e.target.closest('.sort-dropdown')) {
        this.closeAllDropdowns();
      }
    });

    // Escape-Taste schließt Dropdown
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllDropdowns();
      }
    });
  }

  /**
   * Toggle Dropdown öffnen/schließen
   */
  toggleDropdown(toggleButton) {
    const dropdown = toggleButton.closest('.sort-dropdown');
    const menu = dropdown?.querySelector('.sort-dropdown-menu');
    const isOpen = menu?.classList.contains('show');

    // Alle anderen schließen
    this.closeAllDropdowns();

    if (!isOpen && menu) {
      menu.classList.add('show');
      toggleButton.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Schließt alle Dropdowns
   */
  closeAllDropdowns() {
    document.querySelectorAll('.sort-dropdown-menu.show').forEach(menu => {
      menu.classList.remove('show');
    });
    document.querySelectorAll('.sort-dropdown-toggle').forEach(toggle => {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Option auswählen
   */
  selectOption(optionElement) {
    const dropdown = optionElement.closest('.sort-dropdown');
    const entityType = dropdown?.dataset.entityType;
    const sortValue = optionElement.dataset.sort;

    console.log(`🔍 SORTDROPDOWN DEBUG: dropdown=${!!dropdown}, entityType=${entityType}, sortValue=${sortValue}`);

    if (!entityType || !sortValue) {
      console.warn('⚠️ SORTDROPDOWN: entityType oder sortValue fehlt');
      return;
    }

    const instance = this.instances.get(entityType);
    if (!instance) {
      console.warn(`⚠️ SORTDROPDOWN: Keine Instance für ${entityType} gefunden`);
      return;
    }

    // Aktuelle Auswahl aktualisieren
    instance.currentSort = sortValue;

    // UI aktualisieren - Label im Toggle-Button
    const label = dropdown.querySelector('.sort-dropdown-label');
    const option = SortDropdown.SORT_OPTIONS.find(opt => opt.value === sortValue);
    
    console.log(`🔍 SORTDROPDOWN DEBUG: label=${!!label}, option=${option?.label}`);
    
    if (label && option) {
      label.textContent = option.label;
      console.log(`✅ SORTDROPDOWN: Label aktualisiert auf "${option.label}"`);
    } else {
      console.error(`❌ SORTDROPDOWN: Label konnte nicht aktualisiert werden - label=${!!label}, option=${!!option}`);
    }

    // Active-State aktualisieren
    dropdown.querySelectorAll('.sort-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.sort === sortValue);
    });

    // Dropdown schließen
    this.closeAllDropdowns();

    // Callback ausführen
    if (instance.config.onSortChange) {
      const sortConfig = this.getSortConfig(entityType, sortValue);
      instance.config.onSortChange(sortConfig);
    }

    console.log(`🔄 SORTDROPDOWN: ${entityType} sortiert nach ${sortValue}`);
  }

  /**
   * Gibt die Sortier-Konfiguration für Supabase zurück
   * @param {string} entityType
   * @param {string} sortValue - z.B. 'name_asc'
   * @returns {Object} { field: 'firmenname', ascending: true }
   */
  getSortConfig(entityType, sortValue = null) {
    const instance = this.instances.get(entityType);
    if (!instance) return { field: 'created_at', ascending: false };

    const currentSort = sortValue || instance.currentSort;
    const nameField = instance.config.nameField;

    switch (currentSort) {
      case 'name_asc':
        return { field: nameField, ascending: true };
      case 'name_desc':
        return { field: nameField, ascending: false };
      case 'created_asc':
        return { field: 'created_at', ascending: true };
      case 'created_desc':
      default:
        return { field: 'created_at', ascending: false };
    }
  }

  /**
   * Gibt aktuelle Sortierung zurück
   */
  getCurrentSort(entityType) {
    const instance = this.instances.get(entityType);
    return instance?.currentSort || 'name_asc';
  }

  /**
   * Setzt Sortierung programmatisch
   */
  setSort(entityType, sortValue) {
    const instance = this.instances.get(entityType);
    if (!instance) return;

    instance.currentSort = sortValue;

    // UI aktualisieren
    const dropdown = instance.containerElement.querySelector('.sort-dropdown');
    if (dropdown) {
      const label = dropdown.querySelector('.sort-dropdown-label');
      const option = SortDropdown.SORT_OPTIONS.find(opt => opt.value === sortValue);
      if (label && option) {
        label.textContent = option.label;
      }

      dropdown.querySelectorAll('.sort-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.sort === sortValue);
      });
    }
  }

  /**
   * Cleanup
   */
  destroy(entityType = null) {
    if (entityType) {
      this.instances.delete(entityType);
    } else {
      this.instances.clear();
    }
  }
}

// Singleton-Instanz exportieren
export const sortDropdown = new SortDropdown();
export default sortDropdown;
