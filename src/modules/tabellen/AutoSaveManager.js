// AutoSaveManager.js
// Verwaltet das automatische Speichern von Grid-Änderungen in Supabase

export class AutoSaveManager {
  constructor(documentId) {
    this.documentId = documentId;
    this.saveTimeout = null;
    this.pendingChanges = new Map(); // row_col -> {row, col, value, style}
    this.isSaving = false;
    this.saveDelay = 500; // ms
  }

  // Ändernde Zelle zur Warteschlange hinzufügen
  queueCellSave(row, col, value, style = {}) {
    const key = `${row}_${col}`;
    this.pendingChanges.set(key, { row, col, value, style });
    
    // Debounce: Timer zurücksetzen
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.processSaveQueue();
    }, this.saveDelay);
  }

  // Verarbeite alle ausstehenden Änderungen
  async processSaveQueue() {
    if (this.isSaving || this.pendingChanges.size === 0) {
      return;
    }

    this.isSaving = true;
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    try {
      console.log(`💾 Speichere ${changes.length} Zellen...`);
      
      // Zeige Speicher-Indikator
      this.showSavingIndicator();

      // Upsert für jede Zelle (Insert oder Update)
      const promises = changes.map(change => this.saveCellToDatabase(change));
      await Promise.all(promises);

      console.log('✅ Alle Änderungen gespeichert');
      this.showSavedIndicator();

    } catch (error) {
      console.error('❌ Fehler beim Speichern:', error);
      this.showErrorIndicator();
      
      // Bei Fehler: Änderungen wieder in die Queue
      changes.forEach(change => {
        const key = `${change.row}_${change.col}`;
        this.pendingChanges.set(key, change);
      });
      
      // Retry nach 2 Sekunden
      setTimeout(() => this.processSaveQueue(), 2000);
    } finally {
      this.isSaving = false;
    }
  }

  // Speichere einzelne Zelle in Supabase
  async saveCellToDatabase({ row, col, value, style }) {
    const { error } = await window.supabase
      .from('grid_cells')
      .upsert({
        document_id: this.documentId,
        row,
        col,
        value: value || null,
        style: style || {}
      }, {
        onConflict: 'document_id,row,col'
      });

    if (error) {
      throw error;
    }
  }

  // Lade alle Zellen für dieses Dokument
  async loadAllCells() {
    try {
      const { data, error } = await window.supabase
        .from('grid_cells')
        .select('*')
        .eq('document_id', this.documentId);

      if (error) throw error;

      // Konvertiere zu Map für schnellen Zugriff
      const cellsMap = new Map();
      if (data) {
        data.forEach(cell => {
          const key = `${cell.row}_${cell.col}`;
          cellsMap.set(key, cell);
        });
      }

      return cellsMap;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Zellen:', error);
      throw error;
    }
  }

  // Lösche eine Zelle aus der Datenbank
  async deleteCell(row, col) {
    try {
      const { error } = await window.supabase
        .from('grid_cells')
        .delete()
        .eq('document_id', this.documentId)
        .eq('row', row)
        .eq('col', col);

      if (error) throw error;
      console.log(`🗑️ Zelle (${row}, ${col}) gelöscht`);

    } catch (error) {
      console.error('❌ Fehler beim Löschen der Zelle:', error);
      throw error;
    }
  }

  // Lösche gesamte Zeile
  async deleteRow(row) {
    try {
      const { error } = await window.supabase
        .from('grid_cells')
        .delete()
        .eq('document_id', this.documentId)
        .eq('row', row);

      if (error) throw error;
      console.log(`🗑️ Zeile ${row} gelöscht`);

    } catch (error) {
      console.error('❌ Fehler beim Löschen der Zeile:', error);
      throw error;
    }
  }

  // Lösche gesamte Spalte
  async deleteColumn(col) {
    try {
      const { error } = await window.supabase
        .from('grid_cells')
        .delete()
        .eq('document_id', this.documentId)
        .eq('col', col);

      if (error) throw error;
      console.log(`🗑️ Spalte ${col} gelöscht`);

    } catch (error) {
      console.error('❌ Fehler beim Löschen der Spalte:', error);
      throw error;
    }
  }

  // UI-Indikatoren
  showSavingIndicator() {
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
      indicator.textContent = 'Speichert...';
      indicator.className = 'save-indicator saving';
      indicator.style.display = 'block';
    }
  }

  showSavedIndicator() {
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
      indicator.textContent = 'Gespeichert';
      indicator.className = 'save-indicator saved';
      indicator.style.display = 'block';
      
      // Ausblenden nach 2 Sekunden
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 2000);
    }
  }

  showErrorIndicator() {
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
      indicator.textContent = 'Fehler beim Speichern';
      indicator.className = 'save-indicator error';
      indicator.style.display = 'block';
    }
  }

  // Cleanup
  destroy() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // Versuche noch ausstehende Änderungen zu speichern
    if (this.pendingChanges.size > 0) {
      this.processSaveQueue();
    }
  }
}














