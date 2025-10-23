// BulkActionSystem.js (ES6-Modul)
// Generisches System für Bulk-Aktionen in allen Listen

export class BulkActionSystem {
  constructor() {
    this.currentEntityType = null;
    this.currentListInstance = null;
    this.boundEventListeners = new Set();
  }

  // Initialisiere das System
  init() {
    console.log('🔧 BulkActionSystem: Initialisiere...');
    this.bindGlobalEvents();
  }

  // Registriere eine Liste für Bulk-Aktionen
  registerList(entityType, listInstance) {
    console.log(`🔧 BulkActionSystem: Registriere ${entityType} Liste`);
    
    // Setze immer als aktuelle Liste (das aktuell geladene Modul ist das aktive)
    this.currentEntityType = entityType;
    this.currentListInstance = listInstance;
    
    console.log(`✅ BulkActionSystem: ${entityType} als aktive Liste gesetzt`, {
      hasDeleteMethod: typeof listInstance.showDeleteSelectedConfirmation === 'function',
      currentPath: window.location.pathname
    });
  }

  // Aktualisiere die aktive Liste basierend auf der aktuellen Route
  updateActiveList() {
    const currentPath = window.location.pathname;
    console.log(`🔧 BulkActionSystem: Prüfe aktuelle Route: ${currentPath}`);
    
    // Erkenne Entity-Type aus URL
    const pathSegments = currentPath.split('/').filter(segment => segment);
    if (pathSegments.length > 0) {
      const entityType = pathSegments[0];
      
      // Prüfe ob wir eine entsprechende Liste haben
      const listInstanceName = `${entityType}List`;
      if (window[listInstanceName]) {
        this.currentEntityType = entityType;
        this.currentListInstance = window[listInstanceName];
        console.log(`✅ BulkActionSystem: ${entityType} automatisch erkannt und gesetzt`);
        return true;
      }
    }
    
    console.log('❌ BulkActionSystem: Keine passende Liste für aktuelle Route gefunden');
    return false;
  }

  // Globale Event-Listener binden
  bindGlobalEvents() {
    // Bulk-Actions: Deselect All Button
    const deselectHandler = (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        this.handleDeselectAll();
      }
    };
    document.addEventListener('click', deselectHandler);
    this.boundEventListeners.add({ element: document, type: 'click', handler: deselectHandler });

    // Bulk-Actions: Delete Selected Button
    const deleteHandler = (e) => {
      if (e.target.id === 'btn-delete-selected') {
        e.preventDefault();
        this.handleDeleteSelected();
      }
    };
    document.addEventListener('click', deleteHandler);
    this.boundEventListeners.add({ element: document, type: 'click', handler: deleteHandler });

    console.log('✅ BulkActionSystem: Globale Event-Listener registriert');
  }

  // Handle Deselect All
  handleDeselectAll() {
    console.log('🔧 BulkActionSystem: Handle Deselect All');
    
    // Versuche aktuelle Liste zu finden falls nicht gesetzt
    if (!this.currentListInstance) {
      this.updateActiveList();
    }
    
    if (this.currentListInstance && typeof this.currentListInstance.deselectAll === 'function') {
      console.log(`✅ BulkActionSystem: Rufe deselectAll() für ${this.currentEntityType} auf`);
      this.currentListInstance.deselectAll();
    } else {
      // Fallback: Versuche generisch zu deselektieren
      console.log('⚠️ BulkActionSystem: Fallback - Generische Deselection');
      this.genericDeselectAll();
    }
  }

  // Handle Delete Selected
  handleDeleteSelected() {
    console.log('🔧 BulkActionSystem: Handle Delete Selected');
    
    // Prüfe zuerst die registrierten Listen
    if (this.currentListInstance && typeof this.currentListInstance.showDeleteSelectedConfirmation === 'function') {
      console.log(`✅ BulkActionSystem: Rufe showDeleteSelectedConfirmation() für ${this.currentEntityType} auf`);
      this.currentListInstance.showDeleteSelectedConfirmation();
      return;
    }
    
    // Versuche aktuelle Liste zu finden falls nicht gesetzt
    if (!this.currentListInstance) {
      const found = this.updateActiveList();
      if (found && this.currentListInstance && typeof this.currentListInstance.showDeleteSelectedConfirmation === 'function') {
        console.log(`✅ BulkActionSystem: Nach Update gefunden - rufe showDeleteSelectedConfirmation() für ${this.currentEntityType} auf`);
        this.currentListInstance.showDeleteSelectedConfirmation();
        return;
      }
    }
    
    // Fallback: Versuche generisch zu löschen
    console.log('⚠️ BulkActionSystem: Fallback - Generische Deletion');
    this.genericDeleteSelected();
  }

  // Generische Deselect-All Funktion
  genericDeselectAll() {
    const entityType = this.detectCurrentEntityType();
    if (!entityType) {
      console.log('❌ BulkActionSystem: Kann Entity-Type nicht erkennen');
      return;
    }

    const config = this.getEntityConfig(entityType);
    const checkboxes = document.querySelectorAll(config.checkboxSelector);
    const selectAllCheckbox = document.getElementById(config.selectAllId);
    
    // Deselektiere alle Checkboxen
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    // Select-All Checkbox zurücksetzen
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    // UI-Buttons verstecken
    this.hideButtons();
    
    console.log(`✅ BulkActionSystem: Generische Deselection für ${entityType} abgeschlossen`);
  }

  // Generische Delete-Selected Funktion
  async genericDeleteSelected() {
    const entityType = this.detectCurrentEntityType();
    if (!entityType) {
      console.log('❌ BulkActionSystem: Kann Entity-Type nicht erkennen');
      return;
    }

    const config = this.getEntityConfig(entityType);
    const checkedBoxes = document.querySelectorAll(`${config.checkboxSelector}:checked`);
    
    if (checkedBoxes.length === 0) {
      alert(`Keine ${config.displayName} ausgewählt.`);
      return;
    }

    const message = checkedBoxes.length === 1 
      ? `Möchten Sie ${config.displayName.slice(0, -1)} wirklich löschen?` 
      : `Möchten Sie die ${checkedBoxes.length} ausgewählten ${config.displayName} wirklich löschen?`;
    
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.performGenericDelete(entityType, checkedBoxes);
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.performGenericDelete(entityType, checkedBoxes);
    }
  }

  // Führe generische Löschung aus
  async performGenericDelete(entityType, checkedBoxes) {
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.dataset.id);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ BulkActionSystem: Lösche ${totalCount} ${entityType}...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities(entityType, selectedIds);
      
      if (result.success) {
        const config = this.getEntityConfig(entityType);
        
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} ${config.displayName} erfolgreich gelöscht.`);
        
        // Auswahl zurücksetzen
        this.genericDeselectAll();
        
        // Versuche Liste neu zu laden (nur wenn nötig)
        const tbody = document.querySelector('tbody');
        if (tbody && tbody.children.length === 0) {
          if (this.currentListInstance && typeof this.currentListInstance.loadAndRender === 'function') {
            await this.currentListInstance.loadAndRender();
          }
        }
        
        // Event für andere Komponenten auslösen
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: entityType, action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      // Bei Fehler: Zeilen wiederherstellen
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ BulkActionSystem: Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      // Liste neu laden um konsistenten Zustand herzustellen
      if (this.currentListInstance && typeof this.currentListInstance.loadAndRender === 'function') {
        await this.currentListInstance.loadAndRender();
      }
    }
  }

  // Erkenne aktuellen Entity-Type aus der Seite
  detectCurrentEntityType() {
    // 1. Aus URL
    const pathSegments = window.location.pathname.split('/').filter(segment => segment);
    if (pathSegments.length > 0) {
      const urlEntityType = pathSegments[0];
      if (['creator', 'unternehmen', 'kampagne', 'marke', 'auftrag', 'ansprechpartner', 'kooperation'].includes(urlEntityType)) {
        return urlEntityType;
      }
    }

    // 2. Aus verfügbaren Checkboxen
    const entityTypes = ['creator', 'unternehmen', 'kampagne', 'marke', 'auftrag', 'ansprechpartner', 'kooperation'];
    for (const entityType of entityTypes) {
      const config = this.getEntityConfig(entityType);
      const checkboxes = document.querySelectorAll(config.checkboxSelector);
      if (checkboxes.length > 0) {
        console.log(`🔧 BulkActionSystem: Entity-Type ${entityType} aus Checkboxen erkannt`);
        return entityType;
      }
    }

    return null;
  }

  // Hole Konfiguration für Entity-Type
  getEntityConfig(entityType) {
    const configs = {
      creator: {
        checkboxSelector: '.creator-check',
        selectAllId: 'select-all-creators',
        displayName: 'Creator'
      },
      unternehmen: {
        checkboxSelector: '.unternehmen-check',
        selectAllId: 'select-all-unternehmen',
        displayName: 'Unternehmen'
      },
      kampagne: {
        checkboxSelector: '.kampagne-check',
        selectAllId: 'select-all-kampagnen',
        displayName: 'Kampagnen'
      },
      marke: {
        checkboxSelector: '.marke-check',
        selectAllId: 'select-all-marken',
        displayName: 'Marken'
      },
      auftrag: {
        checkboxSelector: '.auftrag-check',
        selectAllId: 'select-all-auftraege',
        displayName: 'Aufträge'
      },
      ansprechpartner: {
        checkboxSelector: '.ansprechpartner-check',
        selectAllId: 'select-all-ansprechpartner',
        displayName: 'Ansprechpartner'
      },
      kooperation: {
        checkboxSelector: '.kooperation-check',
        selectAllId: 'select-all-kooperationen',
        displayName: 'Kooperationen'
      }
    };

    return configs[entityType] || {
      checkboxSelector: `.${entityType}-check`,
      selectAllId: `select-all-${entityType}`,
      displayName: entityType
    };
  }

  // Verstecke Bulk-Action Buttons
  hideButtons() {
    const selectedCountElement = document.getElementById('selected-count');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.style.display = 'none';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
    }
  }

  // Prüfe ob Benutzer Kunde ist
  isKunde() {
    return window.currentUser?.rolle === 'kunde';
  }

  // Verstecke Bulk-Actions für Kunden
  hideForKunden() {
    if (this.isKunde()) {
      console.log('🔧 BulkActionSystem: Verstecke Bulk-Actions für Kunden');
      this.hideButtons();
      
      // Verstecke auch die Checkboxen für Kunden
      const checkboxes = document.querySelectorAll('input[type="checkbox"][data-entity-id]');
      checkboxes.forEach(checkbox => {
        checkbox.style.display = 'none';
      });
    }
  }

  // Cleanup
  destroy() {
    this.boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.boundEventListeners.clear();
  }
}

// Singleton-Instanz erstellen
export const bulkActionSystem = new BulkActionSystem();