// UnternehmenList.js (ES6-Modul)
// Unternehmen-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';

export class UnternehmenList {
  constructor() {
    this.selectedUnternehmen = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Unternehmen-Liste
  async init() {
    window.setHeadline('Unternehmen Übersicht');
    
    const canView = (window.canViewPage && window.canViewPage('unternehmen')) || await window.checkUserPermission('unternehmen', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Unternehmen anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Lade und rendere Unternehmen-Liste
  async loadAndRender() {
    try {
      // Lade Filter-Daten separat
      const filterData = await window.dataService.loadFilterData('unternehmen');
      
      // Rendere die Seite mit Filter-Daten (asynchron)
      await this.render(filterData);
      
      // Lade gefilterte Unternehmen für die Anzeige
      const currentFilters = filterSystem.getFilters('unternehmen');
      console.log('🔍 Lade Unternehmen mit Filter:', currentFilters);
      const filteredUnternehmen = await window.dataService.loadEntities('unternehmen', currentFilters);
      console.log('📊 Unternehmen geladen:', filteredUnternehmen?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredUnternehmen);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'UnternehmenList.loadAndRender');
    }
  }

  // Rendere Unternehmen-Liste
  async render(filterData) {
    const canEdit = window.currentUser?.permissions?.unternehmen?.can_edit || false;
    
    // Aktive Filter als Tags
    let tags = '';
    const currentFilters = filterSystem.getFilters('unternehmen');
    
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
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Alle Filter zurücksetzen</button>
      </div>
    </div>`;
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Unternehmen</h1>
          <p>Verwalten Sie alle Unternehmen und deren Kontakte</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-unternehmen-new" class="primary-btn">Neues Unternehmen anlegen</button>' : ''}
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
              <th><input type="checkbox" id="select-all-unternehmen"></th>
              <th>Name</th>
              <th>Branche</th>
              <th>Ansprechpartner</th>
              <th>Rechnungs E-Mail</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" class="no-data">Lade Unternehmen...</td>
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
      await filterSystem.renderFilterBar('unternehmen', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('unternehmen', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('unternehmen');
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

    // Neues Unternehmen anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-unternehmen-new' || e.target.id === 'btn-unternehmen-new-filter') {
        e.preventDefault();
        window.navigateTo('/unternehmen/new');
      }
    });

    // Unternehmen Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'unternehmen') {
        e.preventDefault();
        const unternehmenId = e.target.dataset.id;
        console.log('🎯 UNTERNEHMENLIST: Navigiere zu Unternehmen Details:', unternehmenId);
        window.navigateTo(`/unternehmen/${unternehmenId}`);
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.unternehmen-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedUnternehmen.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-unternehmen');
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
        this.deselectAll();
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'unternehmen') {
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
        const currentFilters = filterSystem.getFilters('unternehmen');
        delete currentFilters[key];
        filterSystem.applyFilters('unternehmen', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox (Tabellen-Header)
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-unternehmen') {
        const checkboxes = document.querySelectorAll('.unternehmen-check');
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) {
            this.selectedUnternehmen.add(cb.dataset.id);
          } else {
            this.selectedUnternehmen.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
        console.log(`${isChecked ? '✅ Alle Unternehmen ausgewählt' : '❌ Alle Unternehmen abgewählt'}: ${this.selectedUnternehmen.size}`);
      }
    });

    // Unternehmen Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('unternehmen-check')) {
        if (e.target.checked) {
          this.selectedUnternehmen.add(e.target.dataset.id);
        } else {
          this.selectedUnternehmen.delete(e.target.dataset.id);
        }
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });

    // Bulk-Actions werden jetzt vom BulkActionSystem verwaltet
    // Registriere diese Liste beim BulkActionSystem
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList('unternehmen', this);
    }
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('unternehmen');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedUnternehmen.size;
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
  async updateTable(unternehmen) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    if (!unternehmen || unternehmen.length === 0) {
      // Einheitlicher Empty-State
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    // Kontakte für alle Unternehmen in einem Rutsch laden und mappen
    const unternehmenIds = unternehmen.map(u => u.id).filter(Boolean);
    const apMap = await this.loadAnsprechpartnerMap(unternehmenIds);

    const rowsHtml = unternehmen.map(unternehmen => `
      <tr data-id="${unternehmen.id}">
        <td><input type="checkbox" class="unternehmen-check" data-id="${unternehmen.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="unternehmen" data-id="${unternehmen.id}">
            ${window.validatorSystem.sanitizeHtml(unternehmen.firmenname || '')}
          </a>
        </td>
        <td>${this.renderBrancheTags(unternehmen.branchen)}</td>
        <td>${this.renderAnsprechpartnerList(apMap.get(unternehmen.id))}</td>
        <td>${window.validatorSystem.sanitizeHtml(unternehmen.invoice_email || '')}</td>
        <td>${window.validatorSystem.sanitizeHtml(unternehmen.rechnungsadresse_stadt || '')}</td>
        <td>${window.validatorSystem.sanitizeHtml(unternehmen.rechnungsadresse_land || '')}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="unternehmen">
                          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
            <div class="actions-dropdown">
                              <a href="#" class="action-item" data-action="view" data-id="${unternehmen.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${unternehmen.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${unternehmen.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                <a href="#" class="action-item" data-action="add_ansprechpartner_unternehmen" data-id="${unternehmen.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 5a3 3 0 11-6 0 3 3 0 016 0zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM16.25 5.75a.75.75 0 00-1.5 0v2h-2a.75.75 0 000 1.5h2v2a.75.75 0 001.5 0v-2h2a.75.75 0 000-1.5h-2v-2z" />
                  </svg>
                  Ansprechpartner hinzufügen
                </a>
                <a href="#" class="action-item" data-action="remove_ansprechpartner_unternehmen" data-id="${unternehmen.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 5a3 3 0 11-6 0 3 3 0 016 0zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM16.25 8.25a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z" />
                  </svg>
                  Ansprechpartner entfernen
                </a>
                
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${unternehmen.id}">
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

  // Render Branche Tags (kompatibel mit String oder Array/Objekten)
  renderBrancheTags(branchen) {
    if (!branchen || (Array.isArray(branchen) && branchen.length === 0)) return '-';

    // Wenn Backend als einzelnes Objekt liefert (Supabase JOIN)
    if (typeof branchen === 'object' && !Array.isArray(branchen) && branchen.name) {
      return `<div class="tags tags-compact"><span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(branchen.name)}</span></div>`;
    }

    // Wenn Backend als String liefert
    if (typeof branchen === 'string') {
      const parts = branchen.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return '-';
      const inner = parts.map(label => `<span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(label)}</span>`).join('');
      return `<div class="tags tags-compact">${inner}</div>`;
    }

    // Wenn bereits Array geliefert wird (Strings oder Objekte)
    if (Array.isArray(branchen)) {
      const inner = branchen.map(b => {
        const label = typeof b === 'object' ? (b.name || b.label || b) : b;
        return `<span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(String(label).trim())}</span>`;
      }).join('');
      return `<div class="tags tags-compact">${inner}</div>`;
    }

    // Wenn einzelnes Objekt geliefert wird
    if (typeof branchen === 'object') {
      const label = branchen.name || branchen.label;
      return label ? `<div class="tags tags-compact"><span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(label)}</span></div>` : '-';
    }

    return '-';
  }

  // Ansprechpartner in einem Rutsch laden und als Map zurückgeben (über Junction Table)
  async loadAnsprechpartnerMap(unternehmenIds) {
    const map = new Map();
    try {
      if (!window.supabase || !Array.isArray(unternehmenIds) || unternehmenIds.length === 0) {
        return map;
      }
      
      // Neue Junction Table Query - analog zu Marken-Implementierung
      const { data, error } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .select(`
          unternehmen_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email
          )
        `)
        .in('unternehmen_id', unternehmenIds);
        
      if (error) {
        console.warn('⚠️ Konnte Ansprechpartner nicht laden:', error);
        return map;
      }
      
      (data || []).forEach(item => {
        if (!item.ansprechpartner) return; // Skip invalid entries
        
        const unternehmenId = item.unternehmen_id;
        const ansprechpartner = item.ansprechpartner;
        
        const list = map.get(unternehmenId) || [];
        list.push(ansprechpartner);
        map.set(unternehmenId, list);
      });
      
      console.log('✅ UNTERNEHMENLISTE: Ansprechpartner-Map geladen:', map.size, 'Unternehmen');
      
    } catch (e) {
      console.warn('⚠️ loadAnsprechpartnerMap Fehler:', e);
    }
    return map;
  }

  // Ansprechpartner-Liste rendern (klickbare Tags wie bei Marken)
  renderAnsprechpartnerList(list) {
    if (!list || list.length === 0) return '-';
    
    // Ansprechpartner als klickbare Tags (analog zu MarkeList)
    const ansprechpartnerTags = list
      .filter(ap => ap && ap.vorname && ap.nachname) // Nur gültige Ansprechpartner
      .slice(0, 3) // Maximal 3 Tags anzeigen
      .map(ap => `<a href="#" class="tag tag--ansprechpartner" data-action="view-ansprechpartner" data-id="${ap.id}" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')">${window.validatorSystem.sanitizeHtml(ap.vorname)} ${window.validatorSystem.sanitizeHtml(ap.nachname)}</a>`)
      .join('');
    
    // "Mehr" Indikator für weitere Ansprechpartner
    const more = list.length > 3 ? `<span class="tag tag--more">+${list.length - 3}</span>` : '';
    
    return `<div class="tags tags-compact">${ansprechpartnerTags}${more}</div>`;
  }

  // Cleanup
  destroy() {
    console.log('UnternehmenList: Cleaning up...');
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Unternehmen-Erstellungsformular');
    window.setHeadline('Neues Unternehmen anlegen');
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('unternehmen');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Unternehmen anlegen</h1>
          <p>Erstellen Sie ein neues Unternehmen für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('unternehmen', null);
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    try {
      const form = document.getElementById('unternehmen-form');
      const submitData = window.formSystem.collectSubmitData(form);

      // Validierung
      const validation = window.validatorSystem.validateForm(submitData, {
        firmenname: { type: 'text', minLength: 2, required: true },
        invoice_email: { type: 'email' }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Unternehmen erstellen
      const result = await window.dataService.createEntity('unternehmen', submitData);

      if (result.success) {
        // Junction Table-Verknüpfungen verarbeiten (für branche_id)
        if (result.id) {
          try {
            const { RelationTables } = await import('../../core/form/logic/RelationTables.js');
            const relationTables = new RelationTables();
            await relationTables.handleRelationTables('unternehmen', result.id, submitData, form);
            console.log('✅ Junction Table-Verknüpfungen verarbeitet');
          } catch (relationError) {
            console.error('❌ Fehler beim Verarbeiten der Junction Tables:', relationError);
            // Nicht fatal - Hauptentität wurde bereits erstellt
          }
        }

        this.showSuccessMessage('Unternehmen erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update statt Navigation
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'unternehmen', id: result.id, action: 'created' } 
        }));
        
        // Optional: Zurück zur Übersicht navigieren (nur wenn gewünscht)
        // setTimeout(() => {
        //   window.navigateTo('/unternehmen');
        // }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }

  // Validierungsfehler anzeigen
  showValidationErrors(errors) {
    // Alte Fehler entfernen
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    // Neue Fehler anzeigen
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        fieldElement.parentNode.appendChild(errorElement);
      }
    });
  }

  // Erfolgsmeldung anzeigen
  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    
    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.parentNode.insertBefore(successDiv, form);
    }
  }

  // Fehlermeldung anzeigen
  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    
    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.parentNode.insertBefore(errorDiv, form);
    }
  }

  // Update Select-All Checkbox Status
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-unternehmen');
    const individualCheckboxes = document.querySelectorAll('.unternehmen-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.unternehmen-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    // Setze den Status des Select-All Checkbox
    selectAllCheckbox.checked = allChecked;
    
    // Setze indeterminate Status für "teilweise ausgewählt"
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
    
    console.log(`🔧 Select-All Status: ${allChecked ? 'Alle' : someChecked ? 'Teilweise' : 'Keine'} (${checkedBoxes.length}/${individualCheckboxes.length})`);
  }

  // Deselect All - alle Auswahlen aufheben
  deselectAll() {
    this.selectedUnternehmen.clear();
    
    // Alle Checkboxen deaktivieren
    const checkboxes = document.querySelectorAll('.unternehmen-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    // Select-All Checkbox auch zurücksetzen
    const selectAllCheckbox = document.getElementById('select-all-unternehmen');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
    console.log('✅ Alle Unternehmen-Auswahlen aufgehoben');
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedUnternehmen.size;
    if (selectedCount === 0) {
      alert('Keine Unternehmen ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie das ausgewählte Unternehmen wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Unternehmen wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.deleteSelectedUnternehmen();
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedUnternehmen();
    }
  }

  // Ausgewählte Unternehmen löschen
  async deleteSelectedUnternehmen() {
    const selectedIds = Array.from(this.selectedUnternehmen);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Unternehmen...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Lösche jedes Unternehmen einzeln
    for (const unternehmenId of selectedIds) {
      try {
        const result = await window.dataService.deleteEntity('unternehmen', unternehmenId);
        
        if (result.success) {
          successCount++;
          console.log(`✅ Unternehmen ${unternehmenId} gelöscht`);
        } else {
          errorCount++;
          errors.push(`Unternehmen ${unternehmenId}: ${result.error}`);
          console.error(`❌ Fehler beim Löschen von Unternehmen ${unternehmenId}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        errors.push(`Unternehmen ${unternehmenId}: ${error.message}`);
        console.error(`❌ Unerwarteter Fehler beim Löschen von Unternehmen ${unternehmenId}:`, error);
      }
    }

    // Ergebnis anzeigen
    let message = '';
    if (successCount > 0) {
      message += `✅ ${successCount} Unternehmen erfolgreich gelöscht.`;
    }
    if (errorCount > 0) {
      message += `\n❌ ${errorCount} Unternehmen konnten nicht gelöscht werden.`;
      if (errors.length > 0) {
        message += `\n\nFehler:\n${errors.join('\n')}`;
      }
    }
    
    alert(message);

    // Auswahl zurücksetzen und Liste neu laden
    this.deselectAll();
    await this.loadAndRender();

    // Event für andere Komponenten auslösen
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'unternehmen', action: 'bulk-deleted', count: successCount }
    }));
  }
}

// Exportiere Instanz für globale Nutzung
export const unternehmenList = new UnternehmenList(); 