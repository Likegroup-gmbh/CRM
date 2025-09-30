// AnsprechpartnerList.js (ES6-Modul)
// Ansprechpartner-Liste mit Filter und Verwaltung

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';

export class AnsprechpartnerList {
  constructor() {
    this.selectedAnsprechpartner = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Ansprechpartner-Liste
  async init() {
    window.setHeadline('Ansprechpartner Übersicht');
    console.log('🎯 ANSPRECHPARTNERLIST: Initialisiere Ansprechpartner-Liste');
    
    this.bindEvents();
    await this.loadAndRender();
  }

  // HTML-Template rendern
  async render(filterData) {
    const content = document.getElementById('dashboard-content');
    if (!content) {
      console.error('❌ ANSPRECHPARTNERLIST: Dashboard-Content nicht gefunden');
      return;
    }

    content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Ansprechpartner</h1>
          <p>Verwalte alle Ansprechpartner von Unternehmen und Marken</p>
        </div>
        <div class="page-header-right">
          <button id="btn-ansprechpartner-new" class="primary-btn">Neuen Ansprechpartner anlegen</button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div id="filter-container"></div>

      <!-- Bulk Actions -->
      <div class="bulk-actions" id="bulk-actions" style="display: none;">
        <div class="bulk-info">
          <span id="selected-count">0 ausgewählt</span>
        </div>
        <div class="bulk-buttons">
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <!-- Tabelle -->
      <div class="data-table-container">
        <table class="data-table" id="ansprechpartner-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-ansprechpartner"></th>
              <th>Name</th>
              <th>Position</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Email</th>
              <th>Telefon</th>
              <th>Stadt</th>
              <th>Sprache</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <!-- Wird dynamisch gefüllt -->
          </tbody>
        </table>
      </div>
    `;
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('ansprechpartner', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('ansprechpartner', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('ansprechpartner');
    this.loadAndRender();
  }

  // Events binden
  bindEvents() {
    // Reset All Button - spezifisch für dieses Modul
    this.boundFilterResetHandler = (e) => {
      if (e.target.id === 'btn-filter-reset') {
        this.onFiltersReset();
      }
    };
    document.addEventListener('click', this.boundFilterResetHandler);

    // Neuen Ansprechpartner anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-ansprechpartner-new') {
        e.preventDefault();
        window.navigateTo('/ansprechpartner/new');
      }
    });

    // Ansprechpartner Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'ansprechpartner') {
        e.preventDefault();
        const ansprechpartnerId = e.target.dataset.id;
        console.log('🎯 ANSPRECHPARTNERLIST: Navigiere zu Ansprechpartner Details:', ansprechpartnerId);
        window.navigateTo(`/ansprechpartner/${ansprechpartnerId}`);
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'ansprechpartner') {
        this.loadAndRender();
      }
    });



    // Select-All Checkbox (Tabellen-Header)
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-ansprechpartner') {
        const checkboxes = document.querySelectorAll('.ansprechpartner-check');
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) {
            this.selectedAnsprechpartner.add(cb.dataset.id);
          } else {
            this.selectedAnsprechpartner.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
        console.log(`${isChecked ? '✅ Alle Ansprechpartner ausgewählt' : '❌ Alle Ansprechpartner abgewählt'}: ${this.selectedAnsprechpartner.size}`);
      }
    });

    // Ansprechpartner Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('ansprechpartner-check')) {
        const id = e.target.dataset.id;
        console.log(`🔧 AnsprechpartnerList: Checkbox ${id} ${e.target.checked ? 'ausgewählt' : 'abgewählt'}`);
        
        if (e.target.checked) {
          this.selectedAnsprechpartner.add(id);
        } else {
          this.selectedAnsprechpartner.delete(id);
        }
        
        console.log(`🔧 AnsprechpartnerList: Aktuelle Auswahl:`, Array.from(this.selectedAnsprechpartner));
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });

    // Bulk-Actions werden jetzt vom BulkActionSystem verwaltet
    // Registriere diese Liste beim BulkActionSystem
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList('ansprechpartner', this);
    }
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('ansprechpartner');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedAnsprechpartner.size;
    const selectedCountElement = document.getElementById('selected-count');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    const bulkActions = document.getElementById('bulk-actions');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
    }
    
    if (bulkActions) {
      bulkActions.style.display = selectedCount > 0 ? 'flex' : 'none';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Update Tabelle
  updateTable(ansprechpartner) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!ansprechpartner || ansprechpartner.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="no-data">Keine Ansprechpartner gefunden</td>
        </tr>
      `;
      return;
    }

    const rowsHtml = ansprechpartner.map(ap => `
      <tr data-id="${ap.id}">
        <td><input type="checkbox" class="ansprechpartner-check" data-id="${ap.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${ap.id}">
            ${window.validatorSystem.sanitizeHtml(`${ap.vorname} ${ap.nachname}`)}
          </a>
        </td>
        <td>${ap.position?.name || '-'}</td>
        <td>
          ${(ap.unternehmen && ap.unternehmen.firmenname)
            ? `<span class="tag tag--unternehmen">${window.validatorSystem.sanitizeHtml(ap.unternehmen.firmenname)}</span>`
            : '-'}
        </td>
        <td>
          ${(ap.marken && ap.marken.length > 0)
            ? `<div class="tag-list">${ap.marken.map(m => `<span class="tag tag--marke">${window.validatorSystem.sanitizeHtml(m.markenname)}</span>`).join('')}</div>`
            : '-'}
        </td>
        <td>${ap.email ? `<a href="mailto:${ap.email}">${ap.email}</a>` : '-'}</td>
        <td>${ap.telefonnummer || '-'}</td>
        <td>${ap.stadt || '-'}</td>
        <td>
          ${(ap.sprachen && ap.sprachen.length > 0)
            ? `<div class="tag-list">${ap.sprachen.map(s => `<span class="tag tag--sprache">${window.validatorSystem.sanitizeHtml(s.name)}</span>`).join('')}</div>`
            : (ap.sprache?.name ? `<span class="tag tag--sprache">${window.validatorSystem.sanitizeHtml(ap.sprache.name)}</span>` : '-')}
        </td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="ansprechpartner">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${ap.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                  <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                </svg>
                Details ansehen
              </a>
              <a href="#" class="action-item" data-action="edit" data-id="${ap.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                  <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                </svg>
                Bearbeiten
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${ap.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                </svg>
                Löschen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Lade und rendere Daten
  async loadAndRender() {
    try {
      console.log('🔄 ANSPRECHPARTNERLIST: Lade Ansprechpartner...');
      
      // Lade Filter-Daten separat
      const filterData = await window.dataService.loadFilterData('ansprechpartner');
      
      // Rendere die Seite mit Filter-Daten (asynchron)
      await this.render(filterData);
      
      // Lade gefilterte Ansprechpartner für die Anzeige
      const currentFilters = filterSystem.getFilters('ansprechpartner');
      console.log('🔍 Lade Ansprechpartner mit Filter:', currentFilters);
      const filteredAnsprechpartner = await window.dataService.loadEntities('ansprechpartner', currentFilters);
      console.log('📊 Ansprechpartner geladen:', filteredAnsprechpartner?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredAnsprechpartner);
      
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERLIST: Fehler beim Laden:', error);
      const tbody = document.querySelector('.data-table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" class="error">Fehler beim Laden der Ansprechpartner</td>
          </tr>
        `;
      }
    }
  }



  // Update Select-All Checkbox Status
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-ansprechpartner');
    const individualCheckboxes = document.querySelectorAll('.ansprechpartner-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.ansprechpartner-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  // Deselect All - alle Auswahlen aufheben
  deselectAll() {
    this.selectedAnsprechpartner.clear();
    
    const checkboxes = document.querySelectorAll('.ansprechpartner-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const selectAllCheckbox = document.getElementById('select-all-ansprechpartner');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
    console.log('✅ Alle Ansprechpartner-Auswahlen aufgehoben');
  }

  // Bestätigungsdialog für Bulk-Delete
  showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedAnsprechpartner.size;
    console.log(`🔧 AnsprechpartnerList: showDeleteSelectedConfirmation aufgerufen, selectedCount: ${selectedCount}`, Array.from(this.selectedAnsprechpartner));
    
    if (selectedCount === 0) {
      alert('Keine Ansprechpartner ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie den ausgewählten Ansprechpartner wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Ansprechpartner wirklich löschen?`;
    
    const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
    
    if (confirmed) {
      this.deleteSelectedAnsprechpartner();
    }
  }

  // Ausgewählte Ansprechpartner löschen
  async deleteSelectedAnsprechpartner() {
    const selectedIds = Array.from(this.selectedAnsprechpartner);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Ansprechpartner...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const ansprechpartnerId of selectedIds) {
      try {
        const result = await window.dataService.deleteEntity('ansprechpartner', ansprechpartnerId);
        
        if (result.success) {
          successCount++;
          console.log(`✅ Ansprechpartner ${ansprechpartnerId} gelöscht`);
        } else {
          errorCount++;
          errors.push(`Ansprechpartner ${ansprechpartnerId}: ${result.error}`);
          console.error(`❌ Fehler beim Löschen von Ansprechpartner ${ansprechpartnerId}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        errors.push(`Ansprechpartner ${ansprechpartnerId}: ${error.message}`);
        console.error(`❌ Unerwarteter Fehler beim Löschen von Ansprechpartner ${ansprechpartnerId}:`, error);
      }
    }

    let message = '';
    if (successCount > 0) {
      message += `✅ ${successCount} Ansprechpartner erfolgreich gelöscht.`;
    }
    if (errorCount > 0) {
      message += `\n❌ ${errorCount} Ansprechpartner konnten nicht gelöscht werden.`;
      if (errors.length > 0) {
        message += `\n\nFehler:\n${errors.join('\n')}`;
      }
    }
    
    alert(message);

    this.deselectAll();
    await this.loadAndRender();

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'ansprechpartner', action: 'bulk-deleted', count: successCount }
    }));
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Ansprechpartner-Erstellungsformular mit AnsprechpartnerCreate');
    // Verwende AnsprechpartnerCreate statt FormSystem (wie bei Marken)
    ansprechpartnerCreate.showCreateForm();
  }

  // Cleanup
  destroy() {
    console.log('AnsprechpartnerList: Cleaning up...');
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerList = new AnsprechpartnerList();