// MarkeList.js (ES6-Modul)
// Marken-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { markeCreate } from './MarkeCreate.js';

export class MarkeList {
  constructor() {
    this.selectedMarken = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Marken-Liste
  async init() {
    console.log('🎯 MARKELLIST: Initialisiere Marken-Liste');
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ MARKELLIST: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    window.setHeadline('Marken Übersicht');
    
    // BulkActionSystem für Marke registrieren
    window.bulkActionSystem?.registerList('marke', this);
    
    const canView = (window.canViewPage && window.canViewPage('marke')) || await window.checkUserPermission('marke', 'can_view');
    console.log('🔐 MARKELLIST: Berechtigung für marke.can_view:', canView);
    
    if (!canView) {
      console.log('❌ MARKELLIST: Keine Berechtigung für Marken');
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Marken anzuzeigen.</p>
        </div>
      `;
      return;
    }

    console.log('✅ MARKELLIST: Berechtigung OK, lade Marken...');
    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
    console.log('✅ MARKELLIST: Initialisierung abgeschlossen');
  }

  // Lade und rendere Marken-Liste
  async loadAndRender() {
    try {
      // Lade Filter-Daten separat
      const filterData = await window.dataService.loadFilterData('marke');
      
      // Rendere die Seite mit Filter-Daten (asynchron)
      await this.render(filterData);
      
      // Lade gefilterte Marken für die Anzeige
      const currentFilters = filterSystem.getFilters('marke');
      console.log('🔍 Lade Marken mit Filter:', currentFilters);
      const filteredMarken = await window.dataService.loadEntities('marke', currentFilters);
      console.log('📊 Marken geladen:', filteredMarken?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredMarken);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'MarkeList.loadAndRender');
    }
  }

  // Rendere Marken-Liste
  async render(filterData) {
    const canEdit = window.currentUser?.permissions?.marke?.can_edit || false;
    
    // Aktive Filter als Tags
    let tags = '';
    const currentFilters = filterSystem.getFilters('marke');
    
    // Filter-Tags rendern (vereinfacht)
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        tags += `<span class="filter-tag" data-key="${key}">${key}: ${value} <b class="tag-x" data-key="${key}">×</b></span>`;
      }
    });
    
    // Filter-UI über dem Tabellen-Header
    let filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Filter zurücksetzen</button>
      </div>
    </div>`;
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Marken</h1>
          <p>Verwalten Sie alle Marken und deren Eigenschaften</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-marke-new" class="primary-btn">Neue Marke anlegen</button>' : ''}
        </div>
      </div>

      ${filterHtml}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-marken"></th>
              <th>Markenname</th>
              <th>Unternehmen</th>
              <th>Branche</th>
              <th>Webseite</th>
              <th>Ansprechpartner</th>
              <th>Zuständigkeit</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="8" class="no-data">Lade Marken...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('marke', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('marke', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('marke');
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Reset All Button - spezifisch für dieses Modul
    this.boundFilterResetHandler = (e) => {
      if (e.target.id === 'btn-filter-reset') {
        this.onFiltersReset();
      }
    };
    document.addEventListener('click', this.boundFilterResetHandler);

    // Neue Marke anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-marke-new' || e.target.id === 'btn-marke-new-filter') {
        e.preventDefault();
        window.navigateTo('/marke/new');
      }
    });

    // Marken Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'marke') {
        e.preventDefault();
        const markeId = e.target.dataset.id;
        console.log('🎯 MARKELIST: Navigiere zu Marken Details:', markeId);
        window.navigateTo(`/marke/${markeId}`);
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.marke-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedMarken.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-marken');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      }
    });

    // Auswahl aufheben Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.marke-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedMarken.clear();
        const selectAllHeader = document.getElementById('select-all-marken');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'marke') {
        this.loadAndRender();
      }
    });

    // Filter-Tag X-Buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-x')) {
        e.preventDefault();
        e.stopPropagation();
        
        const tagElement = e.target.closest('.filter-tag');
        const key = tagElement.dataset.key;
        
        // Entferne Filter
        const currentFilters = filterSystem.getFilters('marke');
        delete currentFilters[key];
        filterSystem.applyFilters('marke', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-marken') {
        const checkboxes = document.querySelectorAll('.marke-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedMarken.add(cb.dataset.id);
          } else {
            this.selectedMarken.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
      }
    });

    // Marken Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('marke-check')) {
        if (e.target.checked) {
          this.selectedMarken.add(e.target.dataset.id);
        } else {
          this.selectedMarken.delete(e.target.dataset.id);
        }
        this.updateSelection();
      }
    });
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('marke');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedMarken.size;
    const selectedCountElement = document.getElementById('selected-count');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Update Tabelle
  async updateTable(marken) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!marken || marken.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const rowsHtml = marken.map(marke => `
      <tr data-id="${marke.id}">
        <td><input type="checkbox" class="marke-check" data-id="${marke.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
            ${window.validatorSystem.sanitizeHtml(marke.markenname || '')}
          </a>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(marke.unternehmen?.firmenname || 'Kein Unternehmen zugeordnet')}</td>
        <td>${window.validatorSystem.sanitizeHtml(marke.branche || '')}</td>
        <td>${marke.webseite ? `<a href="${marke.webseite}" target="_blank" class="table-link">${marke.webseite}</a>` : '-'}</td>
        <td>${this.renderAnsprechpartner(marke.ansprechpartner)}</td>
        <td>${this.renderZustaendigkeit(marke.zustaendigkeit)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="marke">
                          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
            <div class="actions-dropdown">
                              <a href="#" class="action-item" data-action="view" data-id="${marke.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${marke.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${marke.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${marke.id}">
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

  // Render Ansprechpartner
  renderAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner || ansprechpartner.length === 0) return '-';
    
    if (Array.isArray(ansprechpartner)) {
      return ansprechpartner.map(ap => 
        `${ap.vorname} ${ap.nachname}`
      ).join(', ');
    }
    
    return `${ansprechpartner.vorname} ${ansprechpartner.nachname}`;
  }

  // Render Zuständigkeit
  renderZustaendigkeit(zustaendigkeit) {
    if (!zustaendigkeit || zustaendigkeit.length === 0) return '-';
    
    if (Array.isArray(zustaendigkeit)) {
      return zustaendigkeit.map(z => 
        `${z.mitarbeiter?.name || 'Unbekannt'}`
      ).join(', ');
    }
    
    return zustaendigkeit.mitarbeiter?.name || 'Unbekannt';
  }

  // Cleanup
  destroy() {
    console.log('🗑️ MARKELLIST: Destroy aufgerufen');
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
    
    // Content zurücksetzen
    window.setContentSafely('');
    console.log('✅ MARKELLIST: Destroy abgeschlossen');
  }

  // Bestätigungsdialog für Bulk-Delete
  showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedMarken.size;
    console.log(`🔧 MarkeList: showDeleteSelectedConfirmation aufgerufen, selectedCount: ${selectedCount}`, Array.from(this.selectedMarken));
    
    if (selectedCount === 0) {
      alert('Keine Marken ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie die ausgewählte Marke wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Marken wirklich löschen?`;
    
    const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
    
    if (confirmed) {
      this.deleteSelectedMarken();
    }
  }

  // Ausgewählte Marken löschen
  async deleteSelectedMarken() {
    const selectedIds = Array.from(this.selectedMarken);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Marken...`);
    
    let successCount = 0;
    let errorCount = 0;
    const successfullyDeletedIds = [];
    
    // Lösche alle ausgewählten Marken
    for (const markeId of selectedIds) {
      try {
        const result = await window.dataService.deleteEntity('marke', markeId);
        if (result.success) {
          successCount++;
          successfullyDeletedIds.push(markeId);
          this.selectedMarken.delete(markeId);
        } else {
          errorCount++;
          console.error(`❌ Fehler beim Löschen von Marke ${markeId}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Fehler beim Löschen von Marke ${markeId}:`, error);
      }
    }
    
    // Ergebnis anzeigen
    if (successCount > 0) {
      const message = successCount === 1 
        ? 'Marke erfolgreich gelöscht.' 
        : `${successCount} Marken erfolgreich gelöscht.`;
      
      if (errorCount > 0) {
        alert(`${message}\n${errorCount} Marken konnten nicht gelöscht werden.`);
      } else {
        alert(message);
      }
      
      // Nur erfolgreich gelöschte Zeilen aus der Tabelle entfernen
      successfullyDeletedIds.forEach(markeId => {
        const row = document.querySelector(`tr[data-id="${markeId}"]`);
        if (row) {
          row.remove();
        }
      });
      
      // Auswahl zurücksetzen
      this.selectedMarken.clear();
      this.updateSelection();
      this.updateSelectAllCheckbox();
      
      // Prüfe ob Tabelle leer ist
      const tbody = document.getElementById('marken-table-body');
      if (tbody && tbody.children.length === 0) {
        // Lade komplett neu wenn keine Einträge mehr da sind
        await this.loadAndRender();
      }
      
      // Event für andere Komponenten
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'marke', action: 'bulk-deleted', count: successCount }
      }));
    } else {
      alert('Keine Marken konnten gelöscht werden.');
    }
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Marken-Erstellungsformular mit MarkeCreate');
    // Verwende MarkeCreate statt FormSystem (wie bei Unternehmen)
    markeCreate.showCreateForm();
  }




}

// Exportiere Instanz für globale Nutzung
export const markeList = new MarkeList(); 