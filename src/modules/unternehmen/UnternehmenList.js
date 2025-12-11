// UnternehmenList.js (ES6-Modul)
// Unternehmen-Liste mit neuem Filtersystem und Pagination

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';

export class UnternehmenList {
  constructor() {
    this.selectedUnternehmen = new Set();
    this._boundEventListeners = new Set();
    this.pagination = new PaginationSystem();
  }

  // Initialisiere Unternehmen-Liste
  async init() {
    window.setHeadline('Unternehmen Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Unternehmen', url: '/unternehmen', clickable: false }
      ]);
    }
    
    const canView = (window.canViewPage && window.canViewPage('unternehmen')) || await window.checkUserPermission('unternehmen', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Unternehmen anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Pagination initialisieren
    this.pagination.init('pagination-unternehmen', {
      itemsPerPage: 10,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page)
    });

    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Lade und rendere Unternehmen-Liste
  async loadAndRender() {
    try {
      // Rendere die Seite-Struktur
      await this.render();
      
      // Lade gefilterte Unternehmen mit Pagination
      const currentFilters = filterSystem.getFilters('unternehmen');
      const { currentPage, itemsPerPage } = this.pagination.getState();
      const page = currentPage;
      const limit = itemsPerPage;
      
      console.log('🔍 Lade Unternehmen mit Filter und Pagination:', {
        filters: currentFilters,
        page,
        limit
      });
      
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      
      // Für Nicht-Admins: Nur zugewiesene Unternehmen laden
      let allowedUnternehmenIds = null;
      if (!isAdmin) {
        try {
          const { data: mitarbeiterUnternehmen, error } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          if (error) {
            console.error('❌ UNTERNEHMENLISTE: Fehler beim Laden der Zuordnungen:', error);
          }
          
          allowedUnternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          console.log('🔍 UNTERNEHMENLISTE: Zugeordnete Unternehmen für Nicht-Admin:', allowedUnternehmenIds.length);
          
          // Wenn keine Unternehmen zugeordnet sind, zeige leeres Ergebnis
          if (allowedUnternehmenIds.length === 0) {
            this.pagination.updateTotal(0);
            this.pagination.render();
            this.updateTable([]);
            return;
          }
        } catch (error) {
          console.error('❌ UNTERNEHMENLISTE: Exception beim Laden der Zuordnungen:', error);
        }
      }
      
      // Berechne Range für Supabase
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      // Eigene Query anstatt dataService, um Mitarbeiter-Filter anzuwenden
      let query = window.supabase
        .from('unternehmen')
        .select(`
          *,
          unternehmen_branchen (
            branche_id,
            branchen (
              id,
              name
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });
      
      // Nicht-Admin Filterung
      if (!isAdmin && allowedUnternehmenIds && allowedUnternehmenIds.length > 0) {
        query = query.in('id', allowedUnternehmenIds);
      }
      
      // Branche-Filter
      if (currentFilters.branche_id) {
        const { data: links } = await window.supabase
          .from('unternehmen_branchen')
          .select('unternehmen_id')
          .eq('branche_id', currentFilters.branche_id);
        
        const brancheUnternehmenIds = (links || []).map(r => r.unternehmen_id).filter(Boolean);
        
        if (brancheUnternehmenIds.length === 0) {
          this.pagination.updateTotal(0);
          this.pagination.render();
          this.updateTable([]);
          return;
        }
        
        query = query.in('id', brancheUnternehmenIds);
      }
      
      // Weitere Filter anwenden
      if (currentFilters.firmenname) {
        query = query.ilike('firmenname', `%${currentFilters.firmenname}%`);
      }
      if (currentFilters.status) {
        query = query.eq('status', currentFilters.status);
      }
      if (currentFilters.rechnungsadresse_stadt) {
        query = query.ilike('rechnungsadresse_stadt', `%${currentFilters.rechnungsadresse_stadt}%`);
      }
      if (currentFilters.rechnungsadresse_land) {
        query = query.ilike('rechnungsadresse_land', `%${currentFilters.rechnungsadresse_land}%`);
      }
      
      // Pagination anwenden
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('❌ Fehler beim Laden der Unternehmen:', error);
        throw error;
      }
      
      // Branchen-Daten transformieren
      const transformedData = (data || []).map(unternehmen => {
        if (unternehmen.unternehmen_branchen) {
          unternehmen.branchen = unternehmen.unternehmen_branchen
            .map(ub => ub.branchen)
            .filter(Boolean);
          delete unternehmen.unternehmen_branchen;
        } else {
          unternehmen.branchen = [];
        }
        return unternehmen;
      });
      
      const result = {
        data: transformedData,
        total: count || 0,
        page,
        limit
      };
      
      console.log('📊 Unternehmen geladen:', result);
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(result.total);
      this.pagination.render();
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(result.data);
      
    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen:', error);
      if (window.ErrorHandler && window.ErrorHandler.handle) {
        window.ErrorHandler.handle(error, 'UnternehmenList.loadAndRender');
      }
    }
  }

  // Rendere Unternehmen-Liste
  async render() {
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
    
    // Filter-Dropdown über dem Tabellen-Header
    let filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-dropdown-container"></div>
      </div>
    </div>`;
    
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    
    // Haupt-HTML
    let html = `
      <div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-unternehmen-new" class="primary-btn">Neues Unternehmen anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th><input type="checkbox" id="select-all-unternehmen"></th>` : ''}
              <th>Name</th>
              <th>Branche</th>
              <th>Ansprechpartner</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '7' : '6'}" class="no-data">Lade Unternehmen...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-unternehmen"></div>
    `;

    window.setContentSafely(window.content, html);
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Initialisiere Filter-Dropdown
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('unternehmen', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('unternehmen', filters);
    // Reset pagination auf Seite 1 bei neuen Filtern
    this.pagination.reset();
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('unternehmen');
    // Reset pagination auf Seite 1
    this.pagination.reset();
    this.loadAndRender();
  }

  // Handler für Seitenwechsel
  handlePageChange(page) {
    console.log('📄 Seite gewechselt:', page);
    this.loadAndRender();
  }

  // Handler für Items-per-page Änderung
  handleItemsPerPageChange(limit, page) {
    console.log('📊 Items per Page geändert:', { limit, page });
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Filter-Events werden vom FilterDropdown gehandelt

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
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (selectBtn) {
      selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
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

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    // Fade-out Animation starten (behält alte Daten während Fade-out)
    tbody.classList.add('table-fade-out');
    
    // Warte auf Animation (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));

    if (!unternehmen || unternehmen.length === 0) {
      // Einheitlicher Empty-State
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      
      // Fade-in Animation
      tbody.classList.remove('table-fade-out');
      tbody.classList.add('table-fade-in');
      setTimeout(() => tbody.classList.remove('table-fade-in'), 200);
      return;
    }

    // Kontakte für alle Unternehmen in einem Rutsch laden und mappen
    const unternehmenIds = unternehmen.map(u => u.id).filter(Boolean);
    const apMap = await this.loadAnsprechpartnerMap(unternehmenIds);

    const rowsHtml = unternehmen.map(unternehmen => `
      <tr data-id="${unternehmen.id}">
        ${isAdmin ? `<td><input type="checkbox" class="unternehmen-check" data-id="${unternehmen.id}"></td>` : ''}
        <td>
          <a href="#" class="table-link" data-table="unternehmen" data-id="${unternehmen.id}">
            ${window.validatorSystem.sanitizeHtml(unternehmen.firmenname || '')}
          </a>
        </td>
        <td>${this.renderBrancheTags(unternehmen.branchen)}</td>
        <td>${this.renderAnsprechpartnerList(apMap.get(unternehmen.id))}</td>
        <td>${window.validatorSystem.sanitizeHtml(unternehmen.rechnungsadresse_stadt || '')}</td>
        <td>${window.validatorSystem.sanitizeHtml(unternehmen.rechnungsadresse_land || '')}</td>
        <td>
          ${actionBuilder.create('unternehmen', unternehmen.id)}
        </td>
      </tr>
    `).join('');

    // Content austauschen während Fade-out aktiv ist
    tbody.innerHTML = rowsHtml;
    
    // Fade-in Animation
    tbody.classList.remove('table-fade-out');
    tbody.classList.add('table-fade-in');
    setTimeout(() => tbody.classList.remove('table-fade-in'), 200);
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
            email,
            profile_image_url
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

  // Ansprechpartner-Liste rendern (klickbare Avatar-Bubbles)
  renderAnsprechpartnerList(list) {
    if (!list || list.length === 0) return '-';
    
    // Ansprechpartner als klickbare Avatar-Bubbles
    const items = list
      .filter(ap => ap && ap.vorname && ap.nachname)
      .map(ap => ({
        name: `${ap.vorname} ${ap.nachname}`,
        type: 'person',
        id: ap.id,
        entityType: 'ansprechpartner',
        profile_image_url: ap.profile_image_url || null
      }));
    
    return avatarBubbles.renderBubbles(items);
  }

  // Cleanup
  destroy() {
    console.log('UnternehmenList: Cleaning up...');
    
    // Pagination cleanup
    if (this.pagination) {
      this.pagination.destroy();
    }
    
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
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Unternehmen', url: '/unternehmen', clickable: true },
        { label: 'Neues Unternehmen', url: '/unternehmen/new', clickable: false }
      ]);
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('unternehmen');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
        <div id="logo-preview-container" class="form-logo-preview" style="display: none;">
          <label class="form-logo-label">Logo Vorschau:</label>
          <img id="logo-preview-image" class="form-logo-image" alt="Logo Vorschau" />
        </div>
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('unternehmen', null);
    
    // Custom Submit Handler setzen (überschreibt FormSystem default)
    const form = document.getElementById('unternehmen-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
      
      // Logo-Preview-Funktion
      this.setupLogoPreview(form);
      
      // Duplikat-Validierung auf Firmenname
      this.setupDuplicateValidation(form);
    }
  }

  // Setup Duplikat-Validierung für Firmenname
  setupDuplicateValidation(form) {
    const firmennameField = form.querySelector('#firmenname, input[name="firmenname"]');
    if (!firmennameField) {
      console.warn('⚠️ UNTERNEHMENLIST: Firmenname-Feld nicht gefunden');
      return;
    }

    // Container für Duplicate-Messages (falls nicht existiert)
    let messageContainer = firmennameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      firmennameField.parentElement.appendChild(messageContainer);
    }

    // Blur Event
    firmennameField.addEventListener('blur', async (e) => {
      await this.validateUnternehmenDuplicate(e.target.value, messageContainer);
    });

    // Clear beim Tippen
    firmennameField.addEventListener('input', () => {
      this.clearDuplicateMessages(messageContainer);
      this.enableSubmitButton();
    });
  }

  // Validiere Unternehmen Duplikat
  async validateUnternehmenDuplicate(firmenname, messageContainer) {
    if (!firmenname || firmenname.trim().length < 2) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) {
      console.warn('⚠️ UNTERNEHMENLIST: DuplicateChecker nicht verfügbar');
      return;
    }

    try {
      const result = await window.duplicateChecker.checkUnternehmen(firmenname, null);

      if (result.exact) {
        // Exakt vorhanden → Button disablen, Fehler anzeigen
        this.showDuplicateError(messageContainer, result.similar);
        this.disableSubmitButton(true);
      } else if (result.similar.length > 0) {
        // Ähnlich → Info-Box (nicht blockierend)
        this.showDuplicateWarning(messageContainer, result.similar);
        this.enableSubmitButton();
      } else {
        // Alles gut
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      }
    } catch (error) {
      console.error('❌ UNTERNEHMENLIST: Fehler bei Duplikat-Validierung:', error);
    }
  }

  // Zeige Duplikat-Fehler
  showDuplicateError(container, entries) {
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Firmenname existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                  ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.firmenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${entry.firmenname}${entry.webseite ? ` <span class="duplicate-meta">(${entry.webseite})</span>` : ''}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'unternehmen');
  }

  // Zeige Duplikat-Warnung
  showDuplicateWarning(container, entries) {
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.firmenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${entry.firmenname}${entry.webseite ? ` <span class="duplicate-meta">(${entry.webseite})</span>` : ''}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'unternehmen');
  }

  // Bind Click-Events für Duplikat-Links
  bindDuplicateLinks(container, entityType) {
    const links = container.querySelectorAll('.duplicate-link[data-entity-id]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id) {
          // Internes Routing verwenden (ohne Reload, im gleichen Tab)
          const route = `/${entityType}/${id}`;
          if (window.navigationSystem) {
            window.navigationSystem.navigateTo(route);
          }
        }
      });
    });
  }

  // Lösche Duplikat-Messages
  clearDuplicateMessages(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  // Disable Submit Button
  disableSubmitButton(disable) {
    const form = document.getElementById('unternehmen-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = disable;
        if (disable) {
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
      }
    }
  }

  // Enable Submit Button
  enableSubmitButton() {
    const form = document.getElementById('unternehmen-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  }

  // Setup Logo Preview für Upload
  setupLogoPreview(form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
    if (!uploaderRoot) return;

    // Event für File-Input (falls vorhanden)
    const fileInput = uploaderRoot.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const previewContainer = document.getElementById('logo-preview-container');
            const previewImage = document.getElementById('logo-preview-image');
            if (previewContainer && previewImage) {
              previewImage.src = event.target.result;
              previewContainer.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
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

          // Logo-Upload (falls vorhanden)
          try {
            console.log('🔵 START: Logo-Upload für Unternehmen', result.id);
            await this.uploadLogo(result.id, form);
            console.log('✅ Logo-Upload abgeschlossen');
          } catch (logoErr) {
            console.error('❌ Logo-Upload fehlgeschlagen:', logoErr);
            if (logoErr && logoErr.message && !logoErr.message.includes('Kein Logo')) {
              alert('Logo konnte nicht hochgeladen werden: ' + logoErr.message);
            }
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
    if (window.currentUser?.rolle !== 'admin' && window.currentUser?.rolle?.toLowerCase() !== 'admin') return;
    
    const selectedIds = Array.from(this.selectedUnternehmen);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Unternehmen...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('unternehmen', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Unternehmen erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'unternehmen', action: 'bulk-deleted', count: result.deletedCount }
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

  // Logo-Upload
  async uploadLogo(unternehmenId, form) {
    try {
      console.log('📋 uploadLogo() aufgerufen für Unternehmen:', unternehmenId);
      
      const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
      console.log('  → Uploader Root:', uploaderRoot);
      console.log('  → Uploader Instance:', uploaderRoot?.__uploaderInstance);
      console.log('  → Files:', uploaderRoot?.__uploaderInstance?.files);
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Logo zum Hochladen (kein Uploader/keine Files)');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Logo-Upload übersprungen');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0]; // Nur ein Logo erlaubt
      const bucket = 'logos';
      
      // Security: Max 200 KB
      const MAX_FILE_SIZE = 200 * 1024; // 200 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      // Dateigröße prüfen
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Logo zu groß: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        alert(`Logo ist zu groß (max. 200 KB)`);
        return;
      }

      // Content-Type prüfen
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`⚠️ Nicht erlaubter Dateityp: ${file.name} (${file.type})`);
        alert(`Nur PNG und JPG Dateien sind erlaubt`);
        return;
      }

      // Dateiendung extrahieren
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `unternehmen/${unternehmenId}/logo.${ext}`;
      
      console.log(`📤 Uploading Logo: ${file.name} -> ${path}`);
      
      // Altes Logo löschen (falls vorhanden)
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(`unternehmen/${unternehmenId}`);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`unternehmen/${unternehmenId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Logos:', deleteErr);
      }
      
      // Upload zu Storage
      const { error: upErr } = await window.supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });
      
      if (upErr) {
        console.error(`❌ Logo-Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Signierte URL erstellen (7 Tage gültig)
      const { data: signed, error: signErr } = await window.supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 Tage
      
      if (signErr) {
        console.error(`❌ Fehler beim Erstellen der signierten URL:`, signErr);
        throw signErr;
      }
      
      const logo_url = signed?.signedUrl || '';
      
      // Logo-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from('unternehmen')
        .update({
          logo_url,
          logo_path: path
        })
        .eq('id', unternehmenId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Logo-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Logo erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Logo-Upload:', error);
      alert(`⚠️ Logo konnte nicht hochgeladen werden: ${error.message}`);
      // Nicht werfen - Unternehmen wurde bereits erstellt
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const unternehmenList = new UnternehmenList(); 