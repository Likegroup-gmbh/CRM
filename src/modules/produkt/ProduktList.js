// ProduktList.js (ES6-Modul)
// Produkt-Liste mit Filtersystem und Pagination

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { produktCreate } from './ProduktCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { ProduktFilterLogic } from './filters/ProduktFilterLogic.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

export class ProduktList {
  constructor() {
    this.selectedProdukte = new Set();
    this._boundEventListeners = new Set();
    this.pagination = new PaginationSystem();
  }

  // Initialisiere Produkt-Liste
  async init() {
    console.log('🎯 PRODUKTLIST: Initialisiere Produkt-Liste');
    
    // Prüfen ob dieses Modul noch das aktuelle ist
    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ PRODUKTLIST: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }
    
    window.setHeadline('Produkte Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Produkte', url: '/produkt', clickable: false }
      ]);
    }
    
    // BulkActionSystem für Produkt registrieren
    window.bulkActionSystem?.registerList('produkt', this);
    
    const canView = (window.canViewPage && window.canViewPage('produkt')) || await window.checkUserPermission('produkt', 'can_view');
    console.log('🔐 PRODUKTLIST: Berechtigung für produkt.can_view:', canView);
    
    if (!canView) {
      console.log('❌ PRODUKTLIST: Keine Berechtigung für Produkte');
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Produkte anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Pagination initialisieren mit dynamicResize
    this.pagination.init('pagination-produkt', {
      itemsPerPage: 10,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
      dynamicResize: true,
      tbodySelector: '.data-table tbody',
      rowRenderer: (produkt) => this.renderSingleRow(produkt),
      dataLoader: async (offset, limit) => {
        const currentFilters = filterSystem.getFilters('produkt');
        const result = await window.dataService.loadEntitiesWithPagination(
          'produkt', currentFilters, 1, offset + limit
        );
        return result.data ? result.data.slice(offset) : [];
      }
    });

    console.log('✅ PRODUKTLIST: Berechtigung OK, lade Produkte...');
    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
    console.log('✅ PRODUKTLIST: Initialisierung abgeschlossen');
  }

  // Lade und rendere Produkt-Liste
  async loadAndRender() {
    try {
      // Rendere die Seite-Struktur
      await this.render();
      
      // Lade gefilterte Produkte mit Pagination
      const currentFilters = filterSystem.getFilters('produkt');
      const { currentPage, itemsPerPage } = this.pagination.getState();
      
      console.log('🔍 Lade Produkte mit Filter und Pagination:', {
        filters: currentFilters,
        page: currentPage,
        limit: itemsPerPage
      });
      
      const result = await this.loadProdukteWithPagination(currentFilters, currentPage, itemsPerPage);
      
      console.log('📊 Produkte geladen:', result);
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(result.total);
      this.pagination.render();
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(result.data);
      
    } catch (error) {
      console.error('❌ Fehler beim Laden der Produkte:', error);
      if (window.ErrorHandler && window.ErrorHandler.handle) {
        window.ErrorHandler.handle(error, 'ProduktList.loadAndRender');
      }
    }
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

  // Lade Produkte mit Pagination und Beziehungen
  async loadProdukteWithPagination(filters = {}, page = 1, limit = 10) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return {
          data: [],
          total: 0,
          page,
          limit
        };
      }

      // Berechne Range für Supabase (0-basiert)
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Basis-Query mit Embeds und count
      let query = window.supabase
        .from('produkt')
        .select(`
          *,
          marke:marke_id(id, markenname, logo_url),
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          pflicht_elemente:produkt_pflicht_elemente(pflicht_element:pflicht_element_id(id, name)),
          no_gos:produkt_no_gos(no_go:no_go_id(id, name))
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Filter anwenden
      query = ProduktFilterLogic.buildSupabaseQuery(query, filters);

      // Range für Pagination
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Produkte mit Pagination:', error);
        throw error;
      }

      // Daten transformieren für Kompatibilität mit bestehender UI
      const transformedData = (data || []).map(produkt => ({
        ...produkt,
        pflicht_elemente: (produkt.pflicht_elemente || []).map(p => p.pflicht_element).filter(Boolean),
        no_gos: (produkt.no_gos || []).map(n => n.no_go).filter(Boolean)
      }));

      console.log('✅ Produkte mit Pagination geladen:', {
        items: transformedData.length,
        total: count,
        page,
        limit
      });

      return {
        data: transformedData,
        total: count || 0,
        page,
        limit
      };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Produkte mit Pagination:', error);
      throw error;
    }
  }

  // Rendere Produkt-Liste
  async render() {
    const canEdit = window.currentUser?.permissions?.produkt?.can_edit || false;
    
    // Filter-UI über dem Tabellen-Header
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
          <span id="selected-count" style="display:none;">0 ausgewählt</span>` : ''}
          ${canEdit ? '<button id="btn-produkt-new" class="primary-btn">Neues Produkt anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-produkte"></th>` : ''}
              <th class="col-name">Produkt-Name</th>
              <th>Marke</th>
              <th>Unternehmen</th>
              <th>Kernbotschaft</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '6' : '5'}" class="no-data">Lade Produkte...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-produkt"></div>
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
      await filterDropdown.init('produkt', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('produkt', filters);
    // Reset pagination auf Seite 1 bei neuen Filtern
    this.pagination.reset();
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('produkt');
    // Reset pagination auf Seite 1
    this.pagination.reset();
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Neues Produkt anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-produkt-new' || e.target.id === 'btn-produkt-new-filter') {
        e.preventDefault();
        window.navigateTo('/produkt/new');
      }
    });

    // Produkt Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'produkt') {
        e.preventDefault();
        const produktId = e.target.dataset.id;
        console.log('🎯 PRODUKTLIST: Navigiere zu Produkt Details:', produktId);
        window.navigateTo(`/produkt/${produktId}`);
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.produkt-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedProdukte.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-produkte');
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
        const checkboxes = document.querySelectorAll('.produkt-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedProdukte.clear();
        const selectAllHeader = document.getElementById('select-all-produkte');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'produkt') {
        this.loadAndRender();
      }
    });

    // Select-All Checkbox
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-produkte') {
        const checkboxes = document.querySelectorAll('.produkt-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedProdukte.add(cb.dataset.id);
          } else {
            this.selectedProdukte.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
      }
    });

    // Produkt Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('produkt-check')) {
        if (e.target.checked) {
          this.selectedProdukte.add(e.target.dataset.id);
        } else {
          this.selectedProdukte.delete(e.target.dataset.id);
        }
        this.updateSelection();
      }
    });
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedProdukte.size;
    const selectedCountElement = document.getElementById('selected-count');
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    
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
  }

  // Rendert eine einzelne Tabellenzeile für ein Produkt
  renderSingleRow(produkt) {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    
    return `
      <tr data-id="${produkt.id}">
        ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="produkt-check" data-id="${produkt.id}"></td>` : ''}
        <td class="col-name">
          <a href="#" class="table-link" data-table="produkt" data-id="${produkt.id}">
            ${window.validatorSystem.sanitizeHtml(produkt.name || '')}
          </a>
        </td>
        <td>${this.renderMarke(produkt.marke)}</td>
        <td>${this.renderUnternehmen(produkt.unternehmen)}</td>
        <td class="text-truncate" title="${window.validatorSystem.sanitizeHtml(produkt.kernbotschaft || '')}">
          ${this.truncateText(produkt.kernbotschaft, 60)}
        </td>
        <td class="col-actions">
          ${actionBuilder.create('produkt', produkt.id)}
        </td>
      </tr>
    `;
  }

  // Update Tabelle
  async updateTable(produkte) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!produkte || produkte.length === 0) {
        const { renderEmptyState } = await import('../../core/FilterUI.js');
        renderEmptyState(tbody);
        return;
      }

      tbody.innerHTML = produkte.map(produkt => this.renderSingleRow(produkt)).join('');
    });
  }

  // Render Marke als Avatar Bubble
  renderMarke(marke) {
    if (!marke || !marke.markenname) {
      return '-';
    }

    const items = [{
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Render Unternehmen als Avatar Bubble
  renderUnternehmen(unternehmen) {
    if (!unternehmen || !unternehmen.firmenname) {
      return '-';
    }

    const items = [{
      name: unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen',
      logo_url: unternehmen.logo_url || null
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Text kürzen
  truncateText(text, maxLength) {
    if (!text) return '-';
    const sanitized = window.validatorSystem.sanitizeHtml(text);
    if (sanitized.length <= maxLength) return sanitized;
    return sanitized.substring(0, maxLength) + '...';
  }

  // Cleanup
  destroy() {
    console.log('🗑️ PRODUKTLIST: Destroy aufgerufen');
    
    // Pagination cleanup
    if (this.pagination) {
      this.pagination.destroy();
    }
    
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    
    // Content zurücksetzen
    window.setContentSafely('');
    console.log('✅ PRODUKTLIST: Destroy abgeschlossen');
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Produkt-Erstellungsformular mit ProduktCreate');
    produktCreate.showCreateForm();
  }
}

// Exportiere Instanz für globale Nutzung
export const produktList = new ProduktList();
