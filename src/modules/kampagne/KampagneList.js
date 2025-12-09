// KampagneList.js (ES6-Modul)
// Kampagnen-Liste mit neuem Filtersystem und Kanban-View

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { KampagneKanbanBoard } from './KampagneKanbanBoard.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { KampagneFilterLogic } from './filters/KampagneFilterLogic.js';

// Kampagnen-Cache mit TTL
const kampagnenCache = {
  data: null,
  timestamp: 0,
  ttl: 60000, // 60 Sekunden
  filterKey: null,
  
  get(filterKey) {
    const now = Date.now();
    if (this.data && this.filterKey === filterKey && (now - this.timestamp) < this.ttl) {
      console.log('📦 CACHE HIT: Kampagnen aus Cache geladen');
      return this.data;
    }
    return null;
  },
  
  set(data, filterKey) {
    this.data = data;
    this.filterKey = filterKey;
    this.timestamp = Date.now();
    console.log('📦 CACHE SET: Kampagnen im Cache gespeichert');
  },
  
  invalidate() {
    this.data = null;
    this.filterKey = null;
    this.timestamp = 0;
    console.log('📦 CACHE INVALIDATED');
  }
};

// Globaler Event-Listener für Cache-Invalidierung
window.addEventListener('entityUpdated', (e) => {
  if (e.detail.entity === 'kampagne') {
    kampagnenCache.invalidate();
  }
});

export class KampagneList {
  constructor() {
    this.selectedKampagnen = new Set();
    this._boundEventListeners = new Set();
    this.statusOptions = [];
    this.kampagneArtMap = new Map();
    this.currentView = 'kanban'; // 'list' oder 'kanban' - Standard: kanban
    this.kanbanBoard = null;
    
    // AbortController und Mount-Status für Race Condition Prevention
    this._abortController = null;
    this._isMounted = false;
  }

  // Initialisiere Kampagnen-Liste
  async init() {
    // Setze Mount-Status
    this._isMounted = true;
    
    // Abort vorherige Requests wenn vorhanden
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    
    window.setHeadline('Kampagnen Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kampagne', url: '/kampagne', clickable: false }
      ]);
    }
    
    // Verstecke Bulk-Actions für Kunden
    if (window.bulkActionSystem) {
      window.bulkActionSystem.hideForKunden();
    }
    
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
    
    await this.loadAndRender();
  }

  // Lade und rendere Kampagnen-Liste
  async loadAndRender() {
    try {
      // Prüfe Mount-Status vor DOM-Updates
      if (!this._isMounted) {
        console.log('⚠️ KAMPAGNELIST: Nicht mehr gemounted, breche ab');
        return;
      }
      
      // Rendere die Seite (asynchron)
      await this.render();
      
      // Nur für List-View: Filter und Daten laden
      if (this.currentView === 'list') {
        // Initialisiere Filterbar mit neuem System
        await this.initializeFilterBar();
        
        // Prüfe ob abgebrochen wurde
        if (this._abortController?.signal.aborted || !this._isMounted) {
          console.log('⚠️ KAMPAGNELIST: Request abgebrochen');
          return;
        }
        
        // Lade gefilterte Kampagnen für die Anzeige
        const currentFilters = filterSystem.getFilters('kampagne');
        console.log('🔍 Lade Kampagnen mit Filter:', currentFilters);
        const filteredKampagnen = await this.loadKampagnenWithRelations();
        
        // Prüfe nochmal ob noch gemounted vor DOM-Update
        if (!this._isMounted || this._abortController?.signal.aborted) {
          console.log('⚠️ KAMPAGNELIST: Nicht mehr gemounted nach Laden, überspringe DOM-Update');
          return;
        }
        
        console.log('📊 Kampagnen geladen:', filteredKampagnen?.length || 0);
        
        // Aktualisiere nur die Tabelle mit gefilterten Daten
        this.updateTable(filteredKampagnen);
      }
      // Für Kanban-View: Kanban Board lädt seine eigenen Daten
      
    } catch (error) {
      // Ignoriere Abort-Fehler
      if (error.name === 'AbortError') {
        console.log('⚠️ KAMPAGNELIST: Request wurde abgebrochen');
        return;
      }
      window.ErrorHandler.handle(error, 'KampagneList.loadAndRender');
    }
  }

  // Lade Kampagnen mit Beziehungen
  async loadKampagnenWithRelations() {
    const startTime = performance.now();
    
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('kampagne');
      }
      
      // Cache-Check: Prüfe ob Daten im Cache sind
      const activeFilters = filterSystem.getFilters('kampagne');
      const cacheKey = JSON.stringify(activeFilters);
      const cachedData = kampagnenCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // PARALLEL: Status, Arten und Permission-Daten gleichzeitig laden
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
      
      const [statusResult, artResult, permissionsResult] = await parallelLoad([
        // 1. Status-Optionen laden
        () => window.supabase
          .from('kampagne_status')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        
        // 2. Kampagnenarten laden
        () => window.supabase
          .from('kampagne_art_typen')
          .select('id, name'),
        
        // 3. Permissions laden (nur für Nicht-Admins)
        () => isAdmin ? Promise.resolve({ data: null }) : this.loadUserPermissions()
      ]);
      
      // Status und Arten verarbeiten
      this.statusOptions = statusResult.data || [];
      this.kampagneArtMap = new Map((artResult.data || []).map(r => [r.id, r.name]));
      
      // Permissions verarbeiten
      let assignedKampagnenIds = [];
      if (!isAdmin) {
        assignedKampagnenIds = permissionsResult.data || [];
        
        console.log(`🔍 KAMPAGNELIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf ${assignedKampagnenIds.length} Kampagnen`);
        
        // Für Mitarbeiter: Wenn keine zugewiesenen Kampagnen, dann keine Daten
        // Für Kunden: RLS-Policies filtern automatisch, also weiter machen
        if (assignedKampagnenIds.length === 0 && window.currentUser?.rolle !== 'kunde') {
          console.log('⚠️ Keine zugewiesenen Kampagnen für Mitarbeiter gefunden');
          return [];
        }
      }

      // Haupt-Query
      let query = window.supabase
        .from('kampagne')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url),
          auftrag:auftrag_id(auftragsname),
          status_ref:status_id(id, name)
        `)
        .order('created_at', { ascending: false });

      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen
      // Für Kunden: RLS-Policies filtern automatisch
      if (!isAdmin && window.currentUser?.rolle !== 'kunde' && assignedKampagnenIds.length > 0) {
        query = query.in('id', assignedKampagnenIds);
      }

      // Filter aus FilterSystem anwenden (activeFilters bereits oben definiert)
      console.log('🔍 KAMPAGNELIST: Wende Filter an:', activeFilters);
      query = KampagneFilterLogic.buildSupabaseQuery(query, activeFilters);

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
          unternehmen: k.unternehmen ? { 
            id: k.unternehmen.id, 
            firmenname: k.unternehmen.firmenname, 
            logo_url: k.unternehmen.logo_url 
          } : null,
          marke: k.marke ? { 
            id: k.marke.id, 
            markenname: k.marke.markenname, 
            logo_url: k.marke.logo_url 
          } : null,
          auftrag: k.auftrag ? { auftragsname: k.auftrag.auftragsname } : null,
          status_name: k.status_ref?.name || k.status || null
        };
      });

      // Lade Many-to-Many Beziehungen (z.B. Ansprechpartner) über DataService
      const entityConfig = window.dataService.entities.kampagne;
      if (entityConfig.manyToMany) {
        await window.dataService.loadManyToManyRelations(formattedData, 'kampagne', entityConfig.manyToMany);
      }

      // Lade alle Mitarbeiter für die geladenen Kampagnen über die aggregierte View
      const kampagneIds = formattedData.map(k => k.id).filter(Boolean);
      let mitarbeiterByKampagne = {};

      if (kampagneIds.length > 0) {
        const { data: mitarbeiterData, error: mitarbeiterError } = await window.supabase
          .from('v_kampagne_mitarbeiter_aggregated')
          .select('kampagne_id, mitarbeiter_id, name, rolle, profile_image_url, zuordnungsart')
          .in('kampagne_id', kampagneIds);
        
        if (!mitarbeiterError && mitarbeiterData) {
          // Gruppiere Mitarbeiter nach Kampagne
          mitarbeiterData.forEach(m => {
            if (!mitarbeiterByKampagne[m.kampagne_id]) {
              mitarbeiterByKampagne[m.kampagne_id] = [];
            }
            mitarbeiterByKampagne[m.kampagne_id].push({
              id: m.mitarbeiter_id,
              name: m.name,
              rolle: m.rolle,
              profile_image_url: m.profile_image_url,
              zuordnungsart: m.zuordnungsart
            });
          });
          console.log('✅ KAMPAGNELIST: Mitarbeiter geladen für', Object.keys(mitarbeiterByKampagne).length, 'Kampagnen');
        } else if (mitarbeiterError) {
          console.error('❌ Fehler beim Laden der Mitarbeiter:', mitarbeiterError);
        }
      }

      // Füge Mitarbeiter zu den formatierten Daten hinzu
      formattedData.forEach(kampagne => {
        if (!kampagne.mitarbeiter || kampagne.mitarbeiter.length === 0) {
          kampagne.mitarbeiter = mitarbeiterByKampagne[kampagne.id] || [];
        }
      });

      // Virtual Filter anwenden (z.B. creator_count, duration)
      const filtered = KampagneFilterLogic.applyVirtualFilters(formattedData, activeFilters);

      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ KAMPAGNELIST: ${filtered.length} Kampagnen geladen (von ${formattedData.length} nach Filter) in ${loadTime}ms`);
      
      // Cache speichern
      kampagnenCache.set(filtered, cacheKey);
      
      return filtered;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnen mit Beziehungen:', error);
      // Fallback zu normalem Laden
      return await window.dataService.loadEntities('kampagne');
    }
  }
  
  // Helper: Lade User Permissions parallel (OPTIMIERT)
  async loadUserPermissions() {
    try {
      const userId = window.currentUser?.id;
      if (!userId) return { data: [] };
      
      // STUFE 1: Alle Basis-Permission-Queries PARALLEL ausführen
      const [directResult, markenResult, unternehmenResult] = await parallelLoad([
        // 1. Direkt zugeordnete Kampagnen
        () => window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne_id')
          .eq('mitarbeiter_id', userId),
        
        // 2. Kampagnen über zugeordnete Marken
        () => window.supabase
          .from('marke_mitarbeiter')
          .select('marke_id')
          .eq('mitarbeiter_id', userId),
        
        // 3. Kampagnen über zugeordnete Unternehmen
        () => window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen_id')
          .eq('mitarbeiter_id', userId)
      ]);
      
      // Direkte Kampagnen-IDs
      const directKampagnenIds = (directResult.data || []).map(r => r.kampagne_id).filter(Boolean);
      
      // IDs extrahieren
      const markenIds = (markenResult.data || []).map(r => r.marke_id).filter(Boolean);
      const unternehmenIds = (unternehmenResult.data || []).map(r => r.unternehmen_id).filter(Boolean);
      
      // STUFE 2: Folge-Queries PARALLEL ausführen (statt sequentiell!)
      const [markenKampagnenResult, unternehmenMarkenResult] = await Promise.all([
        // Kampagnen über Marken
        markenIds.length > 0 
          ? window.supabase.from('kampagne').select('id').in('marke_id', markenIds)
          : Promise.resolve({ data: [] }),
        
        // Marken über Unternehmen
        unternehmenIds.length > 0
          ? window.supabase.from('marke').select('id').in('unternehmen_id', unternehmenIds)
          : Promise.resolve({ data: [] })
      ]);
      
      const markenKampagnenIds = (markenKampagnenResult.data || []).map(k => k.id).filter(Boolean);
      const unternehmenMarkenIds = (unternehmenMarkenResult.data || []).map(m => m.id).filter(Boolean);
      
      // STUFE 3: Kampagnen über Unternehmen-Marken (falls nötig)
      let unternehmenKampagnenIds = [];
      if (unternehmenMarkenIds.length > 0) {
        const { data: kampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('marke_id', unternehmenMarkenIds);
        
        unternehmenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
      }
      
      // Alle zusammenführen und Duplikate entfernen
      const allKampagnenIds = [...new Set([
        ...directKampagnenIds,
        ...markenKampagnenIds,
        ...unternehmenKampagnenIds
      ])];
      
      console.log(`🔍 Permission-Details:`, {
        direkteKampagnen: directKampagnenIds.length,
        markenKampagnen: markenKampagnenIds.length,
        unternehmenKampagnen: unternehmenKampagnenIds.length,
        gesamt: allKampagnenIds.length
      });
      
      return { data: allKampagnenIds };
      
    } catch (error) {
      console.error('❌ Fehler beim Laden der Permissions:', error);
      // Für Kunden: RLS-Policies filtern automatisch, also weiter machen
      // Für Mitarbeiter: Bei Fehler keine Daten anzeigen
      if (window.currentUser?.rolle !== 'kunde') {
        return { data: [] };
      }
      return { data: [] };
    }
  }

  // Rendere Kampagnen-Liste
  async render() {
    const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
    
    // Filter-Dropdown über dem Tabellen-Header (nur in List-View)
    let filterHtml = '';
    if (this.currentView === 'list') {
      filterHtml = `<div class="filter-bar">
        <div class="filter-left">
          <div id="filter-dropdown-container"></div>
        </div>
      </div>`;
    }
    
    // Haupt-HTML
    let html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-list" class="secondary-btn ${this.currentView === 'list' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
              Liste
            </button>
            <button id="btn-view-kanban" class="secondary-btn ${this.currentView === 'kanban' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
              Kanban
            </button>
          </div>
        </div>
      </div>

      <div class="content-section">
        <div id="kampagnen-content-container">
          ${this.currentView === 'kanban' ? '<div id="kanban-container"></div>' : this.renderTableWrapper()}
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);

    // Setze CSS-Klasse für Kanban-View
    this.updateViewClass();

    // Kanban Board initialisieren wenn View = kanban
    if (this.currentView === 'kanban') {
      await this.initKanbanBoard();
    }
    
    // Binde Events nach dem Rendern
    this.bindEvents();
  }

  renderTableWrapper() {
    const isKunde = window.currentUser?.rolle === 'kunde';
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const canEdit = window.currentUser?.permissions?.kampagne?.can_edit || false;
    
    return `
      ${!isKunde ? `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${isAdmin ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
          ${isAdmin ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
          ${isAdmin ? '<span id="selected-count" style="display:none;">0 ausgewählt</span>' : ''}
          ${isAdmin ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
          ${canEdit ? '<button id="btn-kampagne-new" class="primary-btn">Neue Kampagne anlegen</button>' : ''}
        </div>
      </div>` : ''}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${!isKunde && isAdmin ? `<th>
                <input type="checkbox" id="select-all-kampagnen">
              </th>` : ''}
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
              <th>Mitarbeiter</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kampagnen-table-body">
            <tr>
              <td colspan="${isKunde ? '12' : '13'}" class="loading">Lade Kampagnen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  async initKanbanBoard() {
    const container = document.getElementById('kanban-container');
    if (!container) return;

    // Cleanup old board
    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
    }

    // Neue Board-Instanz
    this.kanbanBoard = new KampagneKanbanBoard();
    await this.kanbanBoard.init(container);
  }

  // Initialisiere Filter-Dropdown
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('kampagne', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
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

  // Update CSS-Klasse für View
  updateViewClass() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      if (this.currentView === 'kanban') {
        mainContent.classList.add('kanban-view-active');
        console.log('✅ Kanban-View CSS-Klasse gesetzt');
      } else {
        mainContent.classList.remove('kanban-view-active');
        console.log('✅ Kanban-View CSS-Klasse entfernt');
      }
    }
  }

  // Binde Events
  bindEvents() {
    // View-Toggle Events
    const listBtn = document.getElementById('btn-view-list');
    const kanbanBtn = document.getElementById('btn-view-kanban');

    if (listBtn) {
      listBtn.addEventListener('click', async () => {
        console.log('🔄 Wechsel zu List-View');
        if (this.currentView === 'list') return; // Bereits in List-View
        
        // Cleanup Kanban Board
        if (this.kanbanBoard) {
          this.kanbanBoard.destroy();
          this.kanbanBoard = null;
        }
        
        this.currentView = 'list';
        
        // Entferne Kanban-View CSS-Klasse
        this.updateViewClass();
        
        await this.loadAndRender(); // Re-render und Daten laden
      });
    }

    if (kanbanBtn) {
      kanbanBtn.addEventListener('click', async () => {
        console.log('🔄 Wechsel zu Kanban-View');
        if (this.currentView === 'kanban') return; // Bereits in Kanban-View
        
        this.currentView = 'kanban';
        
        // Setze Kanban-View CSS-Klasse
        this.updateViewClass();
        
        await this.render(); // Re-render (initKanbanBoard wird in render() aufgerufen)
      });
    }

    // Filter-Events werden vom FilterDropdown gehandelt (nur in List-View)
    if (this.currentView === 'list') {
      // Initialisiere Filterbar nur für List-View
      this.initializeFilterBar();
    }

    // Neue Kampagne anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-kampagne-new' || e.target.id === 'btn-kampagne-new-filter') {
        e.preventDefault();
        window.navigateTo('/kampagne/new');
      }
    });

    // Nur für List-View: Bulk-Actions, Select-All, etc.
    if (this.currentView === 'list') {
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
      if (window.bulkActionSystem) {
        window.bulkActionSystem.registerList('kampagne', this);
      }

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
    }

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
        if (this.currentView === 'kanban' && this.kanbanBoard) {
          this.kanbanBoard.refresh();
        } else {
          this.loadAndRender();
        }
      }
    });

    // Kampagne Updated Event (von Kanban Board)
    window.addEventListener('kampagneUpdated', (e) => {
      if (this.currentView === 'kanban' && this.kanbanBoard) {
        this.kanbanBoard.refresh();
      } else {
        this.loadAndRender();
      }
    });
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
  async updateTable(kampagnen) {
    const tbody = document.getElementById('kampagnen-table-body');
    if (!tbody) return;

    const isKunde = window.currentUser?.rolle === 'kunde';

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
      const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

      return `
        <tr data-id="${kampagne.id}">
          ${!isKunde && isAdmin ? `<td><input type="checkbox" class="kampagne-check" data-id="${kampagne.id}"></td>` : ''}
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
              ${window.validatorSystem.sanitizeHtml(kampagne.kampagnenname || 'Unbekannt')}
            </a>
          </td>
          <td>${this.renderUnternehmen(kampagne.unternehmen)}</td>
          <td>${this.renderMarke(kampagne.marke)}</td>
          <td>${this.renderArtTags(kampagne.art_der_kampagne_display || kampagne.art_der_kampagne)}</td>
          <td>${this.renderStatusBadge(kampagne.status_name)}</td>
          <td>${formatDate(kampagne.start)}</td>
          <td>${formatDate(kampagne.deadline)}</td>
          <td>${kampagne.creatoranzahl || 0}</td>
          <td>${kampagne.videoanzahl || 0}</td>
          <td>${this.renderAnsprechpartner(kampagne.ansprechpartner)}</td>
          <td>${this.renderMitarbeiter(kampagne.mitarbeiter)}</td>
          <td>
            ${actionBuilder.create('kampagne', kampagne.id, window.currentUser, { 
              statusOptions: this.statusOptions, 
              currentStatus: { id: kampagne.status_id, name: kampagne.status_name } 
            })}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Cleanup
  destroy() {
    console.log('KampagneList: Cleaning up...');
    
    // Setze Mount-Status auf false (verhindert weitere DOM-Updates)
    this._isMounted = false;
    
    // Abort laufende Requests
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
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
    
    // Kanban Board cleanup
    if (this.kanbanBoard) {
      this.kanbanBoard.destroy();
      this.kanbanBoard = null;
    }
    
    // Entferne CSS-Klasse von main-content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.remove('kanban-view-active');
      console.log('✅ KampagneList: CSS-Klasse "kanban-view-active" entfernt');
    }
    
    // Sicherheits-Cleanup: Entferne alle Kanban-Floating-Scrollbars
    const floatingScrollbars = document.querySelectorAll('.floating-scrollbar-kanban');
    floatingScrollbars.forEach(scrollbar => {
      if (scrollbar.parentNode) {
        scrollbar.parentNode.removeChild(scrollbar);
        console.log('✅ KampagneList: Floating-Scrollbar aus DOM entfernt (Fallback)');
      }
    });
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    console.log('🎯 Zeige Kampagnen-Erstellungsformular');
    window.setHeadline('Neue Kampagne anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kampagne', url: '/kampagne', clickable: true },
        { label: 'Neue Kampagne', url: '/kampagne/new', clickable: false }
      ]);
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('kampagne');
    window.content.innerHTML = `
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

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln
      // Tracke bereits verarbeitete Feldnamen um Duplikate zu vermeiden
      const processedFields = new Set();
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        const selectId = select.id;
        
        // Skip wenn bereits verarbeitet (verhindert Duplikate bei mehreren Selects mit gleichem Namen)
        if (processedFields.has(fieldName)) {
          console.log(`⏭️ Feld ${fieldName} bereits verarbeitet, überspringe`);
          return;
        }
        processedFields.add(fieldName);
        
        // Methode 1: Suche Hidden-Select mit _hidden ID-Suffix (vom OptionsManager erstellt)
        let hiddenSelect = document.getElementById(`${selectId}_hidden`);
        
        // Methode 2: Suche nach Name mit [] Suffix
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}[]"]`);
        }
        
        // Methode 3: Suche in Tag-Container
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            hiddenSelect = tagContainer.querySelector('select[multiple]');
          }
        }
        
        // Methode 4: Sammle direkt aus Tags
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = [...new Set(Array.from(tags).map(tag => tag.dataset.value).filter(Boolean))];
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Tags gesammelt:`, tagValues);
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = [...new Set(Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean))];
          if (values.length > 0) {
            submitData[fieldName] = values;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, values);
          } else {
            console.log(`ℹ️ Hidden-Select für ${fieldName} gefunden, aber keine Werte ausgewählt`);
          }
        } else {
          console.warn(`⚠️ Kein Hidden-Select oder Tags für ${fieldName} gefunden`);
        }
      });

      // FormData zu Objekt konvertieren (aber Tag-basierte Felder nicht überschreiben)
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData.hasOwnProperty(cleanKey)) {
            submitData[cleanKey] = [];
          }
          // Nur pushen wenn der Wert noch nicht drin ist (Duplikat-Vermeidung)
          if (!submitData[cleanKey].includes(value)) {
            submitData[cleanKey].push(value);
          }
        } else {
          // Nur setzen wenn nicht bereits als Array von Tag-basierten Feldern gesetzt
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          } else {
            console.log(`⚠️ Überspringe ${key}, bereits als Array gesetzt:`, submitData[key]);
          }
        }
      }

      // Kampagnenname manuell hinzufügen (da readonly Feld nicht in FormData enthalten ist)
      const kampagnennameInput = form.querySelector('input[name="kampagnenname"]');
      if (kampagnennameInput && kampagnennameInput.value) {
        submitData.kampagnenname = kampagnennameInput.value;
      }

      // GLOBALE DEDUPLIZIERUNG: Entferne Duplikate aus allen Array-Feldern
      for (const key of Object.keys(submitData)) {
        if (Array.isArray(submitData[key])) {
          const before = submitData[key].length;
          submitData[key] = [...new Set(submitData[key])];
          const after = submitData[key].length;
          if (before !== after) {
            console.log(`🧹 Dedupliziert ${key}: ${before} → ${after} Einträge`);
          }
        }
      }

      console.log('📝 Kampagne Submit-Daten:', submitData);

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, 'kampagne');
      if (!validationResult.isValid) {
        this.showValidationErrors(validationResult.errors);
        return;
      }

      // Erstelle Kampagne
      console.log('🚀 Erstelle Kampagne mit Daten:', JSON.stringify(submitData, null, 2));
      const result = await window.dataService.createEntity('kampagne', submitData);
      console.log('📦 DataService Ergebnis:', result);
      
      if (result.success) {
        // Nach Erstellung: Many-to-Many Beziehungen speichern
        try {
          const kampagneId = result.id;
          console.log('🎯 Kampagne erstellt mit ID:', kampagneId);
          const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
          const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
          
          // Ansprechpartner-Zuordnungen
          const ansprechpartner = uniq(toArray(submitData.ansprechpartner_ids));
          if (ansprechpartner.length > 0) {
            const ansprechpartnerRows = ansprechpartner.map(apId => ({
              kampagne_id: kampagneId,
              ansprechpartner_id: apId
            }));
            await window.supabase.from('ansprechpartner_kampagne').insert(ansprechpartnerRows);
            console.log('✅ Ansprechpartner-Zuordnungen gespeichert:', ansprechpartnerRows.length);
          }
          
          // Mitarbeiter-Zuordnungen (alle Rollen + allgemeine Mitarbeiter)
          const mitarbeiter = uniq(toArray(submitData.mitarbeiter_ids));
          const pm = uniq(toArray(submitData.pm_ids));
          const sc = uniq(toArray(submitData.scripter_ids));
          const cu = uniq(toArray(submitData.cutter_ids));
          const cw = uniq(toArray(submitData.copywriter_ids));
          const st = uniq(toArray(submitData.strategie_ids));
          const cs = uniq(toArray(submitData.creator_sourcing_ids));
          
          console.log('👥 Mitarbeiter-Daten:', { mitarbeiter, pm, sc, cu, cw, st, cs });
          
          const mitarbeiterRows = [];
          // Allgemeine Mitarbeiter als 'projektmanager' einfügen (da 'mitarbeiter' nicht erlaubt ist)
          mitarbeiter.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
          pm.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
          sc.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'scripter' }));
          cu.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'cutter' }));
          cw.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'copywriter' }));
          st.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'strategie' }));
          cs.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'creator_sourcing' }));
          
          console.log('📋 Zu speichernde Mitarbeiter-Rows:', mitarbeiterRows);
          
          if (mitarbeiterRows.length > 0 && window.supabase) {
            const { data, error } = await window.supabase.from('kampagne_mitarbeiter').insert(mitarbeiterRows);
            if (error) {
              console.error('❌ Fehler beim Speichern der Mitarbeiter:', error);
            } else {
              console.log('✅ Mitarbeiter-Zuordnungen gespeichert:', mitarbeiterRows.length, data);
            }
          } else {
            console.log('ℹ️ Keine Mitarbeiter-Rows zu speichern (Länge:', mitarbeiterRows.length, ')');
          }
          
          // Paid-Ziele Zuordnungen
          const paidZiele = uniq(toArray(submitData.paid_ziele_ids));
          if (paidZiele.length > 0) {
            const paidZieleRows = paidZiele.map(zielId => ({
              kampagne_id: kampagneId,
              ziel_id: zielId
            }));
            await window.supabase.from('kampagne_paid_ziele').insert(paidZieleRows);
            console.log('✅ Paid-Ziele Zuordnungen gespeichert:', paidZieleRows.length);
          }
          
          // Organic-Ziele Zuordnungen
          const organicZiele = uniq(toArray(submitData.organic_ziele_ids));
          if (organicZiele.length > 0) {
            const organicZieleRows = organicZiele.map(zielId => ({
              kampagne_id: kampagneId,
              ziel_id: zielId
            }));
            await window.supabase.from('kampagne_organic_ziele').insert(organicZieleRows);
            console.log('✅ Organic-Ziele Zuordnungen gespeichert:', organicZieleRows.length);
          }
        } catch (e) {
          console.warn('⚠️ Many-to-Many Zuordnungen konnten nicht gespeichert werden', e);
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
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedKampagnen.size;
    if (selectedCount === 0) {
      alert('Keine Kampagnen ausgewählt.');
      return;
    }

    const message = selectedCount === 1
      ? 'Möchten Sie die ausgewählte Kampagne wirklich löschen?'
      : `Möchten Sie die ${selectedCount} ausgewählten Kampagnen wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Löschvorgang bestätigen',
        message: `${message}`,
        confirmText: 'Endgültig löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (res?.confirmed) {
        this.deleteSelectedKampagnen();
      }
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedKampagnen();
    }
  }

  // Ausgewählte Kampagnen löschen
  async deleteSelectedKampagnen() {
    if (window.currentUser?.rolle !== 'admin' && window.currentUser?.rolle?.toLowerCase() !== 'admin') return;

    const selectedIds = Array.from(this.selectedKampagnen);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Kampagnen...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('kampagne', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Kampagnen erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('#kampagnen-table-body');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kampagne', action: 'bulk-deleted', count: result.deletedCount }
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
        entityType: 'ansprechpartner'
      }));

    return avatarBubbles.renderBubbles(items);
  }

  // Render Unternehmen
  renderUnternehmen(unternehmen) {
    if (!unternehmen || !unternehmen.firmenname) {
      return '-';
    }

    console.log('🏢 Render Unternehmen:', unternehmen.firmenname, 'Logo URL:', unternehmen.logo_url);

    const items = [{
      name: unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen',
      logo_url: unternehmen.logo_url || null
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Render Marke
  renderMarke(marke) {
    if (!marke || !marke.markenname) {
      return '-';
    }

    console.log('🏷️ Render Marke:', marke.markenname, 'Logo URL:', marke.logo_url);

    const items = [{
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Render Art der Kampagne als Tags
  renderArtTags(artArray) {
    if (!artArray || artArray.length === 0) {
      return '-';
    }

    const arr = Array.isArray(artArray) ? artArray : [artArray];
    const inner = arr.map(art => {
      return `<span class="tag tag--type">${window.validatorSystem?.sanitizeHtml(art) || art}</span>`;
    }).join('');
    return `<div class="tags tags-compact">${inner}</div>`;
  }

  // Render Status als Tag mit Icon
  renderStatusBadge(statusName) {
    if (!statusName) {
      return '-';
    }
    const icon = actionsDropdown.getStatusIcon(statusName);
    return `<div class="tags tags-compact"><span class="tag tag--type">${icon || ''}${window.validatorSystem?.sanitizeHtml(statusName) || statusName}</span></div>`;
  }

  // Render Mitarbeiter (Avatar-Bubbles mit Klickbarkeit)
  renderMitarbeiter(users) {
    if (!users || users.length === 0) {
      return '-';
    }
    
    console.log('🔍 KampagneList renderMitarbeiter:', users); // Debug
    
    const items = users
      .filter(u => u && (u.name || u.email))
      .map(u => ({
        name: u.name || u.email,
        type: 'person',
        id: u.id,
        entityType: 'mitarbeiter',
        profile_image_url: u.profile_image_url
      }));
    
    console.log('🔍 KampagneList mitarbeiter items:', items); // Debug
    
    return avatarBubbles.renderBubbles(items);
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneList = new KampagneList(); 