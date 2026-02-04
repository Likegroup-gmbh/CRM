// SearchInput.js (ES6-Modul)
// Wiederverwendbare Suchfeld-Komponente mit Clear-Button für Listen

export class SearchInput {
  /**
   * Rendert das HTML für das Suchfeld
   * @param {string} entityType - z.B. 'ansprechpartner', 'unternehmen', 'marke'
   * @param {Object} options - Konfiguration
   * @param {string} options.placeholder - Placeholder-Text (default: '{Entity} suchen...')
   * @param {string} options.currentValue - Aktueller Suchwert
   * @returns {string} HTML-String
   */
  static render(entityType, options = {}) {
    const placeholder = options.placeholder || `${this.capitalizeFirst(entityType)} suchen...`;
    const currentValue = options.currentValue || '';
    const displayClear = currentValue ? 'flex' : 'none';

    return `
      <div class="search-input-container input-with-clear">
        <input type="text" 
               id="${entityType}-search-input" 
               class="form-input search-input-field" 
               placeholder="${placeholder}"
               value="${currentValue}">
        <button type="button" 
                id="${entityType}-search-clear" 
                class="clear-input-btn" 
                title="Suche löschen"
                style="display: ${displayClear};">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Bindet die Event-Listener für das Suchfeld
   * @param {string} entityType - z.B. 'ansprechpartner', 'unternehmen'
   * @param {Function} onSearch - Callback bei Suche (value) => void
   * @param {AbortSignal} signal - Optional: AbortSignal für Cleanup
   */
  static bind(entityType, onSearch, signal = null) {
    const searchInput = document.getElementById(`${entityType}-search-input`);
    const clearBtn = document.getElementById(`${entityType}-search-clear`);

    if (!searchInput) {
      console.warn(`⚠️ SEARCHINPUT: Input für ${entityType} nicht gefunden`);
      return;
    }

    const eventOptions = signal ? { signal } : {};

    // Input Event
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value;
      
      // Clear-Button ein-/ausblenden
      if (clearBtn) {
        clearBtn.style.display = value ? 'flex' : 'none';
      }
      
      // Callback ausführen
      if (onSearch) {
        onSearch(value);
      }
    }, eventOptions);

    // Clear-Button Event
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchInput.focus();
        
        // Callback mit leerem Wert
        if (onSearch) {
          onSearch('');
        }
      }, eventOptions);
    }
  }

  /**
   * Hilfsfunktion: Ersten Buchstaben groß
   */
  static capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Singleton-Export für einfache Nutzung
export const searchInput = SearchInput;
export default SearchInput;
