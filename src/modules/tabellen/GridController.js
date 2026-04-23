// GridController.js
// Event-Handling und Keyboard-Navigation für das Grid

export class GridController {
  constructor(renderer, autoSaveManager) {
    this.renderer = renderer;
    this.autoSaveManager = autoSaveManager;
    this.selectedCell = null;
    this.editingCell = null;
    this.container = renderer.container;
    this._abortController = new AbortController();
  }

  // Initialisiere Event-Listener
  init() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    this.bindCellEvents();
    this.bindHeaderEvents();
    this.bindKeyboardEvents();
    this.bindMenuEvents();
  }

  // Bind Header-Events (für editierbare Spalten-Namen)
  bindHeaderEvents() {
    const signal = this._abortController.signal;
    this.container.addEventListener('dblclick', (e) => {
      const header = e.target.closest('.editable-header');
      if (header) {
        const col = parseInt(header.dataset.col);
        this.startHeaderEdit(col);
      }
    }, { signal });
  }

  // Bind Cell-Click Events
  bindCellEvents() {
    const signal = this._abortController.signal;
    this.container.addEventListener('click', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.selectCell(row, col);
      }
    }, { signal });

    this.container.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.startEdit(row, col);
      }
    }, { signal });
  }

  // Bind Keyboard-Navigation
  bindKeyboardEvents() {
    document.addEventListener('keydown', (e) => {
      // Nur wenn nicht im Edit-Modus
      if (this.editingCell) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          if (e.key === 'Enter') {
            this.finishEdit(true);
            // Bei Enter: Nach unten bewegen
            if (this.selectedCell) {
              this.selectCell(this.selectedCell.row + 1, this.selectedCell.col);
            }
          } else {
            this.finishEdit(false);
          }
          e.preventDefault();
        }
        return;
      }

      if (!this.selectedCell) return;

      const { row, col } = this.selectedCell;

      switch (e.key) {
        case 'ArrowUp':
          if (row > 0) this.selectCell(row - 1, col);
          e.preventDefault();
          break;
        case 'ArrowDown':
          if (row < this.renderer.rows - 1) this.selectCell(row + 1, col);
          e.preventDefault();
          break;
        case 'ArrowLeft':
          if (col > 0) this.selectCell(row, col - 1);
          e.preventDefault();
          break;
        case 'ArrowRight':
          if (col < this.renderer.cols - 1) this.selectCell(row, col + 1);
          e.preventDefault();
          break;
        case 'Tab':
          if (e.shiftKey) {
            // Shift+Tab: Nach links
            if (col > 0) {
              this.selectCell(row, col - 1);
            } else if (row > 0) {
              this.selectCell(row - 1, this.renderer.cols - 1);
            }
          } else {
            // Tab: Nach rechts
            if (col < this.renderer.cols - 1) {
              this.selectCell(row, col + 1);
            } else if (row < this.renderer.rows - 1) {
              this.selectCell(row + 1, 0);
            }
          }
          e.preventDefault();
          break;
        case 'Enter':
          this.startEdit(row, col);
          e.preventDefault();
          break;
        case 'Delete':
        case 'Backspace':
          this.clearCell(row, col);
          e.preventDefault();
          break;
        default:
          // Buchstabe/Zahl: Direkt Edit-Modus starten
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            this.startEdit(row, col, e.key);
            e.preventDefault();
          }
          break;
      }
    }, { signal: this._abortController.signal });
  }

  // Bind Menu-Events (Zeile/Spalte hinzufügen/löschen)
  bindMenuEvents() {
    const signal = this._abortController.signal;
    // Row-Menu
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('row-menu-btn')) {
        const row = parseInt(e.target.dataset.row);
        this.showRowMenu(e.target, row);
        e.stopPropagation();
      }
    }, { signal });

    // Col-Menu
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('col-menu-btn')) {
        const col = parseInt(e.target.dataset.col);
        this.showColumnMenu(e.target, col);
        e.stopPropagation();
      }
    }, { signal });
  }

  // Starte Header-Edit
  startHeaderEdit(col) {
    const headerSpan = this.container.querySelector(`.col-name[data-col="${col}"]`);
    if (!headerSpan) return;

    const currentName = this.renderer.getColumnHeader(col);
    
    // Erstelle Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'header-input';
    input.value = currentName;
    input.style.width = '100px';
    
    // Ersetze Span durch Input
    headerSpan.style.display = 'none';
    headerSpan.parentElement.insertBefore(input, headerSpan);
    input.focus();
    input.select();

    // Events
    const finishEdit = (save) => {
      const newName = save ? input.value.trim() : currentName;
      
      if (save && newName !== currentName) {
        this.renderer.setColumnHeader(col, newName);
        // Speichere Metadata
        this.saveColumnHeaders();
      }
      
      input.remove();
      headerSpan.style.display = '';
    };

    input.addEventListener('blur', () => finishEdit(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEdit(true);
      } else if (e.key === 'Escape') {
        finishEdit(false);
      }
    });
  }

  // Speichere Spalten-Header in Metadata
  async saveColumnHeaders() {
    const columnHeaders = this.renderer.exportColumnHeaders();
    
    // Update metadata in Datenbank via AutoSaveManager
    // (Wir müssen das über das GridEditor Objekt machen)
    if (window.currentGridEditor) {
      await window.currentGridEditor.updateMetadata({ 
        columnHeaders,
        columnWidths: this.exportColumnWidths(),
        rowHeights: this.exportRowHeights()
      });
    }
  }

  // Exportiert Column Widths
  exportColumnWidths() {
    const widths = {};
    this.renderer.columnWidths.forEach((width, col) => {
      widths[col] = width;
    });
    return widths;
  }

  // Exportiert Row Heights
  exportRowHeights() {
    const heights = {};
    this.renderer.rowHeights.forEach((height, row) => {
      heights[row] = height;
    });
    return heights;
  }

  // Selektiere Zelle
  selectCell(row, col) {
    // Entferne alte Selektion
    const oldSelected = this.container.querySelector('.grid-cell.selected');
    if (oldSelected) {
      oldSelected.classList.remove('selected');
    }

    // Setze neue Selektion
    this.selectedCell = { row, col };
    const cell = this.renderer.getCellElement(row, col);
    if (cell) {
      cell.classList.add('selected');
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // Starte Edit-Modus
  startEdit(row, col, initialChar = null) {
    if (this.editingCell) {
      this.finishEdit(true);
    }

    const cell = this.renderer.getCellElement(row, col);
    if (!cell) return;

    const currentValue = this.renderer.getCellValue(row, col);
    const content = cell.querySelector('.cell-content');
    if (!content) return;

    // Erstelle Input-Element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.value = initialChar !== null ? initialChar : currentValue;
    
    // Ersetze Content durch Input
    content.style.display = 'none';
    cell.appendChild(input);
    input.focus();
    input.select();

    this.editingCell = { row, col, input, content };

    // Input-Events
    input.addEventListener('blur', () => {
      this.finishEdit(true);
    });
  }

  // Beende Edit-Modus
  finishEdit(save = true) {
    if (!this.editingCell) return;

    const { row, col, input, content } = this.editingCell;
    const newValue = save ? input.value : this.renderer.getCellValue(row, col);

    // Update Renderer und Auto-Save
    if (save) {
      this.renderer.setCellValue(row, col, newValue);
      this.autoSaveManager.queueCellSave(row, col, newValue);
    }

    // Cleanup
    input.remove();
    content.style.display = '';
    this.editingCell = null;
  }

  // Lösche Zelle
  clearCell(row, col) {
    this.renderer.setCellValue(row, col, '');
    this.autoSaveManager.queueCellSave(row, col, '');
  }

  // Zeige Row-Context-Menu
  showRowMenu(button, row) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="context-menu-item" data-action="insert-row-above">Zeile darüber einfügen</button>
      <button class="context-menu-item" data-action="insert-row-below">Zeile darunter einfügen</button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item danger" data-action="delete-row">Zeile löschen</button>
    `;

    // Position
    const rect = button.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom}px`;
    menu.style.left = `${rect.left}px`;

    document.body.appendChild(menu);

    // Events
    menu.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (action === 'insert-row-above') {
        this.renderer.addRow();
        // Verschiebe Daten nach unten (TODO)
      } else if (action === 'insert-row-below') {
        this.renderer.addRow();
      } else if (action === 'delete-row') {
        if (confirm(`Zeile ${row + 1} wirklich löschen?`)) {
          this.renderer.deleteRow(row);
          await this.autoSaveManager.deleteRow(row);
        }
      }
      menu.remove();
    });

    // Schließe Menu bei Klick außerhalb
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  }

  // Zeige Column-Context-Menu
  showColumnMenu(button, col) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="context-menu-item" data-action="insert-col-left">Spalte links einfügen</button>
      <button class="context-menu-item" data-action="insert-col-right">Spalte rechts einfügen</button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item danger" data-action="delete-col">Spalte löschen</button>
    `;

    // Position
    const rect = button.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom}px`;
    menu.style.left = `${rect.left}px`;

    document.body.appendChild(menu);

    // Events
    menu.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      const colName = this.renderer.getColumnName(col);
      
      if (action === 'insert-col-left') {
        this.renderer.addColumn();
      } else if (action === 'insert-col-right') {
        this.renderer.addColumn();
      } else if (action === 'delete-col') {
        if (confirm(`Spalte ${colName} wirklich löschen?`)) {
          this.renderer.deleteColumn(col);
          await this.autoSaveManager.deleteColumn(col);
        }
      }
      menu.remove();
    });

    // Schließe Menu bei Klick außerhalb
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  }

  // Dialog für Zellen verbinden (DEAKTIVIERT)
  // Dialog für Zellen verbinden (DEAKTIVIERT)
  promptMergeCells(startRow, startCol) {
    alert('Zellen-Verbinden Funktion ist aktuell deaktiviert');
    /*
    const endRow = prompt(`Bis Zeile (Start: ${startRow + 1}):`, startRow + 1);
    const endCol = prompt(`Bis Spalte (Start: ${this.renderer.getColumnName(startCol)}):`, this.renderer.getColumnName(startCol));
    
    if (!endRow || !endCol) return;

    const endRowNum = parseInt(endRow) - 1;
    const endColNum = this.columnNameToIndex(endCol);

    if (endRowNum >= startRow && endColNum >= startCol) {
      this.renderer.mergeCells(startRow, startCol, endRowNum, endColNum);
      this.saveMetadata();
    } else {
      alert('Ungültige Auswahl');
    }
    */
  }

  // Konvertiert Spalten-Name zu Index (A -> 0, B -> 1, AA -> 26)
  columnNameToIndex(name) {
    let index = 0;
    for (let i = 0; i < name.length; i++) {
      index = index * 26 + (name.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  // Speichere Metadata
  async saveMetadata() {
    if (window.currentGridEditor) {
      await window.currentGridEditor.updateMetadata(this.renderer.exportMetadata());
    }
  }

  // Cleanup
  destroy() {
    this._abortController.abort();
    if (this.editingCell) {
      this.finishEdit(false);
    }
  }
}

