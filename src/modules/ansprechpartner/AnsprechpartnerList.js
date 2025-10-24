// AnsprechpartnerList.js (ES6-Modul)
// Ansprechpartner-Liste mit Filter und Verwaltung

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';

export class AnsprechpartnerList {
  constructor() {
    this.selectedAnsprechpartner = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Ansprechpartner-Liste
  async init() {
    window.setHeadline('Ansprechpartner Übersicht');
    console.log('🎯 ANSPRECHPARTNERLIST: Initialisiere Ansprechpartner-Liste');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Ansprechpartner', url: '/ansprechpartner', clickable: false }
      ]);
    }
    
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
              <th>Telefon Mobil</th>
              <th>Telefon Büro</th>
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
        <td>${PhoneDisplay.render(
          ap.telefonnummer_land?.iso_code,
          ap.telefonnummer_land?.vorwahl,
          ap.telefonnummer
        )}</td>
        <td>${PhoneDisplay.render(
          ap.telefonnummer_office_land?.iso_code,
          ap.telefonnummer_office_land?.vorwahl,
          ap.telefonnummer_office
        )}</td>
        <td>${ap.stadt || '-'}</td>
        <td>
          ${(ap.sprachen && ap.sprachen.length > 0)
            ? `<div class="tag-list">${ap.sprachen.map(s => `<span class="tag tag--sprache">${window.validatorSystem.sanitizeHtml(s.name)}</span>`).join('')}</div>`
            : (ap.sprache?.name ? `<span class="tag tag--sprache">${window.validatorSystem.sanitizeHtml(ap.sprache.name)}</span>` : '-')}
        </td>
        <td>
          ${actionBuilder.create('ansprechpartner', ap.id)}
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
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedAnsprechpartner.size;
    
    if (selectedCount === 0) {
      alert('Keine Ansprechpartner ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie den ausgewählten Ansprechpartner wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Ansprechpartner wirklich löschen?`;

    const res = await window.confirmationModal.open({
      title: 'Löschvorgang bestätigen',
      message: message,
      confirmText: 'Endgültig löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (res?.confirmed) {
      this.deleteSelectedAnsprechpartner();
    }
  }

  // Ausgewählte Ansprechpartner löschen
  async deleteSelectedAnsprechpartner() {
    const selectedIds = Array.from(this.selectedAnsprechpartner);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Ansprechpartner...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('ansprechpartner', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Ansprechpartner erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('#ansprechpartner-table-body, .data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'ansprechpartner', action: 'bulk-deleted', count: result.deletedCount }
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
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      // Liste neu laden um konsistenten Zustand herzustellen
      await this.loadAndRender();
    }
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