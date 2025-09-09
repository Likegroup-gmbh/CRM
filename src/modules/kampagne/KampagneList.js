// KampagneList.js (ES6-Modul)
// Kampagnen-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';

export class KampagneList {
  constructor() {
    this.selectedKampagnen = new Set();
    this._boundEventListeners = new Set();
    this.statusOptions = [];
    this.kampagneArtMap = new Map();
  }

  // Initialisiere Kampagnen-Liste
  async init() {
    window.setHeadline('Kampagnen Übersicht');
    
    // Prüfe Berechtigungen (Page-scope zuerst)
    const canView = (window.canViewPage && window.canViewPage('kampagne')) || await window.checkUserPermission('kampagne', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kampagnen anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Lade und rendere Kampagnen-Liste
  async loadAndRender() {
    try {
      // Lade Filter-Daten separat
      const filterData = await window.dataService.loadFilterData('kampagne');
      
      // Rendere die Seite mit Filter-Daten (asynchron)
      await this.render(filterData);
      
      // Initialisiere Filterbar mit neuem System
      await this.initializeFilterBar();
      
      // Lade gefilterte Kampagnen für die Anzeige
      const currentFilters = filterSystem.getFilters('kampagne');
      console.log('🔍 Lade Kampagnen mit Filter:', currentFilters);
      const filteredKampagnen = await this.loadKampagnenWithRelations();
      console.log('📊 Kampagnen geladen:', filteredKampagnen?.length || 0);
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(filteredKampagnen);
      
    } catch (error) {
      window.ErrorHandler.handle(error, 'KampagneList.loadAndRender');
    }
  }

  // Lade Kampagnen mit Beziehungen
  async loadKampagnenWithRelations() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('kampagne');
      }

      // Lade Status-Optionen und Kampagnenarten
      try {
        const [{ data: statusRows }, { data: artRows }] = await Promise.all([
          window.supabase.from('kampagne_status').select('id, name, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
          window.supabase.from('kampagne_art_typen').select('id, name')
        ]);
        this.statusOptions = statusRows || [];
        this.kampagneArtMap = new Map((artRows || []).map(r => [r.id, r.name]));
      } catch (e) {
        console.warn('⚠️ Konnte Status/Arten nicht laden', e);
      }

      // Sichtbarkeit: Nicht-Admins sehen nur zugewiesene Kampagnen
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      let assignedKampagnenIds = [];
      if (!isAdmin) {
        try {
          const { data: assigned } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          assignedKampagnenIds = (assigned || []).map(r => r.kampagne_id).filter(Boolean);
          if (assignedKampagnenIds.length === 0) {
            return [];
          }
        } catch (_) {
          return [];
        }
      }

      let query = window.supabase
        .from('kampagne')
        .select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname),
          auftrag:auftrag_id(auftragsname),
          status_ref:status_id(id, name)
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin && assignedKampagnenIds.length > 0) {
        query = query.in('id', assignedKampagnenIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Kampagnen mit Beziehungen:', error);
        throw error;
      }

      // Daten für Kompatibilität formatieren
      const formattedData = data.map(k => {
        const arr = Array.isArray(k.art_der_kampagne) ? k.art_der_kampagne : [];
        const artDisplay = arr.map(v => (this.kampagneArtMap.get(v) || v));
        return {
          ...k,
          art_der_kampagne_display: artDisplay,
          unternehmen: k.unternehmen ? { firmenname: k.unternehmen.firmenname } : null,
          marke: k.marke ? { markenname: k.marke.markenname } : null,
          auftrag: k.auftrag ? { auftragsname: k.auftrag.auftragsname } : null,
          status_name: k.status_ref?.name || k.status || null
        };
      });

      // Lade Many-to-Many Beziehungen (z.B. Ansprechpartner) über DataService
      const entityConfig = window.dataService.entities.kampagne;
      if (entityConfig.manyToMany) {
        await window.dataService.loadManyToManyRelations(formattedData, 'kampagne', entityConfig.manyToMany);
      }

      console.log('✅ Kampagnen mit Beziehungen geladen:', formattedData);
      return formattedData;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnen mit Beziehungen:', error);
      // Fallback zu normalem Laden
      return await window.dataService.loadEntities('kampagne');
    }
  }

  // Rendere Kampagnen-Liste
  async render(filterData) {
    const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
    
    // Aktive Filter als Tags
    let tags = '';
    const currentFilters = filterSystem.getFilters('kampagne');
    
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
          <h1>Kampagnen</h1>
          <p>Verwalten Sie alle Kampagnen und deren Details</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? '<button id="btn-kampagne-new" class="primary-btn">Neue Kampagne anlegen</button>' : ''}
        </div>
      </div>

      ${filterHtml}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" id="select-all-kampagnen">
              </th>
              <th>Kampagnenname</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Art der Kampagne</th>
              <th>Status</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Creator Anzahl</th>
              <th>Video Anzahl</th>
              <th>Ansprechpartner</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kampagnen-table-body">
            <tr>
              <td colspan="12" class="loading">Lade Kampagnen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      // Nutze das neue Filtersystem für die Filterbar (asynchron)
      await filterSystem.renderFilterBar('kampagne', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('🔍 KampagneList: Filter angewendet:', filters);
    filterSystem.applyFilters('kampagne', filters);
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 KampagneList: Filter zurückgesetzt');
    filterSystem.resetFilters('kampagne');
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

    // Neue Kampagne anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-kampagne-new' || e.target.id === 'btn-kampagne-new-filter') {
        e.preventDefault();
        window.navigateTo('/kampagne/new');
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.kampagne-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedKampagnen.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-kampagnen');
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

    // Kampagne Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'kampagne') {
        e.preventDefault();
        const kampagneId = e.target.dataset.id;
        console.log('🎯 KAMPAGNELIST: Navigiere zu Kampagne Details:', kampagneId);
        window.navigateTo(`/kampagne/${kampagneId}`);
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'kampagne') {
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
        const currentFilters = filterSystem.getFilters('kampagne');
        delete currentFilters[key];
        filterSystem.applyFilters('kampagne', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox (Tabellen-Header)
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-kampagnen') {
        const checkboxes = document.querySelectorAll('.kampagne-check');
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) {
            this.selectedKampagnen.add(cb.dataset.id);
          } else {
            this.selectedKampagnen.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
        console.log(`${isChecked ? '✅ Alle Kampagnen ausgewählt' : '❌ Alle Kampagnen abgewählt'}: ${this.selectedKampagnen.size}`);
      }
    });

    // Kampagne Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('kampagne-check')) {
        if (e.target.checked) {
          this.selectedKampagnen.add(e.target.dataset.id);
        } else {
          this.selectedKampagnen.delete(e.target.dataset.id);
        }
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });

    // Bulk-Actions werden jetzt vom BulkActionSystem verwaltet
    // Registriere diese Liste beim BulkActionSystem
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList('kampagne', this);
    }
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('kampagne');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedKampagnen.size;
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
  async updateTable(kampagnen) {
    const tbody = document.getElementById('kampagnen-table-body');
    if (!tbody) return;

    if (!kampagnen || kampagnen.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const rowsHtml = kampagnen.map(kampagne => {
      // Hilfsfunktionen für Formatierung
      const formatDate = (date) => {
        return date ? new Date(date).toLocaleDateString('de-DE') : '-';
      };

      const formatArray = (array) => array && Array.isArray(array) && array.length ? array.join(', ') : '-';

      return `
        <tr data-id="${kampagne.id}">
          <td><input type="checkbox" class="kampagne-check" data-id="${kampagne.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
              ${window.validatorSystem.sanitizeHtml(kampagne.kampagnenname || 'Unbekannt')}
            </a>
          </td>
          <td>${window.validatorSystem.sanitizeHtml(kampagne.unternehmen?.firmenname || 'Unbekannt')}</td>
          <td>${window.validatorSystem.sanitizeHtml(kampagne.marke?.markenname || 'Unbekannt')}</td>
          <td>${formatArray(kampagne.art_der_kampagne_display || kampagne.art_der_kampagne)}</td>
          <td>
            <span class="status-badge status-${(kampagne.status_name || '').toLowerCase().replace(/\s+/g,'-') || 'unknown'}">
              ${kampagne.status_name || '-'}
            </span>
          </td>
          <td>${formatDate(kampagne.start)}</td>
          <td>${formatDate(kampagne.deadline)}</td>
          <td>${kampagne.creatoranzahl || 0}</td>
          <td>${kampagne.videoanzahl || 0}</td>
          <td>${this.renderAnsprechpartner(kampagne.ansprechpartner)}</td>
          <td>
            <div class="actions-dropdown-container" data-entity-type="kampagne">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                  <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                </svg>
              </button>
              <div class="actions-dropdown">
                <div class="action-submenu">
                  <a href="#" class="action-item has-submenu" data-submenu="status">${actionsDropdown.getHeroIcon('invoice')}<span>Status ändern</span></a>
                  <div class="submenu" data-submenu="status">
                    ${ (this.statusOptions || []).map(st => `
                      <a href=\"#\" class=\"submenu-item\" data-action=\"set-field\" data-field=\"status_id\" data-value=\"${st.id}\" data-status-name=\"${st.name}\" data-id=\"${kampagne.id}\">\n                        ${actionsDropdown.getStatusIcon(st.name)}\n                        <span>${st.name}</span>\n                        ${(kampagne.status_id && kampagne.status_id === st.id) || (kampagne.status_name === st.name) ? '<span class=\"submenu-check\">'+actionsDropdown.getHeroIcon('check')+'</span>' : ''}\n                      </a>
                    `).join('') }
                  </div>
                </div>
                <a href="#" class="action-item" data-action="view" data-id="${kampagne.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
                  </svg>
                  Details anzeigen
                </a>
                <a href="#" class="action-item" data-action="edit" data-id="${kampagne.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
                    <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
                  </svg>
                  Bearbeiten
                </a>
                <a href="#" class="action-item" data-action="notiz" data-id="${kampagne.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                  </svg>
                  Notiz hinzufügen
                </a>
                ${ (window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin') ? `
                <a href="#" class="action-item" data-action="assign-staff" data-id="${kampagne.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
</svg>
                  Kampagne Mitarbeiter zuordnen
                </a>
                ` : ''}
                <a href="#" class="action-item" data-action="add_ansprechpartner_kampagne" data-id="${kampagne.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                  </svg>
                  Ansprechpartner hinzufügen
                </a>
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${kampagne.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
                  </svg>
                  Löschen
                </a>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Cleanup
  destroy() {
    console.log('KampagneList: Cleaning up...');
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
    console.log('🎯 Zeige Kampagnen-Erstellungsformular');
    window.setHeadline('Neue Kampagne anlegen');
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('kampagne');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Kampagne anlegen</h1>
          <p>Erstellen Sie eine neue Kampagne</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('kampagne', null);

    // Keine eigene Auto-Suggest UI mehr hier – wir nutzen die bestehende FormSystem Multiselects (pm_ids, scripter_ids, cutter_ids)
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    try {
      const form = document.getElementById('kampagne-form');
      const formData = new FormData(form);
      const submitData = {};

      // FormData zu Objekt konvertieren
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          submitData[key] = value;
        }
      }

      // Kampagnenname manuell hinzufügen (da readonly Feld nicht in FormData enthalten ist)
      const kampagnennameInput = form.querySelector('input[name="kampagnenname"]');
      if (kampagnennameInput && kampagnennameInput.value) {
        submitData.kampagnenname = kampagnennameInput.value;
      }

      console.log('📝 Kampagne Submit-Daten:', submitData);

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, 'kampagne');
      if (!validationResult.isValid) {
        this.showValidationErrors(validationResult.errors);
        return;
      }

      // Erstelle Kampagne
      const result = await window.dataService.createEntity('kampagne', submitData);
      
      if (result.success) {
        // Nach Erstellung: Rollen-Zuweisungen speichern via Formularwerte
        try {
          const kampagneId = result.id;
          const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
          const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
          const pm = uniq(toArray(submitData.pm_ids));
          const sc = uniq(toArray(submitData.scripter_ids));
          const cu = uniq(toArray(submitData.cutter_ids));
          const rows = [];
          pm.forEach(uid => rows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
          sc.forEach(uid => rows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'scripter' }));
          cu.forEach(uid => rows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'cutter' }));
          if (rows.length > 0 && window.supabase) {
            await window.supabase.from('kampagne_mitarbeiter').insert(rows);
          }
        } catch (e) {
          console.warn('⚠️ Rollen-Zuweisungen konnten nicht gespeichert werden', e);
        }

        this.showSuccessMessage('Kampagne erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kampagne', action: 'created', id: result.id }
        }));
        
        // Zurück zur Liste
        setTimeout(() => {
          window.navigateTo('/kampagne');
        }, 1500);
      } else {
        this.showErrorMessage(`Fehler beim Erstellen: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Kampagne:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  

  // Zeige Validierungsfehler
  showValidationErrors(errors) {
    console.error('❌ Validierungsfehler:', errors);
    
    // Alle bestehenden Fehlermeldungen entfernen
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    // Neue Fehlermeldungen anzeigen
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = message;
        fieldElement.parentNode.appendChild(errorDiv);
      }
    });
  }

  // Zeige Erfolgsmeldung
  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Zeige Fehlermeldung
  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Update Select-All Checkbox Status
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-kampagnen');
    const individualCheckboxes = document.querySelectorAll('.kampagne-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.kampagne-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  // Deselect All - alle Auswahlen aufheben
  deselectAll() {
    this.selectedKampagnen.clear();
    
    const checkboxes = document.querySelectorAll('.kampagne-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const selectAllCheckbox = document.getElementById('select-all-kampagnen');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
    console.log('✅ Alle Kampagnen-Auswahlen aufgehoben');
  }

  // Bestätigungsdialog für Bulk-Delete
  showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedKampagnen.size;
    if (selectedCount === 0) {
      alert('Keine Kampagnen ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie die ausgewählte Kampagne wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Kampagnen wirklich löschen?`;
    
    const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
    
    if (confirmed) {
      this.deleteSelectedKampagnen();
    }
  }

  // Ausgewählte Kampagnen löschen
  async deleteSelectedKampagnen() {
    const selectedIds = Array.from(this.selectedKampagnen);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Kampagnen...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const kampagneId of selectedIds) {
      try {
        const result = await window.dataService.deleteEntity('kampagne', kampagneId);
        
        if (result.success) {
          successCount++;
          console.log(`✅ Kampagne ${kampagneId} gelöscht`);
        } else {
          errorCount++;
          errors.push(`Kampagne ${kampagneId}: ${result.error}`);
          console.error(`❌ Fehler beim Löschen von Kampagne ${kampagneId}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        errors.push(`Kampagne ${kampagneId}: ${error.message}`);
        console.error(`❌ Unerwarteter Fehler beim Löschen von Kampagne ${kampagneId}:`, error);
      }
    }

    let message = '';
    if (successCount > 0) {
      message += `✅ ${successCount} Kampagnen erfolgreich gelöscht.`;
    }
    if (errorCount > 0) {
      message += `\n❌ ${errorCount} Kampagnen konnten nicht gelöscht werden.`;
      if (errors.length > 0) {
        message += `\n\nFehler:\n${errors.join('\n')}`;
      }
    }
    
    alert(message);

    this.deselectAll();
    await this.loadAndRender();

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'kampagne', action: 'bulk-deleted', count: successCount }
    }));
  }

  // Render Ansprechpartner
  renderAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner || ansprechpartner.length === 0) {
      return '-';
    }

    // Ansprechpartner als klickbare Tags (wie bei Marken)
    const ansprechpartnerTags = ansprechpartner
      .filter(ap => ap && ap.vorname && ap.nachname) // Nur gültige Ansprechpartner
      .map(ap => `<a href="#" class="tag tag--ansprechpartner" data-action="view-ansprechpartner" data-id="${ap.id}" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')">${ap.vorname} ${ap.nachname}</a>`)
      .join('');

    return `<div class="tags tags-compact">${ansprechpartnerTags}</div>`;
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneList = new KampagneList(); 