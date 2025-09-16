// TableHelper.js (ES6-Modul)
// Hilfsfunktionen für dynamische Tabellenspalten-Optimierung

export class TableHelper {
  
  /**
   * Fügt automatisch CSS-Klassen zu Tabellenspalten hinzu basierend auf Inhalt
   * @param {HTMLTableElement} table - Die Tabelle
   * @param {Object} columnConfig - Konfiguration der Spalten
   */
  static optimizeTableColumns(table, columnConfig = {}) {
    if (!table) return;
    
    const headers = table.querySelectorAll('thead th');
    const rows = table.querySelectorAll('tbody tr');
    
    headers.forEach((header, index) => {
      const headerText = header.textContent.trim().toLowerCase();
      const columnIndex = index + 1; // CSS nth-child ist 1-basiert
      
      // Automatische Klassenzuweisung basierend auf Header-Text
      let cssClass = this.getColumnClass(headerText, columnConfig[index]);
      
      if (cssClass) {
        // CSS-Klasse zu Header hinzufügen
        header.classList.add(cssClass);
        
        // CSS-Klasse zu allen Zellen dieser Spalte hinzufügen
        rows.forEach(row => {
          const cell = row.children[index];
          if (cell) {
            cell.classList.add(cssClass);
          }
        });
      }
    });
  }
  
  /**
   * Bestimmt die passende CSS-Klasse basierend auf Spalteninhalt
   * @param {string} headerText - Text des Spalten-Headers
   * @param {Object} customConfig - Benutzerdefinierte Konfiguration
   * @returns {string} CSS-Klassename
   */
  static getColumnClass(headerText, customConfig = {}) {
    // Benutzerdefinierte Konfiguration hat Vorrang
    if (customConfig && customConfig.cssClass) {
      return customConfig.cssClass;
    }
    
    // Checkbox-Spalten
    if (headerText === '' || headerText === 'auswahl' || headerText === 'select') {
      return 'checkbox-col';
    }
    
    // ID/Nummer Spalten
    if (headerText.includes('id') || 
        headerText.includes('nr') || 
        headerText.includes('nummer') ||
        headerText === '#') {
      return 'id-col';
    }
    
    // Name/Titel Spalten
    if (headerText.includes('name') || 
        headerText.includes('titel') || 
        headerText.includes('kampagne') ||
        headerText.includes('auftrag')) {
      return 'name-col';
    }
    
    // Unternehmen/Marke Spalten
    if (headerText.includes('unternehmen') || 
        headerText.includes('marke') || 
        headerText.includes('firma') ||
        headerText.includes('brand')) {
      return 'company-col';
    }
    
    // Status Spalten
    if (headerText.includes('status') || 
        headerText.includes('zustand') ||
        headerText.includes('phase')) {
      return 'status-col';
    }
    
    // Datum Spalten
    if (headerText.includes('datum') || 
        headerText.includes('date') || 
        headerText.includes('deadline') ||
        headerText.includes('start') ||
        headerText.includes('ende') ||
        headerText.includes('erstellt') ||
        headerText.includes('geändert')) {
      return 'date-col';
    }
    
    // Zahlen Spalten
    if (headerText.includes('anzahl') || 
        headerText.includes('budget') || 
        headerText.includes('betrag') ||
        headerText.includes('kosten') ||
        headerText.includes('preis') ||
        headerText.includes('videos') ||
        headerText.includes('creator') ||
        headerText.includes('euro') ||
        headerText.includes('€')) {
      return 'number-col';
    }
    
    // Kontakt Spalten
    if (headerText.includes('mail') || 
        headerText.includes('email') || 
        headerText.includes('website') ||
        headerText.includes('url') ||
        headerText.includes('link') ||
        headerText.includes('telefon') ||
        headerText.includes('instagram') ||
        headerText.includes('tiktok')) {
      return 'contact-col';
    }
    
    // Ansprechpartner/Listen Spalten
    if (headerText.includes('ansprechpartner') || 
        headerText.includes('mitarbeiter') || 
        headerText.includes('zuständig') ||
        headerText.includes('kontakt') ||
        headerText.includes('branchen') ||
        headerText.includes('tags')) {
      return 'list-col';
    }
    
    // Beschreibung/Text Spalten
    if (headerText.includes('beschreibung') || 
        headerText.includes('kommentar') || 
        headerText.includes('notiz') ||
        headerText.includes('text') ||
        headerText.includes('inhalt') ||
        headerText.includes('details')) {
      return 'text-col';
    }
    
    // Standard: keine spezielle Klasse
    return null;
  }
  
  /**
   * Optimiert eine bestehende Tabelle automatisch
   * @param {string} tableSelector - CSS-Selektor für die Tabelle
   * @param {Object} options - Optionen für die Optimierung
   */
  static autoOptimizeTable(tableSelector, options = {}) {
    const table = document.querySelector(tableSelector);
    if (!table) {
      console.warn(`TableHelper: Tabelle mit Selektor "${tableSelector}" nicht gefunden`);
      return;
    }
    
    this.optimizeTableColumns(table, options.columnConfig || {});
    
    // Container-Optimierung - kein horizontaler Scroll mehr
    const container = table.closest('.data-table-container');
    if (container) {
      container.style.overflow = 'visible';
      container.style.boxShadow = 'none';
    }
    
    // Tabellen-Optimierung für bessere Platzausnutzung
    table.style.width = '100%';
    table.style.tableLayout = 'auto';
    
    console.log(`✅ TableHelper: Tabelle "${tableSelector}" optimiert`);
  }
  
  /**
   * Formatiert Ansprechpartner-Listen für bessere Darstellung
   * @param {HTMLElement} cell - Die Tabellenzelle
   * @param {Array} contacts - Array von Kontakten
   */
  static formatContactList(cell, contacts) {
    if (!contacts || contacts.length === 0) {
      cell.textContent = '-';
      return;
    }
    
    const contactList = document.createElement('div');
    contactList.className = 'contact-list';
    
    contacts.forEach(contact => {
      const contactItem = document.createElement('div');
      contactItem.className = 'contact-item';
      
      if (contact.link) {
        const link = document.createElement('a');
        link.href = contact.link;
        link.textContent = contact.name;
        link.onclick = (e) => {
          e.preventDefault();
          if (window.navigateTo) {
            window.navigateTo(contact.link);
          }
        };
        contactItem.appendChild(link);
      } else {
        contactItem.textContent = contact.name || contact;
      }
      
      contactList.appendChild(contactItem);
    });
    
    cell.innerHTML = '';
    cell.appendChild(contactList);
  }
}

// Global verfügbar machen
if (typeof window !== 'undefined') {
  window.TableHelper = TableHelper;
}

export default TableHelper;
