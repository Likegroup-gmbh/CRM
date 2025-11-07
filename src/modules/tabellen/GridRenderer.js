// GridRenderer.js
// Rendert das HTML-Table-basierte Grid

export class GridRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.rows = options.rows || 20;
    this.cols = options.cols || 10;
    this.cellsData = new Map(); // Speichert Zelldaten: "row_col" -> {value, style}
    this.columnHeaders = new Map(); // Speichert Spalten-Namen: col -> name
    this.columnWidths = new Map(); // Speichert Spalten-Breiten: col -> width (px)
    this.rowHeights = new Map(); // Speichert Zeilen-Höhen: row -> height (px)
    this.mergedCells = new Map(); // Speichert zusammengeführte Zellen: "row_col" -> {rowspan, colspan}
  }

  // Rendert das komplette Grid
  render() {
    const gridHtml = `
      <div class="grid-wrapper">
        <table class="grid-table" id="grid-table">
          <thead>
            <tr>
              <th class="row-header"></th>
              ${this.renderColumnHeaders()}
            </tr>
          </thead>
          <tbody>
            ${this.renderRows()}
          </tbody>
        </table>
      </div>
    `;

    this.container.innerHTML = gridHtml;
    
    // Update sticky positions nach dem Rendern
    this.updateStickyPositions();
  }

  // Rendert Spalten-Header (editierbar, initial leer)
  renderColumnHeaders() {
    let html = '';
    for (let col = 0; col < this.cols; col++) {
      const headerName = this.columnHeaders.get(col) || '';
      const width = this.columnWidths.get(col) || 120;
      html += `
        <th class="col-header" data-col="${col}" style="width: ${width}px; min-width: ${width}px;">
          <div class="col-header-content">
            <span class="col-name editable-header" data-col="${col}">${this.escapeHtml(headerName)}</span>
            <button class="col-menu-btn" data-col="${col}" title="Spaltenmenü">⋮</button>
          </div>
          <div class="resize-handle resize-handle-col" data-col="${col}"></div>
        </th>
      `;
    }
    return html;
  }

  // Rendert alle Zeilen
  renderRows() {
    let html = '';
    for (let row = 0; row < this.rows; row++) {
      html += this.renderRow(row);
    }
    return html;
  }

  // Rendert eine einzelne Zeile
  renderRow(row) {
    const height = this.rowHeights.get(row) || 32;
    let html = `
      <tr data-row="${row}" style="height: ${height}px;">
        <td class="row-header" style="position: relative;">
          <div class="row-header-content">
            <span class="row-number">${row + 1}</span>
            <button class="row-menu-btn" data-row="${row}" title="Zeilenmenü">⋮</button>
          </div>
          <div class="resize-handle resize-handle-row" data-row="${row}"></div>
        </td>
    `;

    for (let col = 0; col < this.cols; col++) {
      const key = `${row}_${col}`;
      const mergeInfo = this.mergedCells.get(key);
      
      // Skip wenn diese Zelle Teil einer zusammengeführten Zelle ist (aber nicht die Master-Zelle)
      if (this.isCellMerged(row, col) && !mergeInfo) {
        continue;
      }

      const cellData = this.cellsData.get(key);
      const value = cellData?.value || '';
      const style = cellData?.style || {};
      
      const rowspan = mergeInfo?.rowspan || 1;
      const colspan = mergeInfo?.colspan || 1;
      
      const width = this.columnWidths.get(col) || 120;
      
      html += `
        <td class="grid-cell ${mergeInfo ? 'merged-cell' : ''}" 
            data-row="${row}" 
            data-col="${col}" 
            rowspan="${rowspan}"
            colspan="${colspan}"
            style="width: ${width}px; min-width: ${width}px;"
            ${this.getCellStyleAttrs(style)}>
          <div class="cell-content">${this.escapeHtml(value)}</div>
        </td>
      `;
    }

    html += `</tr>`;
    return html;
  }

  // Setzt Spalten-Header Name
  setColumnHeader(col, name) {
    this.columnHeaders.set(col, name);
    
    // Update DOM
    const headerSpan = this.container.querySelector(`.col-name[data-col="${col}"]`);
    if (headerSpan) {
      headerSpan.textContent = name;
    }
  }

  // Holt Spalten-Header Name
  getColumnHeader(col) {
    return this.columnHeaders.get(col) || '';
  }

  // Lädt Column Headers aus Metadata
  loadColumnHeaders(metadata) {
    if (metadata && metadata.columnHeaders) {
      this.columnHeaders = new Map(Object.entries(metadata.columnHeaders).map(([k, v]) => [parseInt(k), v]));
    }
    if (metadata && metadata.columnWidths) {
      this.columnWidths = new Map(Object.entries(metadata.columnWidths).map(([k, v]) => [parseInt(k), v]));
    }
    if (metadata && metadata.rowHeights) {
      this.rowHeights = new Map(Object.entries(metadata.rowHeights).map(([k, v]) => [parseInt(k), v]));
    }
    if (metadata && metadata.mergedCells) {
      this.mergedCells = new Map(Object.entries(metadata.mergedCells));
    }
  }

  // Exportiert Column Headers für Metadata
  exportColumnHeaders() {
    const headers = {};
    this.columnHeaders.forEach((name, col) => {
      if (name) {
        headers[col] = name;
      }
    });
    return headers;
  }

  // Exportiert alle Metadata
  exportMetadata() {
    const columnHeaders = {};
    this.columnHeaders.forEach((name, col) => {
      if (name) columnHeaders[col] = name;
    });

    const columnWidths = {};
    this.columnWidths.forEach((width, col) => {
      columnWidths[col] = width;
    });

    const rowHeights = {};
    this.rowHeights.forEach((height, row) => {
      rowHeights[row] = height;
    });

    const mergedCells = {};
    this.mergedCells.forEach((info, key) => {
      mergedCells[key] = info;
    });

    return { columnHeaders, columnWidths, rowHeights, mergedCells };
  }

  // Setzt Spaltenbreite
  setColumnWidth(col, width) {
    this.columnWidths.set(col, width);
    
    // Update DOM
    const header = this.container.querySelector(`th.col-header[data-col="${col}"]`);
    if (header) {
      header.style.width = `${width}px`;
      header.style.minWidth = `${width}px`;
    }

    // Update alle Zellen in dieser Spalte
    const cells = this.container.querySelectorAll(`td.grid-cell[data-col="${col}"]`);
    cells.forEach(cell => {
      cell.style.width = `${width}px`;
      cell.style.minWidth = `${width}px`;
    });
    
    // Update sticky positions für Spalte 1 (falls Spalte 0 geändert wurde)
    if (col === 0) {
      this.updateStickyPositions();
    }
  }
  
  // Update sticky positions für fixierte Spalten
  updateStickyPositions() {
    const col0Width = this.columnWidths.get(0) || 120;
    const rowHeaderWidth = 60;
    const leftPosCol1 = rowHeaderWidth + col0Width;
    
    // Update Header für Spalte 1
    const header1 = this.container.querySelector(`th.col-header[data-col="1"]`);
    if (header1) {
      header1.style.left = `${leftPosCol1}px`;
    }
    
    // Update alle Zellen in Spalte 1
    const cells1 = this.container.querySelectorAll(`td.grid-cell[data-col="1"]`);
    cells1.forEach(cell => {
      cell.style.left = `${leftPosCol1}px`;
    });
  }

  // Setzt Zeilenhöhe
  setRowHeight(row, height) {
    this.rowHeights.set(row, height);
    
    // Update DOM
    const tr = this.container.querySelector(`tr[data-row="${row}"]`);
    if (tr) {
      tr.style.height = `${height}px`;
    }
  }

  // Merged Cells
  mergeCells(startRow, startCol, endRow, endCol) {
    const rowspan = endRow - startRow + 1;
    const colspan = endCol - startCol + 1;
    
    if (rowspan === 1 && colspan === 1) return; // Keine Merge nötig

    const masterKey = `${startRow}_${startCol}`;
    this.mergedCells.set(masterKey, { rowspan, colspan });

    // Markiere alle anderen Zellen als Teil der Merge
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r !== startRow || c !== startCol) {
          const key = `${r}_${c}`;
          // Speichere Referenz zur Master-Zelle
          this.mergedCells.set(key, { master: masterKey });
        }
      }
    }

    this.render();
  }

  // Unmerge Cells
  unmergeCells(row, col) {
    const key = `${row}_${col}`;
    const mergeInfo = this.mergedCells.get(key);
    
    if (!mergeInfo) return;

    // Wenn das eine merged child cell ist, finde die master
    if (mergeInfo.master) {
      const [masterRow, masterCol] = mergeInfo.master.split('_').map(Number);
      this.unmergeCells(masterRow, masterCol);
      return;
    }

    // Master cell - entferne alle merge infos
    const { rowspan, colspan } = mergeInfo;
    for (let r = row; r < row + rowspan; r++) {
      for (let c = col; c < col + colspan; c++) {
        this.mergedCells.delete(`${r}_${c}`);
      }
    }

    this.render();
  }

  // Prüfe ob Zelle gemerged ist
  isCellMerged(row, col) {
    const key = `${row}_${col}`;
    const info = this.mergedCells.get(key);
    return info && info.master !== undefined;
  }

  // Exportiert Column Headers für Metadata (deprecated, use exportMetadata)
  exportColumnHeaders() {
    const headers = {};
    this.columnHeaders.forEach((name, col) => {
      if (name) {
        headers[col] = name;
      }
    });
    return headers;
  }

  // Konvertiert Spalten-Index zu Buchstaben (0 -> A, 1 -> B, ..., 26 -> AA)
  getColumnName(col) {
    let name = '';
    col = col + 1; // 1-basiert
    while (col > 0) {
      const remainder = (col - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      col = Math.floor((col - 1) / 26);
    }
    return name;
  }

  // Setzt Zell-Wert und Updated UI
  setCellValue(row, col, value) {
    const key = `${row}_${col}`;
    const cellData = this.cellsData.get(key) || {};
    cellData.value = value;
    this.cellsData.set(key, cellData);

    // Update DOM
    const cell = this.getCellElement(row, col);
    if (cell) {
      const content = cell.querySelector('.cell-content');
      if (content) {
        content.textContent = value;
      }
    }
  }

  // Holt Zell-Wert
  getCellValue(row, col) {
    const key = `${row}_${col}`;
    return this.cellsData.get(key)?.value || '';
  }

  // Setzt Zell-Style
  setCellStyle(row, col, style) {
    const key = `${row}_${col}`;
    const cellData = this.cellsData.get(key) || {};
    cellData.style = { ...cellData.style, ...style };
    this.cellsData.set(key, cellData);

    // Update DOM
    const cell = this.getCellElement(row, col);
    if (cell) {
      this.applyCellStyle(cell, cellData.style);
    }
  }

  // Lädt Zell-Daten aus Map
  loadCellsData(cellsMap) {
    this.cellsData.clear();
    
    cellsMap.forEach((cellData, key) => {
      this.cellsData.set(key, {
        value: cellData.value,
        style: cellData.style || {}
      });
    });

    // Re-render um Daten anzuzeigen
    this.render();
  }

  // Fügt neue Zeile hinzu
  addRow() {
    this.rows++;
    
    // Füge neue Zeile im DOM hinzu
    const tbody = this.container.querySelector('tbody');
    if (tbody) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.renderRow(this.rows - 1);
      tbody.appendChild(tempDiv.firstElementChild);
    }
  }

  // Fügt neue Spalte hinzu
  addColumn() {
    this.cols++;
    this.render(); // Full re-render für neue Spalte (einfacher)
  }

  // Löscht Zeile
  deleteRow(row) {
    // Entferne aus cellsData
    for (let col = 0; col < this.cols; col++) {
      const key = `${row}_${col}`;
      this.cellsData.delete(key);
    }

    // Verschiebe alle Zeilen nach unten
    const newCellsData = new Map();
    this.cellsData.forEach((data, key) => {
      const [r, c] = key.split('_').map(Number);
      if (r > row) {
        newCellsData.set(`${r - 1}_${c}`, data);
      } else if (r < row) {
        newCellsData.set(key, data);
      }
    });
    this.cellsData = newCellsData;

    this.rows--;
    this.render();
  }

  // Löscht Spalte
  deleteColumn(col) {
    // Entferne aus cellsData
    for (let row = 0; row < this.rows; row++) {
      const key = `${row}_${col}`;
      this.cellsData.delete(key);
    }

    // Verschiebe alle Spalten nach links
    const newCellsData = new Map();
    this.cellsData.forEach((data, key) => {
      const [r, c] = key.split('_').map(Number);
      if (c > col) {
        newCellsData.set(`${r}_${c - 1}`, data);
      } else if (c < col) {
        newCellsData.set(key, data);
      }
    });
    this.cellsData = newCellsData;

    this.cols--;
    this.render();
  }

  // Hilfsfunktionen
  getCellElement(row, col) {
    return this.container.querySelector(`td.grid-cell[data-row="${row}"][data-col="${col}"]`);
  }

  getCellStyleAttrs(style) {
    let attrs = '';
    if (style.bold) attrs += ' data-bold="true"';
    if (style.color) attrs += ` data-color="${style.color}"`;
    return attrs;
  }

  applyCellStyle(cell, style) {
    if (style.bold) {
      cell.style.fontWeight = 'bold';
    } else {
      cell.style.fontWeight = 'normal';
    }
    
    if (style.color) {
      cell.style.color = style.color;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Cleanup
  destroy() {
    this.container.innerHTML = '';
    this.cellsData.clear();
    this.columnHeaders.clear();
  }
}

