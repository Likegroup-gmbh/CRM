// AuftragsdetailsList.js (ES6-Modul)
// Auftragsdetails-Liste mit Filter und Verwaltung

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';

export class AuftragsdetailsList {
  constructor() {
    this.selectedDetails = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Auftragsdetails-Liste
  async init() {
    // Security: Nur Mitarbeiter haben Zugriff (Kunden nicht)
    const isKunde = window.currentUser?.rolle === 'kunde';
    if (isKunde) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    window.setHeadline('Auftragsdetails Übersicht');
    
    // Breadcrumb setzen
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: false }
      ]);
    }
    
    await this.loadAndRender();
  }

  // Rendere Listen-Ansicht
  async render() {
    const canEdit = window.currentUser?.permissions?.auftrag?.can_edit || window.currentUser?.rolle !== 'kunde';
    
    // Filter-UI über dem Tabellen-Header
    let filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Alle Filter zurücksetzen</button>
      </div>
    </div>`;
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Auftragsdetails</h1>
          <p>Detaillierte Produktionsplanung für Aufträge</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-auftragsdetails-new" class="primary-btn">Neue Auftragsdetails anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-auftragsdetails"></th>
              <th>Auftragsname</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Kampagnen</th>
              <th>Geplante Videos</th>
              <th>Geplante Creator</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" class="no-data">Lade Auftragsdetails...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
    
    // Events binden
    this.bindEvents();
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Prüfe ob aktive Filter vorhanden sind
  hasActiveFilters() {
    const currentFilters = filterSystem.getFilters('auftragsdetails') || {};
    return Object.keys(currentFilters).length > 0;
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('auftragsdetails', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    this.loadAndRender();
  }

  // Events binden
  bindEvents() {
    // Cleanup alte Event-Listener
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // Neues Auftragsdetails Button
    const newBtn = document.getElementById('btn-auftragsdetails-new');
    if (newBtn) {
      const handler = () => window.navigateTo('/auftragsdetails/new');
      newBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => newBtn.removeEventListener('click', handler));
    }

    // Filter Reset Button
    const filterResetBtn = document.getElementById('btn-filter-reset');
    if (filterResetBtn) {
      const handler = () => this.onFiltersReset();
      filterResetBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => filterResetBtn.removeEventListener('click', handler));
    }

    // Select-All Button
    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
      const handler = () => this.selectAll();
      selectAllBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => selectAllBtn.removeEventListener('click', handler));
    }

    // Deselect-All Button
    const deselectAllBtn = document.getElementById('btn-deselect-all');
    if (deselectAllBtn) {
      const handler = () => this.deselectAll();
      deselectAllBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => deselectAllBtn.removeEventListener('click', handler));
    }

    // Delete Selected Button
    const deleteSelectedBtn = document.getElementById('btn-delete-selected');
    if (deleteSelectedBtn) {
      const handler = () => this.bulkDelete();
      deleteSelectedBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => deleteSelectedBtn.removeEventListener('click', handler));
    }

    // Select-All Checkbox (Header)
    const selectAllCheckbox = document.getElementById('select-all-auftragsdetails');
    if (selectAllCheckbox) {
      const handler = () => this.toggleSelectAll();
      selectAllCheckbox.addEventListener('change', handler);
      this._boundEventListeners.add(() => selectAllCheckbox.removeEventListener('change', handler));
    }

    // Table-Links und Checkboxes Event-Delegation
    const tableHandler = (e) => {
      const link = e.target.closest('.table-link');
      if (link) {
        e.preventDefault();
        const table = link.dataset.table;
        const id = link.dataset.id;
        if (table && id) {
          window.navigateTo(`/${table}/${id}`);
        }
      }

      // Checkbox-Handler
      const checkbox = e.target.closest('.detail-check');
      if (checkbox) {
        const id = checkbox.dataset.id;
        if (checkbox.checked) {
          this.selectedDetails.add(id);
        } else {
          this.selectedDetails.delete(id);
        }
        this.updateSelection();
      }
    };
    
    const tbody = document.querySelector('.data-table tbody');
    if (tbody) {
      tbody.addEventListener('click', tableHandler);
      tbody.addEventListener('change', tableHandler);
      this._boundEventListeners.add(() => {
        tbody.removeEventListener('click', tableHandler);
        tbody.removeEventListener('change', tableHandler);
      });
    }
  }

  // Select All
  selectAll() {
    const checkboxes = document.querySelectorAll('.detail-check');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      this.selectedDetails.add(checkbox.dataset.id);
    });
    const selectAllCheckbox = document.getElementById('select-all-auftragsdetails');
    if (selectAllCheckbox) selectAllCheckbox.checked = true;
    this.updateSelection();
  }

  // Select-All Toggle
  toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-auftragsdetails');
    const checkboxes = document.querySelectorAll('.detail-check');
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAllCheckbox.checked;
      const id = checkbox.dataset.id;
      if (selectAllCheckbox.checked) {
        this.selectedDetails.add(id);
      } else {
        this.selectedDetails.delete(id);
      }
    });
    
    this.updateSelection();
  }

  // Deselect All
  deselectAll() {
    this.selectedDetails.clear();
    document.querySelectorAll('.detail-check').forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('select-all-auftragsdetails');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    this.updateSelection();
  }

  // Update Selection UI
  updateSelection() {
    const selectedCount = this.selectedDetails.size;
    const countElement = document.getElementById('selected-count');
    const selectAllBtn = document.getElementById('btn-select-all');
    const deselectAllBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (countElement) {
      countElement.textContent = `${selectedCount} ausgewählt`;
      countElement.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (selectAllBtn) {
      selectAllBtn.style.display = selectedCount === 0 ? 'inline-block' : 'none';
    }
    
    if (deselectAllBtn) {
      deselectAllBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }

    this.updateSelectAllCheckbox();
  }

  // Update Select-All Checkbox Status
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-auftragsdetails');
    if (!selectAllCheckbox) return;

    const checkboxes = document.querySelectorAll('.detail-check');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    const someChecked = Array.from(checkboxes).some(cb => cb.checked);

    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  // Bulk Delete
  async bulkDelete() {
    if (this.selectedDetails.size === 0) return;

    const confirmed = await window.confirmationModal.show({
      title: 'Auftragsdetails löschen',
      message: `Möchten Sie wirklich ${this.selectedDetails.size} Auftragsdetails löschen?`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      const deletePromises = Array.from(this.selectedDetails).map(id =>
        window.dataService.deleteEntity('auftrag_details', id)
      );

      await Promise.all(deletePromises);

      window.notificationSystem?.show(
        `${this.selectedDetails.size} Auftragsdetails erfolgreich gelöscht`,
        'success'
      );

      this.selectedDetails.clear();
      await this.loadAndRender();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.notificationSystem?.show(
        'Fehler beim Löschen der Auftragsdetails',
        'error'
      );
    }
  }

  // Update Tabelle
  updateTable(details) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!details || details.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="no-data">Keine Auftragsdetails gefunden</td>
        </tr>
      `;
      return;
    }

    const rowsHtml = details.map(detail => {
      const auftrag = detail.auftrag || {};
      const unternehmen = auftrag.unternehmen || {};
      const marke = auftrag.marke || {};

      return `
        <tr data-id="${detail.id}">
          <td><input type="checkbox" class="detail-check" data-id="${detail.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id || ''}">
              ${window.validatorSystem.sanitizeHtml(auftrag.auftragsname || '-')}
            </a>
          </td>
          <td>
            ${unternehmen.firmenname 
              ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${unternehmen.id}">${window.validatorSystem.sanitizeHtml(unternehmen.firmenname)}</a>`
              : '-'}
          </td>
          <td>
            ${marke.markenname 
              ? `<a href="#" class="table-link" data-table="marke" data-id="${marke.id}">${window.validatorSystem.sanitizeHtml(marke.markenname)}</a>`
              : '-'}
          </td>
          <td>${detail.kampagnenanzahl || auftrag.kampagnenanzahl || '-'}</td>
          <td>${detail.gesamt_videos || '-'}</td>
          <td>${detail.gesamt_creator || '-'}</td>
          <td>${detail.created_at ? new Date(detail.created_at).toLocaleDateString('de-DE') : '-'}</td>
          <td>
            ${actionBuilder.create('auftragsdetails', detail.id)}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Lade und rendere Daten
  async loadAndRender() {
    try {
      console.log('🔄 AUFTRAGSDETAILSLIST: Lade Auftragsdetails...');
      
      // Rendere die Seite-Struktur
      await this.render();
      
      // Lade gefilterte Auftragsdetails für die Anzeige
      const currentFilters = filterSystem.getFilters('auftragsdetails');
      console.log('🔍 Lade Auftragsdetails mit Filter:', currentFilters);

      // Query mit Joins für Performance
      const { data: details, error } = await window.supabase
        .from('auftrag_details')
        .select(`
          *,
          auftrag:auftrag_id (
            id,
            auftragsname,
            kampagnenanzahl,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Fehler beim Laden:', error);
        throw error;
      }

      console.log('📊 Auftragsdetails geladen:', details?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(details);
      
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSLIST: Fehler beim Laden:', error);
      const tbody = document.querySelector('.data-table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="error">Fehler beim Laden der Auftragsdetails</td>
          </tr>
        `;
      }
    }
  }

  // Cleanup
  destroy() {
    console.log('🗑️ AUFTRAGSDETAILSLIST: Cleanup');
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.selectedDetails.clear();
  }
}

// Exportiere Instanz für globale Nutzung
export const auftragsdetailsList = new AuftragsdetailsList();

