// AuftragList.js (ES6-Modul)
// Auftrags-Liste mit Filter, Verwaltung und Pagination

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { AuftragsDetailsManager, auftragsDetailsManager } from './logic/AuftragsDetailsManager.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { AuftragFilterLogic } from './filters/AuftragFilterLogic.js';
import { AuftragCashFlowCalendar } from './AuftragCashFlowCalendar.js';

export class AuftragList {
  constructor() {
    this.selectedAuftraege = new Set();
    this._boundEventListeners = new Set();
    this.boundFilterResetHandler = null;
    this.pagination = new PaginationSystem();
    this.currentView = 'list'; // 'list' oder 'calendar'
    this.cashFlowCalendar = null;
    this._auftragNewBound = false; // Flag für einmaliges Binden
    this._globalEventsBound = false; // Flag für globale Events (Performance)
  }

  // Initialisiere Auftrags-Liste
  async init() {
    console.log('📋 AUFTRAGLIST: Initialisiere Auftrags-Liste');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftrag', url: '/auftrag', clickable: false }
      ]);
    }
    
    // Pagination initialisieren
    this.pagination.init('pagination-auftrag', {
      itemsPerPage: 10,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page)
    });
    
    try {
      // BulkActionSystem für Auftrag registrieren
      window.bulkActionSystem?.registerList('auftrag', this);
      
      await this.loadAndRender();
      this.bindEvents();
      console.log('✅ AUFTRAGLIST: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'AuftragList.init');
    }
  }

  // Lade und rendere Aufträge
  async loadAndRender() {
    console.log('🔄 AUFTRAGLIST: Lade und rendere Aufträge');
    
    try {
      // Seite rendern
      await this.render();
      console.log('✅ AUFTRAGLIST: Content gesetzt');
      
      // Event-Listener neu binden (wichtig nach jedem Render!)
      this.bindEvents();
      
      // Nur in List-View: Filter initialisieren und Daten laden
      if (this.currentView === 'list') {
      // Filter-Bar initialisieren
      await this.initializeFilterBar();
      
      // Aufträge mit Beziehungen und Pagination laden
      console.log('🔍 AUFTRAGLIST: Lade Aufträge mit Beziehungen und Pagination');
      const filters = filterSystem.getFilters('auftrag');
      const { data: auftraege, count } = await this.loadAuftraegeWithPagination(
        filters,
        this.pagination.currentPage,
        this.pagination.itemsPerPage
      );
      
      console.log('📊 AUFTRAGLIST: Aufträge mit Beziehungen geladen:', auftraege?.length, auftraege);
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(count);
      
      this.updateTable(auftraege);
      
      // Pagination rendern
      this.pagination.render();
      
      console.log('✅ AUFTRAGLIST: Tabelle aktualisiert');
      }
      
    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler beim Laden und Rendern:', error);
      if (window.ErrorHandler && window.ErrorHandler.handle) {
        window.ErrorHandler.handle(error, 'AuftragList.loadAndRender');
      }
    }
  }

  // Handler für Seiten-Wechsel
  handlePageChange(page) {
    console.log(`📄 AUFTRAGLIST: Wechsle zu Seite ${page}`);
    this.loadAndRender();
  }

  // Handler für Items-Per-Page-Wechsel
  handleItemsPerPageChange(limit, page) {
    console.log(`📄 AUFTRAGLIST: Items pro Seite geändert auf ${limit}, Seite ${page}`);
    this.loadAndRender();
  }

  // Rendere Auftrags-Liste
  async render() {
    window.setHeadline('Aufträge');

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    
    // Filter-Bar nur in List-View anzeigen
    let filterHtml = '';
    let tableActionsHtml = '';
    
    if (this.currentView === 'list') {
      filterHtml = `
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div id="filter-dropdown-container"></div>
          </div>
          <div class="table-actions">
            ${isAdmin ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
            ${isAdmin ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
            <span id="selected-count" style="display:none;">0 ausgewählt</span>
            ${isAdmin ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
            <button id="btn-auftrag-new" class="primary-btn">Neuen Auftrag anlegen</button>
          </div>
        </div>
      `;
    }
    
    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-list" class="secondary-btn ${this.currentView === 'list' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
              Liste
            </button>
            <button id="btn-view-calendar" class="secondary-btn ${this.currentView === 'calendar' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Kalender
            </button>
          </div>
        </div>
      </div>

      ${filterHtml}

      <!-- Content Container für beide Views -->
      <div id="auftrag-content-container">
        ${this.currentView === 'list' ? this.renderListView(isAdmin) : '<div id="calendar-container"></div>'}
      </div>
    `;

    window.setContentSafely(window.content, html);
    
    // Wenn Calendar-View, initialisiere Calendar
    if (this.currentView === 'calendar') {
      await this.initCashFlowCalendar();
    }
  }

  // Rendere List-View HTML
  renderListView(isAdmin) {
    return `
      <!-- Daten-Tabelle -->
      <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${isAdmin ? `<th>
                  <input type="checkbox" id="select-all-auftraege">
                </th>` : ''}
                <th>Auftragsname</th>
                <th>Unternehmen</th>
                <th>Marke</th>
                <th>PO</th>
                <th>RE. Nr</th>
                <th>RE-Fälligkeit</th>
                <th>Art der Kampagne</th>
                <th>Start</th>
                <th>Ende</th>
                <th>Netto</th>
                <th>UST</th>
                <th>Brutto</th>
                <th>Ansprechpartner</th>
                <th>Mitarbeiter</th>
                <th>Rechnung gestellt</th>
                <th>Überwiesen</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="auftraege-table-body">
              <tr>
                <td colspan="19" class="loading">Lade Aufträge...</td>
              </tr>
            </tbody>
          </table>
          
          <!-- Pagination -->
          <div class="pagination-container" id="pagination-auftrag"></div>
      </div>
    `;
  }

  // Lade Aufträge mit Beziehungen und Pagination
  async loadAuftraegeWithPagination(filters = {}, page = 1, limit = 10) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        const mockData = await window.dataService.loadEntities('auftrag');
        return { data: mockData, count: mockData.length };
      }

      // Berechne Range für Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Query mit nur benötigten Feldern aufbauen (Performance-Optimierung)
      let query = window.supabase
        .from('auftrag')
        .select(`
          id,
          auftragsname,
          status,
          po,
          re_nr,
          re_faelligkeit,
          start,
          ende,
          nettobetrag,
          ust_betrag,
          bruttobetrag,
          rechnung_gestellt,
          ueberwiesen,
          created_at,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url),
          ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url),
          cutter:auftrag_cutter(mitarbeiter:mitarbeiter_id(id, name, profile_image_url)),
          copywriter:auftrag_copywriter(mitarbeiter:mitarbeiter_id(id, name, profile_image_url)),
          mitarbeiter:auftrag_mitarbeiter(mitarbeiter:mitarbeiter_id(id, name, profile_image_url)),
          kampagne_arten:auftrag_kampagne_art(art:kampagne_art_id(id, name))
        `, { count: 'exact' });

      // Filter anwenden
      query = AuftragFilterLogic.buildSupabaseQuery(query, filters);

      // Sortierung und Pagination
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Aufträge mit Beziehungen:', error);
        throw error;
      }

      // Daten für Kompatibilität formatieren
      const formattedData = data.map(auftrag => ({
        ...auftrag,
        unternehmen: auftrag.unternehmen ? { 
          id: auftrag.unternehmen.id,
          firmenname: auftrag.unternehmen.firmenname,
          logo_url: auftrag.unternehmen.logo_url
        } : null,
        marke: auftrag.marke ? { 
          id: auftrag.marke.id,
          markenname: auftrag.marke.markenname,
          logo_url: auftrag.marke.logo_url
        } : null,
        // Art der Kampagne aus Junction-Table extrahieren
        art_der_kampagne: (auftrag.kampagne_arten || [])
          .map(ka => ka.art?.name)
          .filter(Boolean)
      }));

      console.log('✅ Aufträge mit Beziehungen und Pagination geladen:', formattedData);
      return { data: formattedData, count: count || 0 };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge mit Beziehungen:', error);
      throw error;
    }
  }

  // DEPRECATED: Alte Methode ohne Pagination
  async loadAuftraegeWithRelations() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('auftrag');
      }

      const { data, error } = await window.supabase
        .from('auftrag')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url),
          ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url),
          cutter:auftrag_cutter(mitarbeiter:mitarbeiter_id(id, name)),
          copywriter:auftrag_copywriter(mitarbeiter:mitarbeiter_id(id, name)),
          mitarbeiter:auftrag_mitarbeiter(mitarbeiter:mitarbeiter_id(id, name))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Fehler beim Laden der Aufträge mit Beziehungen:', error);
        throw error;
      }

      // Daten für Kompatibilität formatieren
      const formattedData = data.map(auftrag => ({
        ...auftrag,
        unternehmen: auftrag.unternehmen ? { 
          id: auftrag.unternehmen.id,
          firmenname: auftrag.unternehmen.firmenname,
          logo_url: auftrag.unternehmen.logo_url
        } : null,
        marke: auftrag.marke ? { 
          id: auftrag.marke.id,
          markenname: auftrag.marke.markenname,
          logo_url: auftrag.marke.logo_url
        } : null
      }));

      console.log('✅ Aufträge mit Beziehungen geladen:', formattedData);
      console.log('🔍 Debug - Erster Auftrag:', formattedData[0]);
      return formattedData;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge mit Beziehungen:', error);
      // Fallback zu normalem Laden
      return await window.dataService.loadEntities('auftrag');
    }
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('auftrag', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('🔍 AUFTRAGLIST: Filter angewendet:', filters);
    filterSystem.applyFilters('auftrag', filters);
    
    // Pagination auf Seite 1 zurücksetzen bei Filter-Änderung
    this.pagination.reset();
    
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 AUFTRAGLIST: Filter zurückgesetzt');
    filterSystem.resetFilters('auftrag');
    
    // Pagination auf Seite 1 zurücksetzen
    this.pagination.reset();
    
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // View-Toggle Events (diese müssen bei jedem Render gebunden werden wegen DOM-Ersetzung)
    this.bindViewToggleEvents();

    // Globale delegierte Events nur EINMAL binden (Performance-Optimierung)
    if (!this._globalEventsBound) {
      this.bindGlobalDelegatedEvents();
      this._globalEventsBound = true;
    }
  }

  // View-Toggle Events separat - werden bei jedem Render neu gebunden (DOM wird ersetzt)
  bindViewToggleEvents() {
    const listBtn = document.getElementById('btn-view-list');
    const calendarBtn = document.getElementById('btn-view-calendar');

    if (listBtn) {
      // Entferne alte Listener falls vorhanden
      const newListBtn = listBtn.cloneNode(true);
      listBtn.parentNode.replaceChild(newListBtn, listBtn);
      
      newListBtn.addEventListener('click', async () => {
        console.log('🔄 AUFTRAGLIST: Wechsel zu List-View');
        if (this.currentView === 'list') return;
        
        if (this.cashFlowCalendar) {
          this.cashFlowCalendar.destroy();
          this.cashFlowCalendar = null;
        }
        
        this.currentView = 'list';
        await this.loadAndRender();
      });
    }

    if (calendarBtn) {
      const newCalendarBtn = calendarBtn.cloneNode(true);
      calendarBtn.parentNode.replaceChild(newCalendarBtn, calendarBtn);
      
      newCalendarBtn.addEventListener('click', async () => {
        console.log('🔄 AUFTRAGLIST: Wechsel zu Calendar-View');
        if (this.currentView === 'calendar') return;
        
        this.currentView = 'calendar';
        await this.loadAndRender();
      });
    }
  }

  // Globale delegierte Events - nur EINMAL gebunden (Performance)
  bindGlobalDelegatedEvents() {
    // Ein einziger Click-Handler für alle delegierten Click-Events
    this._globalClickHandler = (e) => {
      // Neuen Auftrag anlegen Button
      if (e.target.id === 'btn-auftrag-new' || e.target.id === 'btn-auftrag-new-filter') {
        e.preventDefault();
        window.navigateTo('/auftrag/new');
        return;
      }

      // Alle auswählen Button
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedAuftraege.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-auftraege');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
        return;
      }

      // Auswahl aufheben Button
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedAuftraege.clear();
        const selectAllHeader = document.getElementById('select-all-auftraege');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
        return;
      }

      // Auftrag Detail Links
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftrag') {
        e.preventDefault();
        const auftragId = e.target.dataset.id;
        console.log('🎯 AUFTRAGLIST: Navigiere zu Auftrag Details:', auftragId);
        window.navigateTo(`/auftrag/${auftragId}`);
        return;
      }

      // Filter-Tag X-Buttons
      if (e.target.classList.contains('tag-x')) {
        e.preventDefault();
        e.stopPropagation();
        
        const tagElement = e.target.closest('.filter-tag');
        const key = tagElement?.dataset?.key;
        
        if (key) {
          const currentFilters = window.filterSystem.getFilters('auftrag');
          delete currentFilters[key];
          window.filterSystem.applyFilters('auftrag', currentFilters);
          this.loadAndRender();
        }
        return;
      }
    };

    // Ein einziger Change-Handler für alle delegierten Change-Events
    this._globalChangeHandler = (e) => {
      // Select-All Checkbox
      if (e.target.id === 'select-all-auftraege') {
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedAuftraege.add(cb.dataset.id);
          } else {
            this.selectedAuftraege.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
        return;
      }

      // Auftrag Checkboxes
      if (e.target.classList.contains('auftrag-check')) {
        if (e.target.checked) {
          this.selectedAuftraege.add(e.target.dataset.id);
        } else {
          this.selectedAuftraege.delete(e.target.dataset.id);
        }
        this.updateSelection();
        return;
      }
    };

    // Entity Updated Event Handler
    this._entityUpdatedHandler = (e) => {
      if (e.detail.entity === 'auftrag') {
        this.loadAndRender();
      }
    };

    // Events registrieren
    document.addEventListener('click', this._globalClickHandler);
    document.addEventListener('change', this._globalChangeHandler);
    window.addEventListener('entityUpdated', this._entityUpdatedHandler);
    
    console.log('✅ AUFTRAGLIST: Globale Event-Listener gebunden (einmalig)');
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = window.filterSystem.getFilters('auftrag');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedAuftraege.size;
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

  // Update Tabelle mit Fade-Animation
  async updateTable(auftraege) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // Fade-out Animation starten (behält alte Daten während Fade-out)
    tbody.classList.add('table-fade-out');
    
    // Warte auf Animation (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));

    if (!auftraege || auftraege.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="19" class="no-data">
            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📋</div>
              <h3 style="color: #666; margin-bottom: 8px;">Keine Aufträge vorhanden</h3>
              <p style="color: #999; margin-bottom: 20px;">Es wurden noch keine Aufträge erstellt.</p>
              <button id="btn-create-first-auftrag" class="primary-btn">
                Ersten Auftrag anlegen
              </button>
            </div>
          </td>
        </tr>
      `;
      
      // Event für den "Ersten Auftrag anlegen" Button
      const createBtn = document.getElementById('btn-create-first-auftrag');
      if (createBtn) {
        createBtn.addEventListener('click', (e) => {
          e.preventDefault();
          window.navigateTo('/auftrag/new');
        });
      }
      
      // Fade-in Animation
      tbody.classList.remove('table-fade-out');
      tbody.classList.add('table-fade-in');
      setTimeout(() => tbody.classList.remove('table-fade-in'), 200);
      return;
    }

    const rowsHtml = auftraege.map(auftrag => {
      // Hilfsfunktionen für Formatierung
      const formatCurrency = (value) => {
        return value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
      };
      
      const formatDate = (date) => {
        return date ? new Date(date).toLocaleDateString('de-DE') : '-';
      };
      
      const formatArray = (array) => {
        return array && Array.isArray(array) ? array.join(', ') : '-';
      };
      
      const formatBoolean = (value) => {
        if (value) {
          return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs); display: inline-block; vertical-align: middle;">
  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
</svg>`;
        } else {
          return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs); display: inline-block; vertical-align: middle;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>`;
        }
      };
      
      const formatAssignee = (assigneeId) => {
        return assigneeId ? '👤' : '-';
      };

      const formatAnsprechpartner = (person) => {
        if (!person) return '-';
        const fullName = [person.vorname, person.nachname].filter(Boolean).join(' ');
        if (!fullName) return '-';
        
        const items = [{
          name: fullName,
          type: 'person',
          id: person.id,
          entityType: 'ansprechpartner',
          profile_image_url: person.profile_image_url || null
        }];
        return avatarBubbles.renderBubbles(items);
      };

      const formatUnternehmenTag = (unternehmen) => {
        if (!unternehmen) return '-';
        const name = unternehmen.firmenname;
        if (!name) return '-';
        
        const items = [{
          name: name,
          type: 'org',
          id: unternehmen.id,
          entityType: 'unternehmen',
          logo_url: unternehmen.logo_url || null
        }];
        return avatarBubbles.renderBubbles(items);
      };

      const formatMarkeTag = (marke) => {
        if (!marke) return '-';
        const name = marke.markenname;
        if (!name) return '-';
        
        const items = [{
          name: name,
          type: 'org',
          id: marke.id,
          entityType: 'marke',
          logo_url: marke.logo_url || null
        }];
        return avatarBubbles.renderBubbles(items);
      };

      const formatMitarbeiterTags = (entries) => {
        if (!entries || entries.length === 0) return '-';
        
        console.log('🔍 formatMitarbeiterTags entries:', JSON.stringify(entries, null, 2));
        
        const items = entries
          .map(item => {
            const name = item?.mitarbeiter?.name || item?.name;
            const id = item?.mitarbeiter?.id || item?.id;
            const profileImageUrl = item?.mitarbeiter?.profile_image_url || item?.profile_image_url;
            console.log(`  → Mitarbeiter: ${name}, profile_image_url: ${profileImageUrl}`);
            if (!name) return null;
            return {
              name: name,
              type: 'person',
              id: id,
              entityType: 'mitarbeiter',
              profile_image_url: profileImageUrl || null
            };
          })
          .filter(Boolean);
        
        console.log('🔍 formatMitarbeiterTags items für Bubbles:', items);
        return items.length > 0 ? avatarBubbles.renderBubbles(items) : '-';
      };

      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

      return `
        <tr data-id="${auftrag.id}">
          ${isAdmin ? `<td><input type="checkbox" class="auftrag-check" data-id="${auftrag.id}"></td>` : ''}
          <td>
            <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id}">
              ${window.validatorSystem.sanitizeHtml(auftrag.auftragsname || 'Unbekannt')}
            </a>
          </td>
          <td>${formatUnternehmenTag(auftrag.unternehmen)}</td>
          <td>${formatMarkeTag(auftrag.marke)}</td>
          <td>${auftrag.po || '-'}</td>
          <td>${auftrag.re_nr || '-'}</td>
          <td>${formatDate(auftrag.re_faelligkeit)}</td>
          <td>${formatArray(auftrag.art_der_kampagne)}</td>
          <td>${formatDate(auftrag.start)}</td>
          <td>${formatDate(auftrag.ende)}</td>
          <td>${formatCurrency(auftrag.nettobetrag)}</td>
          <td>${formatCurrency(auftrag.ust_betrag)}</td>
          <td>${formatCurrency(auftrag.bruttobetrag)}</td>
          <td>${formatAnsprechpartner(auftrag.ansprechpartner)}</td>
          <td>${formatMitarbeiterTags(auftrag.mitarbeiter)}</td>
          <td>${formatBoolean(auftrag.rechnung_gestellt)}</td>
          <td>${formatBoolean(auftrag.ueberwiesen)}</td>
          <td>
            <span class="status-badge status-${auftrag.status?.toLowerCase() || 'unknown'}">
              ${auftrag.status || '-'}
            </span>
          </td>
          <td>
            ${actionBuilder.create('auftrag', auftrag.id)}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    
    // Fade-in Animation
    tbody.classList.remove('table-fade-out');
    tbody.classList.add('table-fade-in');
    setTimeout(() => tbody.classList.remove('table-fade-in'), 200);
  }

  // Initialisiere Cash Flow Calendar
  async initCashFlowCalendar() {
    console.log('📅 AUFTRAGLIST: Initialisiere Cash Flow Calendar');
    const container = document.getElementById('calendar-container');
    if (!container) {
      console.error('❌ Calendar-Container nicht gefunden');
      return;
    }
    
    this.cashFlowCalendar = new AuftragCashFlowCalendar();
    await this.cashFlowCalendar.init(container);
  }

  // Cleanup
  destroy() {
    console.log('AuftragList: Cleaning up...');

    // Pagination cleanup
    if (this.pagination) {
      this.pagination.destroy();
    }

    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();

    // Globale Event-Listener entfernen
    if (this._globalClickHandler) {
      document.removeEventListener('click', this._globalClickHandler);
      this._globalClickHandler = null;
    }
    if (this._globalChangeHandler) {
      document.removeEventListener('change', this._globalChangeHandler);
      this._globalChangeHandler = null;
    }
    if (this._entityUpdatedHandler) {
      window.removeEventListener('entityUpdated', this._entityUpdatedHandler);
      this._entityUpdatedHandler = null;
    }
    
    // Flags zurücksetzen
    this._globalEventsBound = false;
    this._auftragNewBound = false;

    // Legacy Filter-Handler entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
    
    console.log('✅ AUFTRAGLIST: Cleanup abgeschlossen');
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Auftrag-Erstellungsformular');
    window.setHeadline('Neuen Auftrag anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Aufträge', url: '/auftrag', clickable: true },
        { label: 'Neuer Auftrag', url: '/auftrag/new', clickable: false }
      ]);
    }

    const formHtml = window.formSystem.renderFormOnly('auftrag');
    const html = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    window.content.innerHTML = html;
    window.formSystem.bindFormEvents('auftrag', null);
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('auftrag-form');
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
      const form = document.getElementById('auftrag-form');
      const formData = new FormData(form);
      const submitData = {};

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln
      const processedFields = new Set();
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        const selectId = select.id;
        
        if (processedFields.has(fieldName)) {
          return;
        }
        processedFields.add(fieldName);
        
        let hiddenSelect = document.getElementById(`${selectId}_hidden`);
        
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}[]"]`);
        }
        
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            hiddenSelect = tagContainer.querySelector('select[multiple]');
          }
        }
        
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = [...new Set(Array.from(tags).map(tag => tag.dataset.value).filter(Boolean))];
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = [...new Set(Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean))];
          if (values.length > 0) {
            submitData[fieldName] = values;
          }
        }
      });

      // FormData zu Objekt konvertieren
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData.hasOwnProperty(cleanKey)) {
            submitData[cleanKey] = [];
          }
          if (!submitData[cleanKey].includes(value)) {
            submitData[cleanKey].push(value);
          }
        } else {
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          }
        }
      }

      // Deduplizierung
      for (const key of Object.keys(submitData)) {
        if (Array.isArray(submitData[key])) {
          submitData[key] = [...new Set(submitData[key])];
        }
      }

      console.log('📝 Auftrag Submit-Daten:', submitData);

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, {
        auftragsname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validationResult.isValid) {
        window.NotificationSystem?.show('error', 'Bitte füllen Sie alle Pflichtfelder aus');
        return;
      }

      // Erstelle Auftrag
      console.log('🚀 Erstelle Auftrag mit Daten:', JSON.stringify(submitData, null, 2));
      const result = await window.dataService.createEntity('auftrag', submitData);
      console.log('📦 DataService Ergebnis:', result);
      
      if (result.success) {
        // Nach Erstellung: Many-to-Many Beziehungen über RelationTables verarbeiten
        try {
          const auftragId = result.id;
          console.log('🎯 Auftrag erstellt mit ID:', auftragId);
          
          // RelationTables für Multi-Select-Felder verarbeiten
          await window.formSystem.relationTables.handleRelationTables('auftrag', auftragId, submitData, form);
          
        } catch (e) {
          console.warn('⚠️ Many-to-Many Zuordnungen konnten nicht gespeichert werden', e);
        }

        // Toast-Erfolgsmeldung
        window.NotificationSystem?.show('success', 'Auftrag erfolgreich angelegt');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'auftrag', action: 'created', id: result.id }
        }));
        
        // Zurück zur Liste
        setTimeout(() => {
          window.navigateTo('/auftrag');
        }, 1500);
      } else {
        window.NotificationSystem?.show('error', `Fehler beim Erstellen: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Auftrags:', error);
      window.NotificationSystem?.show('error', 'Ein unerwarteter Fehler ist aufgetreten');
    }
  }
}

const auftragListInstance = new AuftragList();
export { auftragListInstance as auftragList };