// PaginationSystem.js (ES6-Modul)
// Wiederverwendbares Pagination-System für alle Tabellen

export class PaginationSystem {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalCount = 0;
    this.totalPages = 0;
    this.containerId = null;
    this.callbacks = {
      onPageChange: null,
      onItemsPerPageChange: null
    };
  }

  /**
   * Initialisiert das Pagination-System
   * @param {string} containerId - ID des Container-Elements
   * @param {Object} options - Konfigurationsoptionen
   * @param {number} options.itemsPerPage - Anzahl Items pro Seite (default: 10)
   * @param {Function} options.onPageChange - Callback bei Seitenwechsel
   * @param {Function} options.onItemsPerPageChange - Callback bei Items-per-page Änderung
   */
  init(containerId, options = {}) {
    this.containerId = containerId;
    this.itemsPerPage = options.itemsPerPage || 10;
    this.callbacks.onPageChange = options.onPageChange || null;
    this.callbacks.onItemsPerPageChange = options.onItemsPerPageChange || null;
    
    console.log('📄 PaginationSystem initialisiert:', {
      containerId,
      itemsPerPage: this.itemsPerPage
    });
  }

  /**
   * Aktualisiert den Total Count und berechnet Seiten neu
   * @param {number} total - Gesamtanzahl der Items
   */
  updateTotal(total) {
    this.totalCount = total;
    this.totalPages = Math.ceil(total / this.itemsPerPage);
    
    // Wenn aktuelle Seite außerhalb liegt, zur letzten Seite springen
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    console.log('📊 Pagination Total aktualisiert:', {
      total,
      totalPages: this.totalPages,
      currentPage: this.currentPage
    });
  }

  /**
   * Rendert die Pagination UI
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn('⚠️ Pagination Container nicht gefunden:', this.containerId);
      return;
    }

    // Wenn keine Items, nichts anzeigen
    if (this.totalCount === 0) {
      container.innerHTML = '';
      return;
    }

    const fromItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const toItem = Math.min(this.currentPage * this.itemsPerPage, this.totalCount);

    const html = `
      <div class="pagination-wrapper">
        <div class="pagination-info">
          Zeige ${fromItem}-${toItem} von ${this.totalCount}
        </div>
        
        <div class="pagination-controls">
          ${this.renderNavigationButtons()}
        </div>
        
        <div class="pagination-items-selector">
          <label for="items-per-page-${this.containerId}">
            <span>Einträge pro Seite:</span>
            <select id="items-per-page-${this.containerId}" class="items-per-page-select">
              <option value="10" ${this.itemsPerPage === 10 ? 'selected' : ''}>10</option>
              <option value="15" ${this.itemsPerPage === 15 ? 'selected' : ''}>15</option>
              <option value="25" ${this.itemsPerPage === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${this.itemsPerPage === 50 ? 'selected' : ''}>50</option>
            </select>
          </label>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.bindEvents();
  }

  /**
   * Rendert die Navigations-Buttons mit Seitenzahlen
   * @returns {string} HTML für Navigation
   */
  renderNavigationButtons() {
    const pages = this.generatePageNumbers();
    
    const backDisabled = this.currentPage === 1;
    const nextDisabled = this.currentPage === this.totalPages;

    let html = `
      <button 
        class="pagination-btn pagination-btn--prev" 
        data-page="${this.currentPage - 1}"
        ${backDisabled ? 'disabled' : ''}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Zurück
      </button>
      
      <div class="pagination-numbers">
    `;

    pages.forEach((page, index) => {
      if (page === '...') {
        html += `<span class="pagination-ellipsis">...</span>`;
      } else {
        const isActive = page === this.currentPage;
        html += `
          <button 
            class="pagination-btn pagination-btn--number ${isActive ? 'pagination-btn--active' : ''}" 
            data-page="${page}"
            ${isActive ? 'disabled' : ''}
          >
            ${page}
          </button>
        `;
      }
    });

    html += `
      </div>
      
      <button 
        class="pagination-btn pagination-btn--next" 
        data-page="${this.currentPage + 1}"
        ${nextDisabled ? 'disabled' : ''}
      >
        Weiter
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    return html;
  }

  /**
   * Generiert Array mit Seitenzahlen inkl. Truncation
   * Zeigt max 7 Seitenzahlen mit "..." Trennung
   * Basiert auf: https://coyleandrew.medium.com/design-better-pagination-a022a3b161e1
   * @returns {Array} Array mit Seitenzahlen und "..." Strings
   */
  generatePageNumbers() {
    const total = this.totalPages;
    const current = this.currentPage;
    
    // Wenn 7 oder weniger Seiten, zeige alle
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    // Wenn aktuelle Seite in den ersten 4
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }

    // Wenn aktuelle Seite in den letzten 4
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }

    // Aktuelle Seite in der Mitte
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  /**
   * Bindet Event-Listener für Pagination-Controls
   */
  bindEvents() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Seitenwechsel Buttons
    container.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt(btn.dataset.page);
        if (page && page !== this.currentPage) {
          this.goToPage(page);
        }
      });
    });

    // Items per Page Selector
    const selector = container.querySelector(`#items-per-page-${this.containerId}`);
    if (selector) {
      selector.addEventListener('change', (e) => {
        const newValue = parseInt(e.target.value);
        this.changeItemsPerPage(newValue);
      });
    }
  }

  /**
   * Wechselt zur angegebenen Seite
   * @param {number} page - Zielseite
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages) {
      console.warn('⚠️ Ungültige Seite:', page);
      return;
    }

    this.currentPage = page;
    console.log('📄 Wechsle zu Seite:', page);

    // Callback aufrufen
    if (this.callbacks.onPageChange) {
      this.callbacks.onPageChange(page);
    }
  }

  /**
   * Ändert die Anzahl der Items pro Seite
   * @param {number} newValue - Neue Anzahl Items pro Seite
   */
  changeItemsPerPage(newValue) {
    if (newValue === this.itemsPerPage) return;

    this.itemsPerPage = newValue;
    this.totalPages = Math.ceil(this.totalCount / this.itemsPerPage);
    
    // Berechne neue Seite basierend auf aktuellem ersten Item
    const firstItemIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.currentPage = Math.floor(firstItemIndex / newValue) + 1;
    
    // Sicherstellen, dass wir nicht außerhalb der Range sind
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }

    console.log('📊 Items per Page geändert:', {
      newValue,
      totalPages: this.totalPages,
      currentPage: this.currentPage
    });

    // Callback aufrufen
    if (this.callbacks.onItemsPerPageChange) {
      this.callbacks.onItemsPerPageChange(newValue, this.currentPage);
    }
  }

  /**
   * Gibt Range für Supabase Query zurück
   * @returns {Object} { from, to } für .range(from, to)
   */
  getRange() {
    const from = (this.currentPage - 1) * this.itemsPerPage;
    const to = from + this.itemsPerPage - 1;
    
    return { from, to };
  }

  /**
   * Gibt aktuelle Pagination-Daten zurück
   * @returns {Object} Pagination State
   */
  getState() {
    return {
      currentPage: this.currentPage,
      itemsPerPage: this.itemsPerPage,
      totalCount: this.totalCount,
      totalPages: this.totalPages,
      range: this.getRange()
    };
  }

  /**
   * Setzt Pagination auf Seite 1 zurück
   */
  reset() {
    this.currentPage = 1;
    console.log('🔄 Pagination zurückgesetzt');
  }

  /**
   * Cleanup
   */
  destroy() {
    this.callbacks.onPageChange = null;
    this.callbacks.onItemsPerPageChange = null;
    console.log('🗑️ PaginationSystem cleaned up');
  }
}

// Exportiere Instanz für globale Nutzung
export const paginationSystem = new PaginationSystem();

