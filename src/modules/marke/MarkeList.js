// MarkeList.js (ES6-Modul)
// Marken-Liste mit neuem Filtersystem und Pagination

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { markeCreate } from './MarkeCreate.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { MarkeFilterLogic } from './filters/MarkeFilterLogic.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

export class MarkeList {
  constructor() {
    this.selectedMarken = new Set();
    this._boundEventListeners = new Set();
    this.pagination = new PaginationSystem();
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
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Marke', url: '/marke', clickable: false }
      ]);
    }
    
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

    // Pagination initialisieren
    this.pagination.init('pagination-marke', {
      itemsPerPage: 10,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page)
    });

    console.log('✅ MARKELLIST: Berechtigung OK, lade Marken...');
    // Binde Events sofort
    this.bindEvents();
    
    await this.loadAndRender();
    console.log('✅ MARKELLIST: Initialisierung abgeschlossen');
  }

  // Lade und rendere Marken-Liste
  async loadAndRender() {
    try {
      // Rendere die Seite-Struktur
      await this.render();
      
      // Lade gefilterte Marken mit Pagination
      const currentFilters = filterSystem.getFilters('marke');
      const { currentPage, itemsPerPage } = this.pagination.getState();
      
      console.log('🔍 Lade Marken mit Filter und Pagination:', {
        filters: currentFilters,
        page: currentPage,
        limit: itemsPerPage
      });
      
      const result = await this.loadMarkenWithPagination(currentFilters, currentPage, itemsPerPage);
      
      console.log('📊 Marken geladen:', result);
      
      // Pagination Total aktualisieren
      this.pagination.updateTotal(result.total);
      this.pagination.render();
      
      // Aktualisiere nur die Tabelle mit gefilterten Daten
      this.updateTable(result.data);
      
    } catch (error) {
      console.error('❌ Fehler beim Laden der Marken:', error);
      if (window.ErrorHandler && window.ErrorHandler.handle) {
        window.ErrorHandler.handle(error, 'MarkeList.loadAndRender');
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

  // Lade Marken mit Pagination und Beziehungen
  async loadMarkenWithPagination(filters = {}, page = 1, limit = 10) {
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

      // Sichtbarkeit: Nicht-Admins nur zugeordnete Marken (direkt oder über Unternehmen)
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedMarkeIds = [];
      
      console.log('🔍 MARKELIST: Sichtbarkeits-Check:', {
        currentUser: window.currentUser?.name,
        rolle: window.currentUser?.rolle,
        isAdmin: isAdmin,
        userId: window.currentUser?.id
      });
      
      // Neue Logik: Marken-Zuordnung als Zusatzfilter
      // - Nur Unternehmen zugeordnet → Sieht ALLE Marken des Unternehmens
      // - Unternehmen + bestimmte Marken → Sieht NUR die zugewiesenen Marken
      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Marken laden (OHNE Join wegen RLS-Problemen)
          const { data: assignedMarken, error } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
            
          if (error) {
            console.error('❌ MARKELIST: Fehler beim Laden der marke_mitarbeiter:', error);
          }
          
          // Marken-IDs extrahieren
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          console.log('🔍 MARKELIST DEBUG: markenIds aus marke_mitarbeiter:', markenIds);
          
          // 2. Falls Marken gefunden, deren Unternehmen-IDs separat laden
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
          
          console.log('🔍 MARKELIST DEBUG: assignedMarken (marke_mitarbeiter):', assignedMarken);
          console.log('🔍 MARKELIST DEBUG: markenMitUnternehmen:', markenMitUnternehmen);
          
          // 2. Zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          console.log('🔍 MARKELIST DEBUG: mitarbeiterUnternehmen:', mitarbeiterUnternehmen);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          console.log('🔍 MARKELIST DEBUG: unternehmenIds:', unternehmenIds);
          
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
          
          console.log('🔍 MARKELIST DEBUG: unternehmenMarkenMap:', Object.fromEntries(unternehmenMarkenMap));
          
          // Für jedes Unternehmen die erlaubten Marken ermitteln
          for (const unternehmenId of unternehmenIds) {
            const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
            
            console.log(`🔍 MARKELIST DEBUG: Prüfe Unternehmen ${unternehmenId}, explicitMarkenIds:`, explicitMarkenIds);
            
            if (explicitMarkenIds && explicitMarkenIds.length > 0) {
              // User hat explizite Marken-Zuordnung → Nur diese Marken erlauben
              console.log(`✅ MARKELIST: Explizite Marken für Unternehmen, füge hinzu:`, explicitMarkenIds);
              allowedMarkeIds.push(...explicitMarkenIds);
            } else {
              // Keine Marken-Zuordnung → ALLE Marken des Unternehmens erlauben
              console.log(`⚠️ MARKELIST: KEINE explizite Marken-Zuordnung für Unternehmen ${unternehmenId}, lade ALLE Marken`);
              const { data: alleMarken } = await window.supabase
                .from('marke')
                .select('id')
                .eq('unternehmen_id', unternehmenId);
              
              console.log(`⚠️ MARKELIST: Lade alle ${(alleMarken || []).length} Marken für dieses Unternehmen`);
              allowedMarkeIds.push(...(alleMarken || []).map(m => m.id));
            }
          }
          
          // WICHTIG: Direkt zugeordnete Marken hinzufügen (auch ohne separate Unternehmen-Zuordnung)
          // Dies ist notwendig für Mitarbeiter, die nur einer Marke zugeordnet sind
          const direktZugeordneteMarkenIds = markenMitUnternehmen.map(r => r.marke_id);
          allowedMarkeIds.push(...direktZugeordneteMarkenIds);
          
          // Duplikate entfernen
          allowedMarkeIds = [...new Set(allowedMarkeIds)];
          
          console.log('🔍 MARKELIST: Zugeordnete Marken für Nicht-Admin:', {
            zugeordneteUnternehmen: unternehmenIds.length,
            markenMitExpliziterZuordnung: unternehmenMarkenMap.size,
            direktZugeordneteMarken: direktZugeordneteMarkenIds.length,
            erlaubteMarken: allowedMarkeIds.length
          });
        } catch (error) {
          console.error('❌ MARKELIST: Exception beim Laden der Zuordnungen:', error);
        }
      }

      // Berechne Range für Supabase (0-basiert)
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Basis-Query mit Embeds und count
      let query = window.supabase
        .from('marke')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          branchen:marke_branchen(branche:branche_id(id, name)),
          ansprechpartner:ansprechpartner_marke(ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url)),
          mitarbeiter:marke_mitarbeiter!fk_marke_mitarbeiter_marke_id(role, mitarbeiter:mitarbeiter_id(id, name, profile_image_url))
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Nicht-Admin Filterung
      if (!isAdmin) {
        if (allowedMarkeIds.length > 0) {
          query = query.in('id', allowedMarkeIds);
        } else {
          // Keine zugeordneten Marken = leeres Ergebnis
          return {
            data: [],
            total: 0,
            page,
            limit
          };
        }
      }

      // Branche-Filter: Hole zuerst IDs aus Junction-Tabelle
      if (filters.branche_id) {
        try {
          const { data: branchenMarken, error: branchenError } = await window.supabase
            .from('marke_branchen')
            .select('marke_id')
            .eq('branche_id', filters.branche_id);
          
          if (branchenError) {
            console.error('❌ Fehler beim Laden der Marken-Branchen:', branchenError);
          } else {
            const markeIdsWithBranche = (branchenMarken || []).map(mb => mb.marke_id).filter(Boolean);
            console.log(`🔍 Gefundene Marken mit Branche ${filters.branche_id}:`, markeIdsWithBranche.length);
            
            if (markeIdsWithBranche.length > 0) {
              query = query.in('id', markeIdsWithBranche);
            } else {
              // Keine Marken mit dieser Branche
              return {
                data: [],
                total: 0,
                page,
                limit
              };
            }
          }
        } catch (error) {
          console.error('❌ Exception beim Branche-Filter:', error);
        }
      }

      // Andere Filter anwenden (ohne branche_id, das wurde schon behandelt)
      const filtersWithoutBranche = {...filters};
      delete filtersWithoutBranche.branche_id;
      query = MarkeFilterLogic.buildSupabaseQuery(query, filtersWithoutBranche);

      // Range für Pagination
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Marken mit Pagination:', error);
        throw error;
      }

      // Daten transformieren für Kompatibilität mit bestehender UI
      const transformedData = (data || []).map(marke => ({
        ...marke,
        branchen: (marke.branchen || []).map(b => b.branche).filter(Boolean),
        ansprechpartner: (marke.ansprechpartner || []).map(a => a.ansprechpartner).filter(Boolean),
        mitarbeiter: (marke.mitarbeiter || [])
          .map(m => m?.mitarbeiter ? ({ ...m.mitarbeiter, role: m.role || 'mitarbeiter' }) : null)
          .filter(Boolean)
      }));

      console.log('✅ Marken mit Pagination geladen:', {
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
      console.error('❌ Fehler beim Laden der Marken mit Pagination:', error);
      throw error;
    }
  }

  // Rendere Marken-Liste
  async render() {
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
          ${canEdit ? '<button id="btn-marke-new" class="primary-btn">Neue Marke anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-marken"></th>` : ''}
              <th class="col-name">Markenname</th>
              <th>Unternehmen</th>
              <th>Ansprechpartner</th>
              <th>Webseite</th>
              <th>Branche</th>
              <th class="col-mitarbeiter">Management</th>
              <th class="col-mitarbeiter">Lead</th>
              <th class="col-mitarbeiter">Mitarbeiter</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '10' : '9'}" class="no-data">Lade Marken...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-marke"></div>
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
      await filterDropdown.init('marke', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('Filter angewendet:', filters);
    filterSystem.applyFilters('marke', filters);
    // Reset pagination auf Seite 1 bei neuen Filtern
    this.pagination.reset();
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('Filter zurückgesetzt');
    filterSystem.resetFilters('marke');
    // Reset pagination auf Seite 1
    this.pagination.reset();
    this.loadAndRender();
  }

  // Binde Events
  bindEvents() {
    // Filter-Events werden vom FilterDropdown gehandelt

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

  // Update Tabelle
  async updateTable(marken) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!marken || marken.length === 0) {
        const { renderEmptyState } = await import('../../core/FilterUI.js');
        renderEmptyState(tbody);
        return;
      }

      tbody.innerHTML = marken.map(marke => `
        <tr data-id="${marke.id}">
          ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="marke-check" data-id="${marke.id}"></td>` : ''}
          <td class="col-name">
            <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
              ${window.validatorSystem.sanitizeHtml(marke.markenname || '')}
            </a>
          </td>
          <td>${this.renderUnternehmen(marke.unternehmen)}</td>
          <td>${this.renderAnsprechpartner(marke.ansprechpartner)}</td>
          <td>${marke.webseite ? `<a href="${marke.webseite}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${marke.webseite}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>` : '-'}</td>
          <td>${this.renderBranchen(marke.branchen)}</td>
          <td class="col-mitarbeiter">${this.renderMitarbeiterByRole((marke.mitarbeiter || []).filter(m => m.role === 'management'))}</td>
          <td class="col-mitarbeiter">${this.renderMitarbeiterByRole((marke.mitarbeiter || []).filter(m => m.role === 'lead_mitarbeiter'))}</td>
          <td class="col-mitarbeiter">${this.renderMitarbeiterByRole((marke.mitarbeiter || []).filter(m => m.role !== 'management' && m.role !== 'lead_mitarbeiter'))}</td>
          <td class="col-actions">
            ${actionBuilder.create('marke', marke.id)}
          </td>
        </tr>
      `).join('');
    });
  }

  // Rendere Branchen
  renderBranchen(branchen) {
    if (!branchen || branchen.length === 0) {
      return '-';
    }

    // Branchen als kompakte Tags
    const branchenTags = branchen
      .filter(branche => branche && branche.name)
      .map(branche => `<span class="tag tag--branche">${branche.name}</span>`)
      .join('');

    return `<div class="tags tags-compact">${branchenTags}</div>`;
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

  // Render Ansprechpartner
  renderAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner || ansprechpartner.length === 0) {
      return '-';
    }

    // Ansprechpartner als klickbare Avatar-Bubbles
    const items = ansprechpartner
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

  // Render Zuständigkeit (Mitarbeiter)
  renderZustaendigkeit(zustaendigkeit, mitarbeiter) {
    // Neue mitarbeiter-Zuordnungen haben Vorrang
    if (mitarbeiter && mitarbeiter.length > 0) {
      const items = mitarbeiter
        .filter(m => m && m.name)
        .map(m => ({
          name: m.name,
          type: 'person',
          id: m.id,
          entityType: 'mitarbeiter',
          profile_image_url: m.profile_image_url || null
        }));
      
      return avatarBubbles.renderBubbles(items);
    }
    
    // Fallback für alte zustaendigkeit-Struktur
    if (!zustaendigkeit || zustaendigkeit.length === 0) return '-';
    
    if (Array.isArray(zustaendigkeit)) {
      const items = zustaendigkeit.map(z => ({
        name: z.mitarbeiter?.name || 'Unbekannt',
        type: 'person',
        id: z.mitarbeiter?.id,
        entityType: 'mitarbeiter'
      }));
      return avatarBubbles.renderBubbles(items);
    }
    
    return `<span class="text-muted">${zustaendigkeit.mitarbeiter?.name || 'Unbekannt'}</span>`;
  }

  // Mitarbeiter nach Rolle rendern (für separate Spalten)
  renderMitarbeiterByRole(list) {
    if (!list || list.length === 0) return '-';
    
    const items = list
      .filter(m => m && m.name)
      .map(m => ({
        name: m.name,
        type: 'person',
        id: m.id,
        entityType: 'mitarbeiter',
        profile_image_url: m.profile_image_url || null
      }));
    
    return avatarBubbles.renderBubbles(items);
  }

  // Cleanup
  destroy() {
    console.log('🗑️ MARKELLIST: Destroy aufgerufen');
    
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
    
    // Content zurücksetzen
    window.setContentSafely('');
    console.log('✅ MARKELLIST: Destroy abgeschlossen');
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