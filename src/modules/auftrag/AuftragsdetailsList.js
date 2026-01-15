// AuftragsdetailsList.js (ES6-Modul)
// Auftragsdetails-Liste mit Filter, Verwaltung und Pagination

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

export class AuftragsdetailsList {
  constructor() {
    this.selectedDetails = new Set();
    this._boundEventListeners = new Set();
    this.boundFilterResetHandler = null;
    this.pagination = new PaginationSystem();
  }

  // Initialisiere Auftragsdetails-Liste
  async init() {
    console.log('📋 AUFTRAGSDETAILSLIST: Initialisiere Auftragsdetails-Liste');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: false }
      ]);
    }
    
    // Pagination initialisieren
    this.pagination.init('pagination-auftragsdetails', {
      itemsPerPage: 10,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page)
    });
    
    try {
      // BulkActionSystem für Auftragsdetails registrieren
      window.bulkActionSystem?.registerList('auftragsdetails', this);
      
      await this.loadAndRender();
      this.bindEvents();
      console.log('✅ AUFTRAGSDETAILSLIST: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSLIST: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsList.init');
    }
  }

  // Lade und rendere Auftragsdetails
  async loadAndRender() {
    console.log('🔄 AUFTRAGSDETAILSLIST: Lade und rendere Auftragsdetails');
    
    try {
      // Seite rendern
      await this.render();
      console.log('✅ AUFTRAGSDETAILSLIST: Content gesetzt');
      
      // Filter-Bar initialisieren
      await this.initializeFilterBar();
      
      // Auftragsdetails mit Beziehungen und Pagination laden
      console.log('🔍 AUFTRAGSDETAILSLIST: Lade Auftragsdetails mit Beziehungen und Pagination');
      const filters = filterSystem.getFilters('auftragsdetails');
      const { data: details, count } = await this.loadDetailsWithPagination(
        filters,
        this.pagination.currentPage,
        this.pagination.itemsPerPage
      );
      
      console.log('📊 AUFTRAGSDETAILSLIST: Auftragsdetails mit Beziehungen geladen:', details?.length, details);
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(count);
      
      this.updateTable(details);
      
      // Pagination rendern
      this.pagination.render();
      
      console.log('✅ AUFTRAGSDETAILSLIST: Tabelle aktualisiert');
      
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSLIST: Fehler beim Laden und Rendern:', error);
      if (window.ErrorHandler && window.ErrorHandler.handle) {
        window.ErrorHandler.handle(error, 'AuftragsdetailsList.loadAndRender');
      }
    }
  }

  // Handler für Seiten-Wechsel
  handlePageChange(page) {
    console.log(`📄 AUFTRAGSDETAILSLIST: Wechsle zu Seite ${page}`);
    this.loadAndRender();
  }

  // Handler für Items-Per-Page-Wechsel
  handleItemsPerPageChange(limit, page) {
    console.log(`📄 AUFTRAGSDETAILSLIST: Items pro Seite geändert auf ${limit}, Seite ${page}`);
    this.loadAndRender();
  }

  // Rendere Auftragsdetails-Liste
  async render() {
    window.setHeadline('Auftragsdetails');
    
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    const html = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div id="filter-dropdown-container"></div>
        </div>
        <div class="table-actions">
          ${isAdmin ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
          ${isAdmin ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          ${isAdmin ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
          <button id="btn-auftragsdetails-new" class="primary-btn">Neue Auftragsdetails anlegen</button>
        </div>
      </div>

      <!-- Daten-Tabelle -->
      <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${isAdmin ? `<th>
                  <input type="checkbox" id="select-all-auftragsdetails">
                </th>` : ''}
                <th class="col-auftrag">Auftrag</th>
                <th>Kategorie</th>
                <th>Beschreibung</th>
                <th>Erstellt am</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody id="auftragsdetails-table-body">
              <tr>
                <td colspan="6" class="loading">Lade Auftragsdetails...</td>
              </tr>
            </tbody>
          </table>
          
          <!-- Pagination -->
          <div class="pagination-container" id="pagination-auftragsdetails"></div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Lade Auftragsdetails mit Beziehungen und Pagination
  async loadDetailsWithPagination(filters = {}, page = 1, limit = 10) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        const mockData = await window.dataService.loadEntities('auftrag_details');
        return { data: mockData, count: mockData.length };
      }

      // Sichtbarkeit: Nicht-Admins sehen nur zugewiesene Aufträge
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      let allowedAuftragIds = null;
      
      if (!isAdmin && window.currentUser?.id) {
        try {
          // 1. Zugeordnete Marken laden
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser.id);
          
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          // 2. Marken-Daten mit Unternehmen-IDs laden
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
          
          // 3. Zugeordnete Unternehmen laden
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || []).map(r => r.unternehmen_id).filter(Boolean);
          
          // 4. Erlaubte Marken ermitteln (mit Marke-als-Zwischenfilter Logik)
          const unternehmenMarkenMap = new Map();
          markenMitUnternehmen.forEach(r => {
            if (r.unternehmen_id) {
              if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
                unternehmenMarkenMap.set(r.unternehmen_id, []);
              }
              unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
            }
          });
          
          let allowedMarkenIds = [];
          for (const unternehmenId of unternehmenIds) {
            const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
            if (explicitMarkenIds && explicitMarkenIds.length > 0) {
              allowedMarkenIds.push(...explicitMarkenIds);
            } else {
              const { data: alleMarken } = await window.supabase
                .from('marke')
                .select('id')
                .eq('unternehmen_id', unternehmenId);
              allowedMarkenIds.push(...(alleMarken || []).map(m => m.id));
            }
          }
          
          // Direkt zugeordnete Marken hinzufügen
          allowedMarkenIds.push(...markenIds);
          allowedMarkenIds = [...new Set(allowedMarkenIds)];
          
          // 5. Aufträge für erlaubte Marken laden
          let auftragIdsVonMarken = [];
          if (allowedMarkenIds.length > 0) {
            const { data: auftraegeVonMarken } = await window.supabase
              .from('auftrag')
              .select('id')
              .in('marke_id', allowedMarkenIds);
            auftragIdsVonMarken = (auftraegeVonMarken || []).map(a => a.id);
          }
          
          // 6. WICHTIG: Auch Aufträge OHNE marke_id laden, wenn User dem Unternehmen zugeordnet ist
          let auftragIdsOhneMarke = [];
          if (unternehmenIds.length > 0) {
            const { data: auftraegeOhneMarke } = await window.supabase
              .from('auftrag')
              .select('id')
              .in('unternehmen_id', unternehmenIds)
              .is('marke_id', null);
            auftragIdsOhneMarke = (auftraegeOhneMarke || []).map(a => a.id);
          }
          
          // 7. Beide Listen kombinieren
          allowedAuftragIds = [...new Set([...auftragIdsVonMarken, ...auftragIdsOhneMarke])];
          
          console.log('🔍 AUFTRAGSDETAILS: Erlaubte Aufträge:', {
            vonMarken: auftragIdsVonMarken.length,
            ohneMarke: auftragIdsOhneMarke.length,
            gesamt: allowedAuftragIds.length,
            unternehmenIds: unternehmenIds.length,
            markenIds: allowedMarkenIds.length
          });
        } catch (error) {
          console.error('❌ AUFTRAGSDETAILS: Fehler beim Laden der Zuordnungen:', error);
        }
      }
      
      // Wenn keine erlaubten Aufträge, leeres Ergebnis
      if (!isAdmin && allowedAuftragIds !== null && allowedAuftragIds.length === 0) {
        return { data: [], count: 0 };
      }

      // Berechne Range für Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Query mit allen Relations aufbauen
      let query = window.supabase
        .from('auftrag_details')
        .select(`
          *,
          auftrag:auftrag_id(
            id,
            auftragsname,
            status,
            unternehmen:unternehmen_id(id, firmenname, logo_url),
            marke:marke_id(id, markenname, logo_url)
          )
        `, { count: 'exact' });
      
      // Filtere nach erlaubten Aufträgen für Nicht-Admins
      if (!isAdmin && allowedAuftragIds !== null && allowedAuftragIds.length > 0) {
        query = query.in('auftrag_id', allowedAuftragIds);
      }

      // Filter anwenden (einfache Implementierung - kann erweitert werden)
      if (filters.kategorie) {
        query = query.eq('kategorie', filters.kategorie);
      }
      if (filters.auftrag_id) {
        query = query.eq('auftrag_id', filters.auftrag_id);
      }

      // Sortierung und Pagination
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Auftragsdetails mit Beziehungen:', error);
        throw error;
      }

      console.log('✅ Auftragsdetails mit Beziehungen und Pagination geladen:', data);
      return { data: data || [], count: count || 0 };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Auftragsdetails mit Beziehungen:', error);
      throw error;
    }
  }

  // Initialisiere Filterbar
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('auftragsdetails', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('🔍 AUFTRAGSDETAILSLIST: Filter angewendet:', filters);
    filterSystem.applyFilters('auftragsdetails', filters);
    
    // Pagination auf Seite 1 zurücksetzen bei Filter-Änderung
    this.pagination.reset();
    
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 AUFTRAGSDETAILSLIST: Filter zurückgesetzt');
    filterSystem.resetFilters('auftragsdetails');
    
    // Pagination auf Seite 1 zurücksetzen
    this.pagination.reset();
    
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Neuen Auftragsdetails anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-auftragsdetails-new' || e.target.closest('#btn-auftragsdetails-new')) {
        e.preventDefault();
        window.navigateTo('/auftragsdetails/new');
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.auftragsdetails-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedDetails.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-auftragsdetails');
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
        const checkboxes = document.querySelectorAll('.auftragsdetails-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedDetails.clear();
        const selectAllHeader = document.getElementById('select-all-auftragsdetails');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    // Auftragsdetails Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftragsdetails') {
        e.preventDefault();
        const detailsId = e.target.dataset.id;
        console.log('🎯 AUFTRAGSDETAILSLIST: Navigiere zu Auftragsdetails Details:', detailsId);
        window.navigateTo(`/auftragsdetails/${detailsId}`);
      }
    });

    // Entity Updated Event
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'auftragsdetails' || e.detail.entity === 'auftrag_details') {
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
        const currentFilters = window.filterSystem.getFilters('auftragsdetails');
        delete currentFilters[key];
        window.filterSystem.applyFilters('auftragsdetails', currentFilters);
        this.loadAndRender();
      }
    });

    // Select-All Checkbox
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-auftragsdetails') {
        const checkboxes = document.querySelectorAll('.auftragsdetails-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedDetails.add(cb.dataset.id);
          } else {
            this.selectedDetails.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
      }
    });

    // Auftragsdetails Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('auftragsdetails-check')) {
        if (e.target.checked) {
          this.selectedDetails.add(e.target.dataset.id);
        } else {
          this.selectedDetails.delete(e.target.dataset.id);
        }
        this.updateSelection();
      }
    });
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedDetails.size;
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

  // Ausgewählte Auftragsdetails löschen
  async showDeleteSelectedConfirmation() {
    if (window.currentUser?.rolle !== 'admin' && window.currentUser?.rolle?.toLowerCase() !== 'admin') return;
    
    const selectedIds = Array.from(this.selectedDetails);
    if (selectedIds.length === 0) {
      alert('Keine Auftragsdetails ausgewählt.');
      return;
    }
    
    const message = selectedIds.length === 1 
      ? 'Möchten Sie die ausgewählten Auftragsdetails wirklich löschen?' 
      : `Möchten Sie die ${selectedIds.length} ausgewählten Auftragsdetails wirklich löschen?`;

    const res = await window.confirmationModal.open({
      title: 'Löschvorgang bestätigen',
      message: message,
      confirmText: 'Endgültig löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!res?.confirmed) return;

    console.log(`🗑️ Lösche ${selectedIds.length} Auftragsdetails...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('auftrag_details', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Auftragsdetails erfolgreich gelöscht.`);
        
        this.selectedDetails.clear();
        this.updateSelection();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'auftragsdetails', action: 'bulk-deleted', count: result.deletedCount }
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

  // Update Tabelle mit Fade-Animation
  async updateTable(details) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!details || details.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="no-data">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📄</div>
                <h3 style="color: #666; margin-bottom: 8px;">Keine Auftragsdetails vorhanden</h3>
                <p style="color: #999; margin-bottom: 20px;">Es wurden noch keine Auftragsdetails erstellt.</p>
                <button id="btn-create-first-details" class="primary-btn">
                  Erste Auftragsdetails anlegen
                </button>
              </div>
            </td>
          </tr>
        `;
        
        const createBtn = document.getElementById('btn-create-first-details');
        if (createBtn) {
          createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.navigateTo('/auftragsdetails/new');
          });
        }
        return;
      }

      tbody.innerHTML = details.map(detail => {
        const auftrag = detail.auftrag || {};
        
        return `
          <tr data-id="${detail.id}">
            ${isAdmin ? `<td><input type="checkbox" class="auftragsdetails-check" data-id="${detail.id}"></td>` : ''}
            <td class="col-auftrag">
              <a href="#" class="table-link" data-table="auftragsdetails" data-id="${detail.id}">
                ${window.validatorSystem?.sanitizeHtml(auftrag.auftragsname || 'Unbekannter Auftrag') || 'Unbekannter Auftrag'}
              </a>
            </td>
            <td>${detail.kategorie || '-'}</td>
            <td>${detail.beschreibung ? (detail.beschreibung.length > 100 ? detail.beschreibung.substring(0, 100) + '...' : detail.beschreibung) : '-'}</td>
            <td>${formatDate(detail.created_at)}</td>
            <td>
              ${actionBuilder.create('auftragsdetails', detail.id)}
            </td>
          </tr>
        `;
      }).join('');
    });
  }

  // Cleanup
  destroy() {
    console.log('AuftragsdetailsList: Cleaning up...');
    
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
    console.log('🎯 Zeige Auftragsdetails-Erstellungsformular');
    window.setHeadline('Neue Auftragsdetails anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: true },
        { label: 'Neue Auftragsdetails', url: '/auftragsdetails/new', clickable: false }
      ]);
    }

    window.navigateTo('/auftragsdetails/new');
  }
}

const auftragsdetailsListInstance = new AuftragsdetailsList();
export { auftragsdetailsListInstance as auftragsdetailsList };

