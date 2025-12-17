// TableExport.js (ES6-Modul)
// Export-Utility für Tabellendaten als CSV oder XLSX

import * as XLSX from 'xlsx';

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
        <button class="secondary-btn" id="${containerId}-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export
        </button>
        <div class="export-dropdown-menu" id="${containerId}-export-menu">
          <button class="export-dropdown-item" data-format="csv">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            CSV
          </button>
          <button class="export-dropdown-item" data-format="xlsx">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
            </svg>
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
    
    // Toggle Dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    
    // Format auswählen
    menu.querySelectorAll('.export-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = item.dataset.format;
        dropdown.classList.remove('open');
        onExport(format);
      });
    });
    
    // Schließen bei Klick außerhalb
    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
    });
  }
};

export default tableExport;

