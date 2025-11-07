// GridEditor.js
// Hauptkomponente die GridRenderer, GridController und AutoSaveManager zusammenbringt

import { GridRenderer } from './GridRenderer.js';
import { GridController } from './GridController.js';
import { GridResizeController } from './GridResizeController.js';
import { AutoSaveManager } from './AutoSaveManager.js';

export class GridEditor {
  constructor(documentId, documentName, metadata = {}) {
    this.documentId = documentId;
    this.documentName = documentName;
    this.metadata = metadata;
    this.renderer = null;
    this.controller = null;
    this.resizeController = null;
    this.autoSaveManager = null;
    this.container = null;
  }

  // Initialisiere Editor
  async init(container) {
    this.container = container;

    // Gesamtes Grid-Layout als HTML
    const html = `
      <div class="grid-editor-wrapper">
        <div class="grid-editor-header">
          <div class="grid-editor-title">
            <button class="back-btn" id="back-to-list">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Zurück
            </button>
            <h2 class="document-name">${this.escapeHtml(this.documentName)}</h2>
            <div id="save-indicator" class="save-indicator" style="display: none;">Gespeichert</div>
          </div>
          <div class="grid-toolbar">
            <button class="toolbar-btn" id="add-row-btn" title="Zeile hinzufügen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Zeile hinzufügen
            </button>
            <button class="toolbar-btn" id="add-col-btn" title="Spalte hinzufügen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Spalte hinzufügen
            </button>
          </div>
        </div>
        <div class="grid-editor-content" id="grid-container"></div>
      </div>
    `;

    window.setContentSafely(container, html);

    // Grid-Container Referenz holen
    const gridContainer = container.querySelector('#grid-container');

    // AutoSaveManager initialisieren
    this.autoSaveManager = new AutoSaveManager(this.documentId);

    // Renderer initialisieren
    this.renderer = new GridRenderer(gridContainer, {
      rows: 20,
      cols: 10
    });

    // Controller initialisieren
    this.controller = new GridController(this.renderer, this.autoSaveManager);

    // Resize-Controller initialisieren
    this.resizeController = new GridResizeController(this.renderer, () => {
      this.updateMetadata(this.renderer.exportMetadata());
    });

    // Lade Zell-Daten aus Datenbank
    await this.loadData();

    // Lade Column Headers aus Metadata
    this.renderer.loadColumnHeaders(this.metadata);

    // Rendere Grid
    this.renderer.render();

    // Starte Controller (Event-Handling)
    this.controller.init();
    
    // Starte Resize-Controller
    this.resizeController.init();

    // Bind Toolbar-Events
    this.bindToolbarEvents();

    // Setze globale Referenz für Controller
    window.currentGridEditor = this;
  }

  // Lade Zell-Daten aus Supabase
  async loadData() {
    try {
      const cellsMap = await this.autoSaveManager.loadAllCells();
      this.renderer.loadCellsData(cellsMap);
      console.log(`✅ ${cellsMap.size} Zellen geladen`);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Daten:', error);
      alert('Fehler beim Laden der Tabelle');
    }
  }

  // Bind Toolbar Events
  bindToolbarEvents() {
    // Zurück-Button
    const backBtn = document.getElementById('back-to-list');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.navigateTo('/tabellen');
      });
    }

    // Zeile hinzufügen
    const addRowBtn = document.getElementById('add-row-btn');
    if (addRowBtn) {
      addRowBtn.addEventListener('click', () => {
        this.renderer.addRow();
      });
    }

    // Spalte hinzufügen
    const addColBtn = document.getElementById('add-col-btn');
    if (addColBtn) {
      addColBtn.addEventListener('click', () => {
        this.renderer.addColumn();
      });
    }
  }

  // Update Metadata in Datenbank
  async updateMetadata(updates) {
    try {
      this.metadata = { ...this.metadata, ...updates };

      const { error } = await window.supabase
        .from('grid_documents')
        .update({ metadata: this.metadata })
        .eq('id', this.documentId);

      if (error) throw error;
      
      console.log('✅ Metadata gespeichert');

    } catch (error) {
      console.error('❌ Fehler beim Speichern der Metadata:', error);
    }
  }

  // Hilfsfunktion
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Cleanup
  destroy() {
    console.log('🗑️ GridEditor: Destroy aufgerufen');
    
    if (this.autoSaveManager) {
      this.autoSaveManager.destroy();
    }
    
    if (this.controller) {
      this.controller.destroy();
    }
    
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

