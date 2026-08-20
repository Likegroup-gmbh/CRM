// TableExport.js (ES6-Modul)
// Export-Utility für Tabellendaten als CSV oder XLSX

import * as XLSX from 'xlsx';
import { icon } from '../core/icons/IconSystem.js';

/**
 * TableExport - Utility zum Exportieren von Tabellendaten
 */
export const tableExport = {
  /**
   * Formatiert einen Wert für den Export
   */
  formatValue(value, type = 'text') {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'date':
        if (!value) return '';
        try {
          return new Date(value).toLocaleDateString('de-DE');
        } catch {
          return value;
        }
      
      case 'currency':
        if (typeof value === 'number') {
          return value.toLocaleString('de-DE', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          });
        }
        return value;
      
      case 'boolean':
        return value ? 'Ja' : 'Nein';
      
      default:
        return String(value);
    }
  },

  /**
   * Extrahiert Wert aus verschachteltem Objekt
   */
  getNestedValue(obj, path) {
    if (!path) return obj;
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value === null || value === undefined) return '';
      value = value[key];
    }
    return value ?? '';
  },

  /**
   * Bereitet Daten für Export vor
   * @param {Array} data - Rohdaten
   * @param {Array} columns - Spaltenkonfiguration [{key, label, type?, path?}]
   */
  prepareData(data, columns) {
    // Header-Zeile
    const headers = columns.map(col => col.label);
    
    // Datenzeilen
    const rows = data.map(item => {
      return columns.map(col => {
        const value = col.path 
          ? this.getNestedValue(item, col.path)
          : item[col.key];
        return this.formatValue(value, col.type);
      });
    });
    
    return [headers, ...rows];
  },

  /**
   * Exportiert als CSV mit BOM für Excel-Kompatibilität
   */
  exportToCSV(data, columns, filename = 'export') {
    const preparedData = this.prepareData(data, columns);
    
    // CSV-String erstellen mit Semikolon als Trennzeichen (Excel-Standard in DE)
    const csvContent = preparedData
      .map(row => row.map(cell => {
        // Escape quotes und wrap in quotes wenn nötig
        const cellStr = String(cell);
        if (cellStr.includes(';') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(';'))
      .join('\r\n');
    
    // BOM für UTF-8 (damit Excel deutsche Umlaute korrekt anzeigt)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    
    this.downloadBlob(blob, `${filename}.csv`);
    console.log(`✅ CSV Export: ${filename}.csv (${data.length} Zeilen)`);
  },

  /**
   * Exportiert als XLSX (echte Excel-Datei)
   */
  exportToXLSX(data, columns, filename = 'export') {
    const preparedData = this.prepareData(data, columns);
    
    // Worksheet erstellen
    const ws = XLSX.utils.aoa_to_sheet(preparedData);
    
    // Spaltenbreiten automatisch anpassen
    const colWidths = columns.map((col, idx) => {
      const maxLength = Math.max(
        col.label.length,
        ...preparedData.slice(1).map(row => String(row[idx]).length)
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
    ws['!cols'] = colWidths;
    
    // Workbook erstellen
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daten');
    
    // Download
    XLSX.writeFile(wb, `${filename}.xlsx`);
    console.log(`✅ XLSX Export: ${filename}.xlsx (${data.length} Zeilen)`);
  },

  /**
   * Hilfsfunktion für Blob-Download
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Rendert Export-Button mit Dropdown
   * @param {string} containerId - ID für Event-Binding
   */
  renderExportButton(containerId = 'export') {
    return `
      <div class="export-dropdown" id="${containerId}-export-dropdown">
        <button class="mdc-btn mdc-btn--secondary" id="${containerId}-export-btn">
          ${icon('download')}
          Export
        </button>
        <div class="export-dropdown-menu" id="${containerId}-export-menu">
          <button class="export-dropdown-item" data-format="csv">
            ${icon('document-chart')}
            CSV
          </button>
          <button class="export-dropdown-item" data-format="xlsx">
            ${icon('table-grid')}
            XLSX
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Bindet Events für Export-Button
   * @param {string} containerId - ID Prefix
   * @param {Function} onExport - Callback mit format ('csv' | 'xlsx')
   */
  bindExportEvents(containerId, onExport) {
    const btn = document.getElementById(`${containerId}-export-btn`);
    const menu = document.getElementById(`${containerId}-export-menu`);
    const dropdown = document.getElementById(`${containerId}-export-dropdown`);
    
    if (!btn || !menu) return;

    if (this._exportAbort) this._exportAbort.abort();
    this._exportAbort = new AbortController();
    const signal = this._exportAbort.signal;
    
    // Toggle Dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    }, { signal });
    
    // Format auswählen
    menu.querySelectorAll('.export-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = item.dataset.format;
        dropdown.classList.remove('show');
        onExport(format);
      }, { signal });
    });
    
    // Schließen bei Klick außerhalb
    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    }, { signal });
  }
};

export default tableExport;

