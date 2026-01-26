// AnsprechpartnerList.js (ES6-Modul)
// Ansprechpartner-Liste mit Filter, Verwaltung und Pagination

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { ansprechpartnerCreate } from './AnsprechpartnerCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

// Sprach-Mapping für Abkürzungen
const SPRACH_KUERZEL = {
  'Deutsch': 'DE',
  'Englisch': 'EN',
  'Französisch': 'FR',
  'Spanisch': 'ES',
  'Italienisch': 'IT',
  'Portugiesisch': 'PT',
  'Niederländisch': 'NL',
  'Polnisch': 'PL',
  'Russisch': 'RU',
  'Chinesisch': 'ZH',
  'Japanisch': 'JA',
  'Koreanisch': 'KO',
  'Arabisch': 'AR',
  'Türkisch': 'TR',
  'Griechisch': 'EL',
  'Schwedisch': 'SV',
  'Dänisch': 'DA',
  'Norwegisch': 'NO',
  'Finnisch': 'FI',
  'Tschechisch': 'CS',
  'Ungarisch': 'HU',
  'Rumänisch': 'RO',
  'Ukrainisch': 'UK',
  'Hindi': 'HI',
  'Hebräisch': 'HE',
  'Vietnamesisch': 'VI',
  'Thailändisch': 'TH',
  'Indonesisch': 'ID'
};

function getSprachKuerzel(name) {
  if (!name) return '-';
  return SPRACH_KUERZEL[name] || name.substring(0, 2).toUpperCase();
}

export class AnsprechpartnerList {
  constructor() {
    this.selectedAnsprechpartner = new Set();
    this._boundEventListeners = new Set();
    this.pagination = new PaginationSystem();
    // Sortierung: Standard alphabetisch A-Z (nach Nachname)
    this.currentSort = { field: 'nachname', ascending: true };
  }

  // Initialisiere Ansprechpartner-Liste
  async init() {
    window.setHeadline('Ansprechpartner Übersicht');
    console.log('🎯 ANSPRECHPARTNERLIST: Initialisiere Ansprechpartner-Liste');
    
    // Berechtigungsprüfung
    const canView = window.currentUser?.rolle === 'admin' || window.currentUser?.permissions?.ansprechpartner?.can_view;
    if (!canView) {
      const content = document.getElementById('dashboard-content');
      if (content) {
        content.innerHTML = `
          <div class="error-message">
            <p>Sie haben keine Berechtigung, Ansprechpartner anzuzeigen.</p>
          </div>
        `;
      }
      return;
    }
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Ansprechpartner', url: '/ansprechpartner', clickable: false }
      ]);
    }
    
    // Pagination initialisieren mit dynamicResize
    this.pagination.init('pagination-ansprechpartner', {
      itemsPerPage: 10,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
      dynamicResize: true,
      tbodySelector: '.data-table tbody',
      rowRenderer: (ap) => this.renderSingleRow(ap),
      dataLoader: async (offset, limit) => {
        const currentFilters = filterSystem.getFilters('ansprechpartner');
        const result = await window.dataService.loadEntitiesWithPagination(
          'ansprechpartner',
          currentFilters,
          1,
          offset + limit
        );
        return result.data ? result.data.slice(offset) : [];
      }
    });
    
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

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const canEdit = isAdmin || window.currentUser?.permissions?.ansprechpartner?.can_edit;
    
    content.innerHTML = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <div id="sort-dropdown-container"></div>
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? `<button id="btn-ansprechpartner-new" class="primary-btn">Neuen Ansprechpartner anlegen</button>` : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="ansprechpartner-table">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-ansprechpartner"></th>` : ''}
              <th class="col-name">Name</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Position</th>
              <th>Mail</th>
              <th>Telefon Mobil</th>
              <th>LinkedIn</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <!-- Wird dynamisch gefüllt -->
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-ansprechpartner"></div>
    `;
    
    // Initialisiere Filterbar mit neuem System
    await this.initializeFilterBar();
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    // Sort-Dropdown initialisieren
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('ansprechpartner', sortContainer, {
        nameField: 'nachname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }
    
    // Filter-Dropdown initialisieren
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('ansprechpartner', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Sortierung geändert
  onSortChange(sortConfig) {
    console.log('Sortierung geändert:', sortConfig);
    this.currentSort = sortConfig;
    // Reset pagination auf Seite 1 bei Sortier-Änderung
    this.pagination.reset();
    this.loadAndRender();
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('ansprechpartner', filters);
    // Reset pagination auf Seite 1 bei neuen Filtern
    this.pagination.reset();
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('ansprechpartner');
    // Reset pagination auf Seite 1
    this.pagination.reset();
    this.loadAndRender();
  }

  // Events binden
  bindEvents() {
    // Filter-Events werden vom FilterDropdown gehandelt

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

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.ansprechpartner-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedAnsprechpartner.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-ansprechpartner');
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

    // Entity Updated Event - nur reagieren wenn Liste aktiv ist
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'ansprechpartner') {
        // Nur neu laden wenn wir auf der Listen-Seite sind (nicht Detail-Seite)
        if (location.pathname === '/ansprechpartner') {
          this.loadAndRender();
        }
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
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    // "Alle auswählen" verstecken wenn Auswahl vorhanden, sonst anzeigen
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

  // Rendert eine einzelne Tabellenzeile für einen Ansprechpartner
  renderSingleRow(ap) {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    
    return `
      <tr data-id="${ap.id}">
        ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="ansprechpartner-check" data-id="${ap.id}"></td>` : ''}
        <td class="col-name col-name-with-icon">
          ${ap.profile_image_url 
            ? `<img src="${ap.profile_image_url}" class="table-logo" width="24" height="24" alt="" />` 
            : `<span class="table-avatar">${(ap.vorname || '?')[0].toUpperCase()}</span>`}
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${ap.id}">
            ${window.validatorSystem.sanitizeHtml(ap.vorname || '')} ${window.validatorSystem.sanitizeHtml(ap.nachname || '')}
          </a>
        </td>
        <td>
          ${this.renderUnternehmen(ap)}
        </td>
        <td>
          ${(ap.marken && ap.marken.length > 0)
            ? avatarBubbles.renderBubbles(ap.marken.map(m => ({
                name: m.markenname,
                type: 'org',
                id: m.id,
                entityType: 'marke',
                logo_url: m.logo_url || null
              })))
            : '-'}
        </td>
        <td>${ap.stadt || '-'}</td>
        <td>${ap.land || '-'}</td>
        <td>
          ${ap.positionen?.name ? `<div class="tag-list"><span class="tag tag--position">${window.validatorSystem.sanitizeHtml(ap.positionen.name)}</span></div>` : '-'}
        </td>
        <td>${ap.email ? `<a href="mailto:${ap.email}" class="table-link email-link">${ap.email}</a>` : '-'}</td>
        <td>${PhoneDisplay.render(
          ap.telefonnummer_land?.iso_code,
          ap.telefonnummer_land?.vorwahl,
          ap.telefonnummer
        )}</td>
        <td>${ap.linkedin ? `<a href="${ap.linkedin}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="LinkedIn Profil"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>` : '-'}</td>
        <td class="col-actions">
          ${actionBuilder.create('ansprechpartner', ap.id)}
        </td>
      </tr>
    `;
  }

  // Update Tabelle
  async updateTable(ansprechpartner) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!ansprechpartner || ansprechpartner.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${isAdmin ? '11' : '10'}" class="no-data">Keine Ansprechpartner gefunden</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = ansprechpartner.map(ap => this.renderSingleRow(ap)).join('');
    });
  }

  // Render Unternehmen (unterstützt sowohl Legacy-Einzelobjekt als auch Many-to-Many Array)
  renderUnternehmen(ap) {
    // Many-to-Many: unternehmen als Array
    if (Array.isArray(ap.unternehmen) && ap.unternehmen.length > 0) {
      const items = ap.unternehmen.map(u => ({
        name: u.firmenname,
        type: 'org',
        id: u.id,
        entityType: 'unternehmen',
        logo_url: u.logo_url || null
      }));
      return avatarBubbles.renderBubbles(items);
    }
    
    // Legacy: unternehmen als Einzelobjekt
    if (ap.unternehmen && ap.unternehmen.firmenname) {
      const items = [{
        name: ap.unternehmen.firmenname,
        type: 'org',
        id: ap.unternehmen.id,
        entityType: 'unternehmen',
        logo_url: ap.unternehmen.logo_url || null
      }];
      return avatarBubbles.renderBubbles(items);
    }
    
    return '-';
  }

  // Lade und rendere Daten
  async loadAndRender() {
    try {
      console.log('🔄 ANSPRECHPARTNERLIST: Lade Ansprechpartner...');
      
      // Rendere die Seite-Struktur
      await this.render();
      
      // Lade gefilterte Ansprechpartner mit Pagination
      const currentFilters = filterSystem.getFilters('ansprechpartner');
      const { currentPage, itemsPerPage } = this.pagination.getState();
      
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      
      // Für Nicht-Admins: Nur Ansprechpartner aus zugewiesenen Unternehmen/Marken laden
      let allowedAnsprechpartnerIds = null;
      if (!isAdmin && window.supabase) {
        try {
          // 1. Zugeordnete Marken (OHNE Join wegen RLS)
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          // Marken-IDs extrahieren
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          // Zugeordnete Marken mit ihren Unternehmen (separat laden wegen RLS)
          let markenMitUnternehmen = [];
          if (markenIds.length > 0) {
            const { data: markenData } = await window.supabase
              .from('marke')
              .select('id, unternehmen_id')
              .in('id', markenIds);
            
            markenMitUnternehmen = (markenData || []).map(m => ({
              marke_id: m.id,
              unternehmen_id: m.unternehmen_id
            }));
          }
          
          // 2. Zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          // Erstelle Map: Unternehmen-ID → zugeordnete Marken-IDs
          const unternehmenMarkenMap = new Map();
          markenMitUnternehmen.forEach(r => {
            if (r.unternehmen_id) {
              if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
                unternehmenMarkenMap.set(r.unternehmen_id, []);
              }
              unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
            }
          });
          
          // Sammle erlaubte Ansprechpartner-IDs
          const erlaubteAnsprechpartnerIds = new Set();
          
          // Für jedes zugeordnete Unternehmen
          for (const unternehmenId of unternehmenIds) {
            const zugeordneteMarken = unternehmenMarkenMap.get(unternehmenId);
            
            // IMMER: Ansprechpartner des Unternehmens laden (für alle Mitarbeiter des Unternehmens sichtbar)
            const { data: unternehmenAnsprechpartner } = await window.supabase
              .from('ansprechpartner_unternehmen')
              .select('ansprechpartner_id')
              .eq('unternehmen_id', unternehmenId);
            
            (unternehmenAnsprechpartner || []).forEach(r => {
              if (r.ansprechpartner_id) erlaubteAnsprechpartnerIds.add(r.ansprechpartner_id);
            });
            
            if (zugeordneteMarken && zugeordneteMarken.length > 0) {
              // Mitarbeiter hat spezifische Marken-Zuordnung → zusätzlich Ansprechpartner dieser Marken
              const { data: markenAnsprechpartner } = await window.supabase
                .from('ansprechpartner_marke')
                .select('ansprechpartner_id')
                .in('marke_id', zugeordneteMarken);
              
              (markenAnsprechpartner || []).forEach(r => {
                if (r.ansprechpartner_id) erlaubteAnsprechpartnerIds.add(r.ansprechpartner_id);
              });
            }
          }
          
          // Zusätzlich: Direkt zugeordnete Marken (ohne separate Unternehmen-Zuordnung)
          // → Hier AUCH Ansprechpartner des übergeordneten Unternehmens der Marke einbeziehen
          const direkteMarken = markenMitUnternehmen.filter(r => !unternehmenIds.includes(r.unternehmen_id));
          
          if (direkteMarken.length > 0) {
            const direkteMarkenIds = direkteMarken.map(r => r.marke_id);
            const direkteUnternehmenIds = [...new Set(direkteMarken.map(r => r.unternehmen_id).filter(Boolean))];
            
            // 1. Ansprechpartner direkt der Marke zugeordnet
            const { data: direkteMarkenAnsprechpartner } = await window.supabase
              .from('ansprechpartner_marke')
              .select('ansprechpartner_id')
              .in('marke_id', direkteMarkenIds);
            
            (direkteMarkenAnsprechpartner || []).forEach(r => {
              if (r.ansprechpartner_id) erlaubteAnsprechpartnerIds.add(r.ansprechpartner_id);
            });
            
            // 2. Ansprechpartner des übergeordneten Unternehmens der Marke
            if (direkteUnternehmenIds.length > 0) {
              const { data: unternehmenAnsprechpartner } = await window.supabase
                .from('ansprechpartner_unternehmen')
                .select('ansprechpartner_id')
                .in('unternehmen_id', direkteUnternehmenIds);
              
              (unternehmenAnsprechpartner || []).forEach(r => {
                if (r.ansprechpartner_id) erlaubteAnsprechpartnerIds.add(r.ansprechpartner_id);
              });
            }
          }
          
          allowedAnsprechpartnerIds = [...erlaubteAnsprechpartnerIds];
          console.log('🔍 ANSPRECHPARTNERLIST: Erlaubte Ansprechpartner für Nicht-Admin:', allowedAnsprechpartnerIds.length);
          
          // Wenn keine Ansprechpartner zugeordnet sind, zeige leeres Ergebnis
          if (allowedAnsprechpartnerIds.length === 0) {
            this.pagination.updateTotal(0);
            this.pagination.render();
            await this.updateTable([]);
            return;
          }
        } catch (error) {
          console.error('❌ ANSPRECHPARTNERLIST: Fehler beim Laden der Zuordnungen:', error);
        }
      }
      
      // Filter für erlaubte Ansprechpartner-IDs und Sortierung hinzufügen
      const filtersToApply = { ...currentFilters };
      if (allowedAnsprechpartnerIds) {
        filtersToApply._allowedIds = allowedAnsprechpartnerIds;
      }
      // Sortierung übergeben
      filtersToApply._sortBy = this.currentSort.field;
      filtersToApply._sortOrder = this.currentSort.ascending ? 'asc' : 'desc';
      
      console.log('🔍 Lade Ansprechpartner mit Filter und Pagination:', {
        filters: filtersToApply,
        page: currentPage,
        limit: itemsPerPage
      });
      
      const result = await window.dataService.loadEntitiesWithPagination(
        'ansprechpartner',
        filtersToApply,
        currentPage,
        itemsPerPage
      );
      
      console.log('📊 Ansprechpartner geladen:', result);
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(result.total);
      this.pagination.render();
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      await this.updateTable(result.data);
      
    } catch (error) {
      console.error('❌ ANSPRECHPARTNERLIST: Fehler beim Laden:', error);
      const tbody = document.querySelector('.data-table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" class="error">Fehler beim Laden der Ansprechpartner</td>
          </tr>
        `;
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
    
    // Pagination cleanup
    if (this.pagination) {
      this.pagination.destroy();
    }
    
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerList = new AnsprechpartnerList();