// AuftragsdetailsList.js (ES6-Modul)
// Auftragsdetails-Liste mit Filter, Verwaltung und Pagination

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderAuftragAmpel } from './logic/AuftragStatusUtils.js';
import { resolveEmptyState } from '../../core/components/EmptyState.js';
import { replaceRoute } from '../../core/breadcrumbTrail.js';
import {
  parseFolderQuery,
  folderListUrl,
  folderCrumbs,
  withFolderQuery,
  markenEbeneEntfaelltAusOrdnern,
  NUR_UNTERNEHMEN_LABEL
} from '../../core/folderListNav.js';
import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCurrentItems
} from './AuftragsdetailsFolders.js';
import {
  viewToggleHtml,
  tableActionsHtml,
  tableHtml,
  renderCompaniesView,
  updateCompaniesGrid,
  renderBrandsView,
  updateBrandsGrid,
  renderItemsView
} from './AuftragsdetailsFolderRenderer.js';

const BASE_PATH = '/auftragsdetails';
const GRID_BATCH_SIZE = 1000;

export class AuftragsdetailsList {
  constructor() {
    this.selectedDetails = new Set();

    // Ansicht: 'grid' (Ordner Unternehmen → Marke → Tabelle) oder 'list' (flache Tabelle)
    this.listViewMode = 'grid';
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this._allDetails = null;
    this.companyFolders = [];
    this.brandFolders = [];
    this.currentItems = [];
    this._boundEventListeners = new Set();
    this.boundFilterResetHandler = null;
    this.pagination = new PaginationSystem();
    this.searchQuery = '';
    this._searchDebounceTimer = null;
    this._eventsBound = false;
    this._shellRendered = false;
    this._reloadTimer = null;
    this._loadRequestId = 0;
    this._isKunde = null;
    this._isMitarbeiter = null;
  }

  get isKunde() {
    if (this._isKunde === null) {
      this._isKunde = window.isKunde();
    }
    return this._isKunde;
  }

  get isMitarbeiter() {
    if (this._isMitarbeiter === null) {
      this._isMitarbeiter = window.isMitarbeiter();
    }
    return this._isMitarbeiter;
  }

  // Initialisiere Auftragsdetails-Liste
  async init() {
    console.log('📋 AUFTRAGSDETAILSLIST: Initialisiere Auftragsdetails-Liste');
    this._shellRendered = false;
    this._allDetails = null;
    this.applyQueryParams(new URLSearchParams(window.location.search));
    
    // Pagination initialisieren mit dynamicResize für animiertes Entfernen
    this.pagination.init('pagination-auftragsdetails', {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });
    
    try {
      // BulkActionSystem für Auftragsdetails registrieren
      window.bulkActionSystem?.registerList('auftragsdetails', this);
      
      await this.loadAndRender();
      console.log('✅ AUFTRAGSDETAILSLIST: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSLIST: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsList.init');
    }
  }

  // Lade und rendere Auftragsdetails
  async loadAndRender() {
    const requestId = ++this._loadRequestId;
    console.log('🔄 AUFTRAGSDETAILSLIST: Lade und rendere Auftragsdetails');
    
    try {
      if (this.listViewMode === 'grid') {
        await this.loadAndRenderGrid(requestId);
        return;
      }

      if (!this._shellRendered) {
        await this.render();
        await this.initializeFilterBar();
        this.bindEvents();
        this.bindSearch();
        this.updateBreadcrumbDisplay();
        this.syncListUrl();
        console.log('✅ AUFTRAGSDETAILSLIST: Shell gerendert');
      }
      
      // Auftragsdetails mit Beziehungen und Pagination laden
      console.log('🔍 AUFTRAGSDETAILSLIST: Lade Auftragsdetails mit Beziehungen und Pagination');
      const filters = filterSystem.getFilters('auftragsdetails');
      const { data: details, count } = await this.loadDetailsWithPagination(
        filters,
        this.pagination.currentPage,
        this.pagination.itemsPerPage
      );
      if (requestId !== this._loadRequestId) return;
      
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
    if (this.isItemsPageLocal()) {
      this.updateItemsPage();
      return;
    }
    this.loadAndRender();
  }

  // Handler für Items-Per-Page-Wechsel
  handleItemsPerPageChange(limit, page) {
    console.log(`📄 AUFTRAGSDETAILSLIST: Items pro Seite geändert auf ${limit}, Seite ${page}`);
    if (this.isItemsPageLocal()) {
      this.updateItemsPage();
      return;
    }
    this.loadAndRender();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GRID: Unternehmen → Marke → Items
  // ══════════════════════════════════════════════════════════════════════════

  // Im Grid liegen alle Zeilen im Speicher, Seitenwechsel schneiden clientseitig
  isItemsPageLocal() {
    return this.listViewMode === 'grid' && this.viewMode === 'items' && Array.isArray(this._allDetails);
  }

  sanitize(value) {
    return window.validatorSystem?.sanitizeHtml(value) || value || '';
  }

  applyQueryParams(params) {
    const folder = parseFolderQuery(params);
    this.currentUnternehmenId = folder.unternehmenId;
    this.currentUnternehmenName = folder.unternehmenName;
    this.currentMarkeId = folder.markeId;
    this.currentMarkeName = folder.markeName;
    this._ohneMarke = folder.ohneMarke;
    this.viewMode = folder.viewMode;
  }

  currentFolder() {
    return {
      unternehmenId: this.currentUnternehmenId,
      unternehmenName: this.currentUnternehmenName,
      markeId: this.currentMarkeId,
      markeName: this.currentMarkeName,
      ohneMarke: this._ohneMarke
    };
  }

  listUrl(viewMode = this.viewMode) {
    return folderListUrl(BASE_PATH, this.currentFolder(), viewMode);
  }

  syncListUrl() {
    const url = this.listViewMode === 'list' ? BASE_PATH : this.listUrl();
    replaceRoute(url);
  }

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;

    if (this.listViewMode === 'list' || this.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftragsdetails', url: BASE_PATH, clickable: false }
      ]);
      return;
    }

    window.breadcrumbSystem.updateBreadcrumb(folderCrumbs({
      listLabel: 'Auftragsdetails',
      basePath: BASE_PATH,
      folder: this.currentFolder(),
      markenEbeneWeg: this.markenEbeneWeg()
    }));
  }

  async ensureAllDetails() {
    if (this._allDetails) return this._allDetails;
    const filters = filterSystem.getFilters('auftragsdetails');
    const { data } = await this.loadDetailsWithPagination(filters, 1, GRID_BATCH_SIZE, { all: true });
    this._allDetails = data || [];
    return this._allDetails;
  }

  buildCurrentFolders() {
    const details = this._allDetails || [];
    if (this.viewMode === 'companies') {
      this.companyFolders = buildCompanyFolders(details);
      return;
    }
    if (this.viewMode === 'brands') {
      this.brandFolders = buildBrandFolders(details, this.currentUnternehmenId);
      return;
    }
    this.currentItems = buildCurrentItems(details, {
      unternehmenId: this.currentUnternehmenId,
      markeId: this.currentMarkeId,
      ohneMarke: this._ohneMarke
    });
  }

  // Keine echte Marke im Unternehmen: „Nur Unternehmen“ ist keine eigene Ebene
  markenEbeneWeg() {
    if (!this._ohneMarke || !this.currentUnternehmenId) return false;
    return markenEbeneEntfaelltAusOrdnern(
      buildBrandFolders(this._allDetails || [], this.currentUnternehmenId)
    );
  }

  applyMarkenEbeneSprung() {
    if (this.viewMode !== 'brands' || !this.currentUnternehmenId) return;
    const folders = buildBrandFolders(this._allDetails || [], this.currentUnternehmenId);
    if (!markenEbeneEntfaelltAusOrdnern(folders)) return;
    this.viewMode = 'items';
    this._ohneMarke = true;
    this.currentMarkeId = null;
    this.currentMarkeName = NUR_UNTERNEHMEN_LABEL;
    this.pagination.currentPage = 1;
    this.buildCurrentFolders();
  }

  async loadAndRenderGrid(requestId) {
    this._shellRendered = false;
    this.bindEvents();
    await this.ensureAllDetails();
    if (requestId !== this._loadRequestId) return;

    this.buildCurrentFolders();
    this.applyMarkenEbeneSprung();
    this.renderFolderView();

    if (this.viewMode === 'items') {
      await this.updateItemsPage();
    }
  }

  renderFolderView() {
    this._shellRendered = false;
    this.updateBreadcrumbDisplay();
    this.syncListUrl();

    let html = '';
    if (this.viewMode === 'companies') html = renderCompaniesView(this);
    else if (this.viewMode === 'brands') html = renderBrandsView(this);
    else html = renderItemsView(this);

    window.setContentSafely(window.content, html);

    if (this.viewMode === 'companies') updateCompaniesGrid(this);
    else if (this.viewMode === 'brands') updateBrandsGrid(this);
  }

  async updateItemsPage() {
    const { currentPage, itemsPerPage } = this.pagination.getState();
    const start = (currentPage - 1) * itemsPerPage;
    const pageItems = this.currentItems.slice(start, start + itemsPerPage);

    this.pagination.updateTotal(this.currentItems.length);
    await this.updateTable(pageItems);
    this.pagination.render();
  }

  switchToCompaniesView() {
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.loadAndRender();
  }

  switchToBrandsView(unternehmenId, unternehmenName) {
    this.viewMode = 'brands';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.loadAndRender();
  }

  switchToItemsView(markeId, markeName, { ohneMarke = false } = {}) {
    this.viewMode = 'items';
    this.currentMarkeId = ohneMarke ? null : markeId;
    this.currentMarkeName = markeName;
    this._ohneMarke = ohneMarke;
    this.pagination.currentPage = 1;
    this.loadAndRender();
  }

  backFromItems() {
    if (this.markenEbeneWeg()) this.switchToCompaniesView();
    else this.switchToBrandsView(this.currentUnternehmenId, this.currentUnternehmenName);
  }

  setListViewMode(mode) {
    if (this.listViewMode === mode && (mode === 'list' || this.viewMode === 'companies')) return;
    this.listViewMode = mode;
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this._allDetails = null;
    this._shellRendered = false;
    this.selectedDetails.clear();
    this.pagination.currentPage = 1;
    this.loadAndRender();
  }

  // Rendere Auftragsdetails-Liste
  async render() {
    window.setHeadline('Auftragsdetails');
    
    const html = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${viewToggleHtml(this.listViewMode)}
            ${SearchInput.render('auftragsdetails', { 
              placeholder: 'Auftragsdetails suchen...', 
              currentValue: this.searchQuery 
            })}
            ${!this.isKunde ? '<div id="filter-dropdown-container"></div>' : ''}
          </div>
        </div>
        ${tableActionsHtml(this)}
      </div>

      <!-- Daten-Tabelle -->
      ${tableHtml(this)}
    `;

    window.setContentSafely(window.content, html);
    this._shellRendered = true;
  }

  // Lade Auftragsdetails mit Beziehungen und Pagination
  // options.all: Grid-Modus, lädt alle sichtbaren Zeilen in Batches, ohne Suche/Pagination
  async loadDetailsWithPagination(filters = {}, page = 1, limit = 25, options = {}) {
    const loadAll = options.all === true;
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        const mockData = await window.dataService.loadEntities('auftrag_details');
        return { data: mockData, count: mockData.length };
      }

      // Sichtbarkeit: Nicht-Admins sehen nur zugewiesene Aufträge
      const isAdmin = window.isAdmin() || window.isUnscoped?.();
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
          const unternehmenOhneExpliziteMarken = unternehmenIds.filter(
            unternehmenId => !unternehmenMarkenMap.has(unternehmenId)
          );

          if (unternehmenOhneExpliziteMarken.length > 0) {
            const { data: alleMarkenFuerUnternehmen } = await window.supabase
              .from('marke')
              .select('id, unternehmen_id')
              .in('unternehmen_id', unternehmenOhneExpliziteMarken);

            (alleMarkenFuerUnternehmen || []).forEach(marke => {
              if (!unternehmenMarkenMap.has(marke.unternehmen_id)) {
                unternehmenMarkenMap.set(marke.unternehmen_id, []);
              }
              unternehmenMarkenMap.get(marke.unternehmen_id).push(marke.id);
            });
          }

          unternehmenIds.forEach(unternehmenId => {
            const markenIdsForUnternehmen = unternehmenMarkenMap.get(unternehmenId) || [];
            allowedMarkenIds.push(...markenIdsForUnternehmen);
          });
          
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

      const buildAndRunQuery = async (rangeFrom = from, rangeTo = to, forceRange = false) => {
        const auftragFields = [
          'id',
          'auftragsname',
          'status',
          'po',
          'externe_po',
          'start',
          'ende',
          'unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url)',
          'marke:marke_id(id, markenname, logo_url)'
        ].join(',\n            ');

        let query = window.supabase
          .from('auftrag_details')
          .select(`
            *,
            auftrag:auftrag_id(
              ${auftragFields}
            ),
            created_by:created_by_id(id, name, profile_image_url)
          `, { count: 'estimated' });
        
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

        // Sortierung
        query = query.order('created_at', { ascending: false });

        // Nur ohne Suchbegriff serverseitig paginieren
        if (forceRange || !this.searchQuery) {
          query = query.range(rangeFrom, rangeTo);
        }

        return query;
      };

      // Grid: alle sichtbaren Zeilen in Batches laden (Supabase kappt bei 1000)
      if (loadAll) {
        const rows = [];
        for (let offset = 0; ; offset += GRID_BATCH_SIZE) {
          const { data: batch, error: batchError } = await buildAndRunQuery(
            offset,
            offset + GRID_BATCH_SIZE - 1,
            true
          );
          if (batchError) {
            console.error('❌ Fehler beim Laden der Auftragsdetails (Grid):', batchError);
            throw batchError;
          }
          rows.push(...(batch || []));
          if (!batch || batch.length < GRID_BATCH_SIZE) break;
        }
        return { data: rows, count: rows.length };
      }

      const { data, error, count } = await buildAndRunQuery();

      if (error) {
        console.error('❌ Fehler beim Laden der Auftragsdetails mit Beziehungen:', error);
        throw error;
      }

      console.log('✅ Auftragsdetails mit Beziehungen und Pagination geladen:', data);

      // Client-seitige Suche (Relations-Felder können nicht serverseitig per ilike gefiltert werden)
      let filteredData = data || [];
      if (this.searchQuery) {
        const search = this.searchQuery.toLowerCase();
        filteredData = filteredData.filter(d => {
          const auftrag = d.auftrag;
          return (auftrag?.auftragsname?.toLowerCase().includes(search)) ||
                 (auftrag?.unternehmen?.firmenname?.toLowerCase().includes(search)) ||
                 (auftrag?.marke?.markenname?.toLowerCase().includes(search)) ||
                 (auftrag?.po?.toLowerCase().includes(search)) ||
                 (auftrag?.externe_po?.toLowerCase().includes(search));
        });
      }

      if (this.searchQuery) {
        const paginated = filteredData.slice(from, to + 1);
        return { data: paginated, count: filteredData.length };
      }

      return { data: filteredData, count: count || 0 };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Auftragsdetails mit Beziehungen:', error);
      throw error;
    }
  }

  // Initialisiere Filterbar
  async initializeFilterBar() {
    if (this.isKunde) return;
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

    this.scheduleReload();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 AUFTRAGSDETAILSLIST: Filter zurückgesetzt');
    filterSystem.resetFilters('auftragsdetails');
    
    // Pagination auf Seite 1 zurücksetzen
    this.pagination.reset();

    this.scheduleReload();
  }

  // Suche mit Debounce
  handleSearch(query) {
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();
      this.pagination.reset();
      this.scheduleReload(0);
    }, 300);
  }

  // Suchfeld sitzt in der Listen-Shell und wird bei jedem Shell-Render neu gebunden
  bindSearch() {
    SearchInput.bind('auftragsdetails', (value) => this.handleSearch(value));
  }

  // Binde Events
  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Ansicht-Toggle, Ordnerkarten und Zurück-Buttons
    this.addManagedListener(document, 'click', (e) => {
      if (e.target.closest('#btn-view-list')) {
        e.preventDefault();
        this.setListViewMode('list');
        return;
      }
      if (e.target.closest('#btn-view-grid')) {
        e.preventDefault();
        this.setListViewMode('grid');
        return;
      }
      if (e.target.closest('#btn-back-to-companies')) {
        e.preventDefault();
        this.switchToCompaniesView();
        return;
      }
      if (e.target.closest('#btn-back-to-brands')) {
        e.preventDefault();
        this.backFromItems();
        return;
      }

      const companyCard = e.target.closest('#companies-grid .folder-card');
      if (companyCard) {
        this.switchToBrandsView(companyCard.dataset.unternehmenId, companyCard.dataset.unternehmenName);
        return;
      }

      const brandCard = e.target.closest('#brands-grid .folder-card');
      if (brandCard) {
        if (brandCard.dataset.ohneMarke === '1') {
          this.switchToItemsView(null, brandCard.dataset.markeName, { ohneMarke: true });
        } else {
          this.switchToItemsView(brandCard.dataset.markeId, brandCard.dataset.markeName);
        }
      }
    });

    // Neuen Auftragsdetails anlegen Button
    this.addManagedListener(document, 'click', (e) => {
      if (e.target.id === 'btn-auftragsdetails-new' || e.target.closest('#btn-auftragsdetails-new')) {
        e.preventDefault();
        window.navigateTo('/projekt-erstellen');
      }
      // Empty-State-Action "Filter zurücksetzen"
      if (e.target.closest('[data-empty-action="reset-filters"]')) {
        e.preventDefault();
        this.onFiltersReset();
      }
    });

    // Alle auswählen Button
    this.addManagedListener(document, 'click', (e) => {
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
    this.addManagedListener(document, 'click', (e) => {
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
    this.addManagedListener(document, 'click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftragsdetails') {
        e.preventDefault();
        const detailsId = e.target.dataset.id;
        console.log('🎯 AUFTRAGSDETAILSLIST: Navigiere zu Auftragsdetails Details:', detailsId);
        window.navigateTo(withFolderQuery(`${BASE_PATH}/${detailsId}`));
      }
    });

    // Entity Updated Event
    this.addManagedListener(window, 'entityUpdated', (e) => {
      if (e.detail.entity === 'auftragsdetails' || e.detail.entity === 'auftrag_details') {
        this._allDetails = null;
        this.scheduleReload();
      }
    });

    // Filter-Tag X-Buttons
    this.addManagedListener(document, 'click', (e) => {
      if (e.target.classList.contains('tag-x')) {
        e.preventDefault();
        e.stopPropagation();
        
        const tagElement = e.target.closest('.filter-tag');
        const key = tagElement.dataset.key;
        
        // Entferne Filter
        const currentFilters = window.filterSystem.getFilters('auftragsdetails');
        delete currentFilters[key];
        window.filterSystem.applyFilters('auftragsdetails', currentFilters);
        this.scheduleReload();
      }
    });

    // Select-All Checkbox
    this.addManagedListener(document, 'change', (e) => {
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
    this.addManagedListener(document, 'change', (e) => {
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
    if (!window.canBulkDelete()) return;
    
    const selectedIds = Array.from(this.selectedDetails);
    if (selectedIds.length === 0) {
      window.toastSystem?.warning('Keine Auftragsdetails ausgewählt.');
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
        
        const successMsg = result.deletedCount === 1
          ? 'Auftragsdetail erfolgreich gelöscht.'
          : `${result.deletedCount} Auftragsdetails erfolgreich gelöscht.`;
        window.toastSystem?.success(successMsg);
        
        this.selectedDetails.clear();
        this.updateSelection();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          this._allDetails = null;
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
      window.toastSystem?.error(`Fehler beim Löschen: ${error.message}`);
      
      // Liste neu laden um konsistenten Zustand herzustellen
      this._allDetails = null;
      await this.loadAndRender();
    }
  }

  // Update Tabelle mit Fade-Animation
  async updateTable(details) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const isAdmin = window.isAdmin();
    const canBulkDelete = window.canBulkDelete();
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!details || details.length === 0) {
        const filters = filterSystem.getFilters('auftragsdetails') || {};
        const hasActiveFilters = Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : v !== ''))
          || (this.searchQuery || '').trim().length > 0;
        const html = resolveEmptyState({
          hasActiveFilters,
          states: {
            default: {
              icon: 'document',
              title: 'Keine Auftragsdetails vorhanden',
              text: 'Es wurden noch keine Auftragsdetails erstellt.',
              actionsHtml: this.isKunde
                ? ''
                : '<button id="btn-auftragsdetails-new" class="mdc-btn">Erste Auftragsdetails anlegen</button>'
            }
          }
        }, 'default');
        tbody.innerHTML = `<tr><td colspan="${this.isKunde ? '8' : canBulkDelete ? '11' : '10'}" class="empty-state-cell">${html}</td></tr>`;
        return;
      }

      tbody.innerHTML = details.map(detail => {
        const auftrag = detail.auftrag || {};
        
        // Unternehmen Bubble
        const unternehmenHtml = auftrag.unternehmen
          ? avatarBubbles.renderBubbles([{
              name: auftrag.unternehmen.firmenname,
              label: auftrag.unternehmen.internes_kuerzel || auftrag.unternehmen.firmenname,
              type: 'org',
              id: auftrag.unternehmen.id,
              entityType: 'unternehmen',
              logo_url: auftrag.unternehmen.logo_url || null
            }], { showLabel: true })
          : '-';

        // Marke Bubble
        const markeHtml = auftrag.marke
          ? avatarBubbles.renderBubbles([{
              name: auftrag.marke.markenname,
              type: 'org',
              id: auftrag.marke.id,
              entityType: 'marke',
              logo_url: auftrag.marke.logo_url || null
            }], { showLabel: true })
          : '-';
        
        return `
          <tr data-id="${detail.id}">
            ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="auftragsdetails-check" data-id="${detail.id}"></td>` : ''}
            <td class="col-ad-auftrag">
              <a href="#" class="table-link" data-table="auftragsdetails" data-id="${detail.id}">
                ${window.validatorSystem?.sanitizeHtml(auftrag.auftragsname || 'Unbekannter Auftrag') || 'Unbekannter Auftrag'}
              </a>
            </td>
            <td class="col-ad-unternehmen">${unternehmenHtml}</td>
            <td class="col-ad-marke">${markeHtml}</td>
            <td>${window.validatorSystem?.sanitizeHtml(this.isKunde ? auftrag.externe_po : auftrag.po) || (this.isKunde ? auftrag.externe_po : auftrag.po) || '-'}</td>
            <td>${renderAuftragAmpel(auftrag.status)}</td>
            <td>${formatDate(auftrag.start)}</td>
            <td>${formatDate(auftrag.ende)}</td>
            <td>${formatDate(detail.created_at)}</td>
            ${!this.isKunde ? `<td class="col-erstellt-von">${this.renderCreatedBy(detail.created_by)}</td>` : ''}
            ${!this.isKunde ? `<td class="col-actions">${actionBuilder.create('auftragsdetails', detail.id)}</td>` : ''}
          </tr>
        `;
      }).join('');
    });
  }

  renderCreatedBy(user) {
    if (!user || !user.name) return '-';
    const items = [{
      name: user.name,
      type: 'person',
      id: user.id,
      entityType: 'mitarbeiter',
      profile_image_url: user.profile_image_url
    }];
    return avatarBubbles.renderBubbles(items);
  }

  // Cleanup
  destroy() {
    console.log('AuftragsdetailsList: Cleaning up...');
    this._shellRendered = false;
    this._allDetails = null;
    
    // Pagination cleanup
    if (this.pagination) {
      this.pagination.destroy();
    }
    
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    this._eventsBound = false;
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
    if (this._reloadTimer) {
      clearTimeout(this._reloadTimer);
      this._reloadTimer = null;
    }
    
    // Event-Listener entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }

  addManagedListener(element, type, handler) {
    element.addEventListener(type, handler);
    this._boundEventListeners.add({ element, type, handler });
  }

  scheduleReload(delayMs = 100) {
    if (this._reloadTimer) clearTimeout(this._reloadTimer);
    this._reloadTimer = setTimeout(() => {
      this.loadAndRender();
      this._reloadTimer = null;
    }, delayMs);
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    window.navigateTo('/projekt-erstellen');
  }
}

const auftragsdetailsListInstance = new AuftragsdetailsList();
export { auftragsdetailsListInstance as auftragsdetailsList };

