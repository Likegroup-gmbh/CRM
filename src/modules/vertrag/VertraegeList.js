// VertraegeList.js (ES6-Modul)
// Verträge-Übersichtsseite mit Unternehmens-Ordnern
// Phase 1: Ordner-Ansicht (Unternehmen alphabetisch)
// Phase 2: Verträge-Liste pro Unternehmen (wie Strategie-Layout)

import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { modularFilterSystem } from '../../core/filters/ModularFilterSystem.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class VertraegeList {
  constructor() {
    this.vertraege = [];
    this.unternehmenFolders = [];
    this.selectedVertraege = new Set();
    this.pagination = new PaginationSystem();
    this._boundEventListeners = new Set();
    
    // Ansichtsmodus: 'folders' oder 'vertraege'
    this.viewMode = 'folders';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    
    // NEU: Haupt-Ansichtsmodus (Liste vs Grid/Ordner)
    this.listViewMode = 'grid'; // 'grid' (Ordner) oder 'list' (Tabelle)
  }

  // Initialisiere Verträge-Liste
  async init(unternehmenId = null) {
    // Prüfe ob ein Unternehmen direkt angesteuert wird
    if (unternehmenId) {
      this.viewMode = 'vertraege';
      this.currentUnternehmenId = unternehmenId;
      // Unternehmensnamen laden
      await this.loadUnternehmenName(unternehmenId);
    } else {
      this.viewMode = 'folders';
      this.currentUnternehmenId = null;
      this.currentUnternehmenName = null;
    }

    window.setHeadline('Verträge');
    
    // Breadcrumb
    this.updateBreadcrumb();
    
    // Berechtigungsprüfung
    const canView = window.currentUser?.rolle === 'admin' || 
                    window.currentUser?.rolle === 'mitarbeiter';
    
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Verträge anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Pagination initialisieren - Container wird je nach Ansicht gewählt
    const paginationContainer = this.viewMode === 'vertraege' 
      ? 'pagination-vertraege' 
      : 'pagination-vertraege-all';
    
    this.pagination.init(paginationContainer, {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: () => this.loadAndRender(),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    await this.loadAndRender();
  }

  // Unternehmensnamen laden
  async loadUnternehmenName(unternehmenId) {
    try {
      const { data, error } = await window.supabase
        .from('unternehmen')
        .select('firmenname')
        .eq('id', unternehmenId)
        .single();
      
      if (!error && data) {
        this.currentUnternehmenName = data.firmenname;
      }
    } catch (err) {
      console.warn('Unternehmensnamen konnte nicht geladen werden:', err);
    }
  }

  // Breadcrumb aktualisieren
  updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;

    if (this.viewMode === 'folders') {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Verträge', url: '/vertraege', clickable: false }
      ]);
    } else {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Verträge', url: '/vertraege', clickable: true },
        { label: this.currentUnternehmenName || 'Unternehmen', url: `/vertraege?unternehmen=${this.currentUnternehmenId}`, clickable: false }
      ]);
    }
  }

  // Seitenwechsel Handler
  handlePageChange(page) {
    this.reloadData();
  }

  // Nur Daten neu laden (ohne HTML neu zu rendern)
  async reloadData() {
    try {
      if (this.viewMode === 'folders') {
        // Beide Ansichten (Grid/Liste) zeigen Unternehmen
        await this.loadUnternehmenFolders();
        if (this.listViewMode === 'grid') {
          this.updateFoldersView();
        } else {
          this.updateUnternehmenListTable();
        }
      } else {
        const vertraege = await this.loadVertraege();
        this.updateVertraegeTable(vertraege);
      }
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VertraegeList.reloadData');
      console.error('❌ Fehler beim Laden:', error);
    }
  }

  // Lade und rendere (initiales Laden)
  async loadAndRender() {
    try {
      // Rendere die Seite-Struktur (ersetzt HTML komplett)
      await this.render();
      
      // NACH render(): Overlay auf das NEUE tbody setzen
      const tbody = document.querySelector('.data-table tbody');
      TableAnimationHelper.showLoadingOverlay(tbody);
      
      // Pagination neu initialisieren mit korrektem Container
      const paginationContainer = this.viewMode === 'vertraege' 
        ? 'pagination-vertraege' 
        : 'pagination-vertraege-all';
      
      this.pagination.init(paginationContainer, {
        itemsPerPage: 25,
        onPageChange: (page) => this.handlePageChange(page),
        onItemsPerPageChange: () => this.loadAndRender()
      });
      
      this.bindEvents();
      
      if (this.viewMode === 'folders') {
        // Haupt-Ansicht: Grid (Ordner-Karten) oder Liste (Tabelle) - beides zeigt Unternehmen
        await this.loadUnternehmenFolders();
        if (this.listViewMode === 'grid') {
          this.updateFoldersView();
        } else {
          this.updateUnternehmenListTable();
        }
        // Kein animatedUpdate hier, Overlay manuell entfernen
        TableAnimationHelper.hideLoadingOverlay(tbody);
      } else {
        // Unternehmens-Detailansicht
        await this.initializeFilterBar();
        const vertraege = await this.loadVertraege();
        this.updateVertraegeTable(vertraege);
        // Loading-Overlay entfernen
        TableAnimationHelper.hideLoadingOverlay(tbody);
      }
      
    } catch (error) {
      // Loading-Overlay bei Fehler ausblenden
      const tbodyError = document.querySelector('.data-table tbody');
      TableAnimationHelper.hideLoadingOverlay(tbodyError);
      window.ErrorHandler?.handle(error, 'VertraegeList.loadAndRender');
      console.error('❌ Fehler beim Laden:', error);
    }
  }

  // ============================================
  // ORDNER-ANSICHT (Unternehmen)
  // ============================================

  // Lade Unternehmen mit Verträgen
  async loadUnternehmenFolders() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return [];
      }

      // Alle Verträge mit Unternehmensdaten laden, gruppiert nach Unternehmen
      const { data, error } = await window.supabase
        .from('vertraege')
        .select(`
          kunde_unternehmen_id,
          kunde:kunde_unternehmen_id (
            id,
            firmenname,
            logo_url
          )
        `)
        .not('kunde_unternehmen_id', 'is', null);

      if (error) throw error;

      // Gruppieren nach Unternehmen und Anzahl zählen
      const unternehmenMap = new Map();
      (data || []).forEach(v => {
        if (v.kunde?.id) {
          const existing = unternehmenMap.get(v.kunde.id);
          if (existing) {
            existing.count++;
          } else {
            unternehmenMap.set(v.kunde.id, {
              id: v.kunde.id,
              firmenname: v.kunde.firmenname,
              logo_url: v.kunde.logo_url,
              count: 1
            });
          }
        }
      });

      // In Array umwandeln und alphabetisch sortieren
      this.unternehmenFolders = Array.from(unternehmenMap.values())
        .sort((a, b) => (a.firmenname || '').localeCompare(b.firmenname || '', 'de'));

      return this.unternehmenFolders;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen:', error);
      return [];
    }
  }

  // Rendere Ordner-Ansicht (mit View-Toggle)
  renderFoldersView() {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const canEdit = isAdmin || window.currentUser?.rolle === 'mitarbeiter';

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              <div class="view-toggle">
                <button id="btn-view-list" class="secondary-btn ${this.listViewMode === 'list' ? 'active' : ''}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                  </svg>
                  Liste
                </button>
                <button id="btn-view-grid" class="secondary-btn ${this.listViewMode === 'grid' ? 'active' : ''}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                  Grid
                </button>
              </div>
            </div>
          </div>
          <div class="table-actions">
            ${canEdit ? '<button id="btn-vertrag-new" class="primary-btn">Neuen Vertrag anlegen</button>' : ''}
          </div>
        </div>

        <div class="table-container">
          ${this.listViewMode === 'grid' 
            ? `<div class="folders-grid" id="folders-grid">
                <div class="loading-placeholder">Lade Unternehmens-Ordner...</div>
              </div>`
            : this.renderUnternehmenListTable()
          }
        </div>
      </div>
    `;
  }

  // Rendere Tabelle für Unternehmen (Listen-Ansicht)
  renderUnternehmenListTable() {
    return `
      <table class="data-table vertraege-unternehmen-table">
        <thead>
          <tr>
            <th>Unternehmen</th>
            <th>Verträge</th>
          </tr>
        </thead>
        <tbody id="unternehmen-list-table-body">
          <tr>
            <td colspan="2" class="no-data">Lade Unternehmen...</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // Update Ordner-Ansicht
  updateFoldersView() {
    const grid = document.getElementById('folders-grid');
    if (!grid) return;

    if (!this.unternehmenFolders || this.unternehmenFolders.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--space-xxl);">
          <div class="empty-icon">📁</div>
          <h3>Keine Verträge vorhanden</h3>
          <p>Es wurden noch keine Verträge mit Unternehmen verknüpft.</p>
        </div>
      `;
      return;
    }

    const escapeHtml = (text) => {
      if (!text) return '';
      return window.validatorSystem?.sanitizeHtml(text) || text;
    };

    grid.innerHTML = this.unternehmenFolders.map(folder => `
      <div class="folder-card" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">
        <div class="folder-icon">
          ${folder.logo_url 
            ? `<img src="${escapeHtml(folder.logo_url)}" alt="${escapeHtml(folder.firmenname)}" class="folder-logo">`
            : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="folder-svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>`
          }
        </div>
        <div class="folder-info">
          <span class="folder-name">${escapeHtml(folder.firmenname)}</span>
          <span class="folder-count">${folder.count} ${folder.count === 1 ? 'Vertrag' : 'Verträge'}</span>
        </div>
      </div>
    `).join('');
  }

  // Update Unternehmen-Tabelle (Listen-Ansicht)
  updateUnternehmenListTable() {
    const tbody = document.getElementById('unternehmen-list-table-body');
    if (!tbody) return;

    if (!this.unternehmenFolders || this.unternehmenFolders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="2" class="no-data">
            <div class="empty-state">
              <div class="empty-icon">📁</div>
              <h3>Keine Verträge vorhanden</h3>
              <p>Es wurden noch keine Verträge mit Unternehmen verknüpft.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const escapeHtml = (text) => {
      if (!text) return '';
      return window.validatorSystem?.sanitizeHtml(text) || text;
    };

    tbody.innerHTML = this.unternehmenFolders.map(folder => `
      <tr class="table-row-clickable unternehmen-row" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">
        <td>
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            ${folder.logo_url 
              ? `<img src="${escapeHtml(folder.logo_url)}" alt="${escapeHtml(folder.firmenname)}" class="table-logo">`
              : ''
            }
            <a href="#" class="table-link unternehmen-link" data-unternehmen-id="${folder.id}" data-unternehmen-name="${escapeHtml(folder.firmenname)}">${escapeHtml(folder.firmenname)}</a>
          </div>
        </td>
        <td>${folder.count}</td>
      </tr>
    `).join('');

    // Row-Click Events für Unternehmen-Zeilen
    this.bindUnternehmenRowEvents();
  }

  // Bind click events für Unternehmen-Zeilen in Listen-Ansicht
  bindUnternehmenRowEvents() {
    const rows = document.querySelectorAll('.unternehmen-row');
    rows.forEach(row => {
      const handler = (e) => {
        // Verhindere Doppel-Navigation bei Link-Klick
        if (e.target.closest('.unternehmen-link')) {
          e.preventDefault();
        }
        const unternehmenId = row.dataset.unternehmenId;
        const unternehmenName = row.dataset.unternehmenName;
        if (unternehmenId) {
          this.switchToVertraegeView(unternehmenId, unternehmenName);
        }
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });
  }

  // ============================================
  // VERTRÄGE-ANSICHT (pro Unternehmen)
  // ============================================

  // Initialisiere Filter-Dropdown
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('vertrag', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    console.log('🔍 VertraegeList: Filter angewendet:', filters);
    modularFilterSystem.applyFilters('vertrag', filters);
    this.reloadData();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    console.log('🔄 VertraegeList: Filter zurückgesetzt');
    modularFilterSystem.resetFilters('vertrag');
    this.reloadData();
  }

  // Lade Verträge aus Datenbank (für aktuelles Unternehmen)
  async loadVertraege() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return [];
      }

      const { currentPage, itemsPerPage } = this.pagination.getState();
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Filter aus dem Filter-System holen
      const filters = modularFilterSystem.getFilters('vertrag');

      // Count-Query mit Filtern
      let countQuery = window.supabase
        .from('vertraege')
        .select('*', { count: 'exact', head: true })
        .eq('kunde_unternehmen_id', this.currentUnternehmenId);

      if (filters.typ) {
        countQuery = countQuery.eq('typ', filters.typ);
      }
      if (filters.kampagne_id) {
        countQuery = countQuery.eq('kampagne_id', filters.kampagne_id);
      }
      if (filters.creator_id) {
        countQuery = countQuery.eq('creator_id', filters.creator_id);
      }

      const { count } = await countQuery;

      // Hauptquery mit Filtern
      let query = window.supabase
        .from('vertraege')
        .select(`
          id,
          name,
          typ,
          is_draft,
          datei_url,
          datei_path,
          unterschriebener_vertrag_url,
          created_at,
          kunde_unternehmen_id,
          kampagne_id,
          creator_id,
          kunde:kunde_unternehmen_id (
            id,
            firmenname
          ),
          kampagne:kampagne_id (
            id,
            kampagnenname,
            eigener_name
          ),
          creator:creator_id (
            id,
            vorname,
            nachname
          )
        `)
        .eq('kunde_unternehmen_id', this.currentUnternehmenId);

      // Filter anwenden
      if (filters.typ) {
        query = query.eq('typ', filters.typ);
      }
      if (filters.kampagne_id) {
        query = query.eq('kampagne_id', filters.kampagne_id);
      }
      if (filters.creator_id) {
        query = query.eq('creator_id', filters.creator_id);
      }

      const { data: vertraege, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      this.pagination.updateTotal(count || 0);
      this.pagination.render();

      if (error) throw error;

      this.vertraege = vertraege || [];
      return this.vertraege;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Verträge:', error);
      return [];
    }
  }

  // Rendere Verträge-Ansicht (Strategie-ähnlich)
  renderVertraegeView() {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const canEdit = isAdmin || window.currentUser?.rolle === 'mitarbeiter';

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              <button id="btn-back-to-folders" class="secondary-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Zurück
              </button>
              <div id="filter-dropdown-container"></div>
            </div>
          </div>
          <div class="table-actions">
            ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
            <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
            <span id="selected-count" style="display:none;">0 ausgewählt</span>
            <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
            ${canEdit ? '<button id="btn-vertrag-new" class="primary-btn">Neuen Vertrag anlegen</button>' : ''}
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-vertraege"></th>` : ''}
                <th class="col-name">Name</th>
                <th>Status</th>
                <th>Typ</th>
                <th>Kampagne</th>
                <th>Creator</th>
                <th>Datei</th>
                <th>Unterschrieben</th>
                <th>Erstellt am</th>
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="vertraege-table-body">
              <tr>
                <td colspan="${isAdmin ? '10' : '9'}" class="no-data">Lade Verträge...</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="pagination-container" id="pagination-vertraege"></div>
      </div>
    `;
  }

  // Update Verträge-Tabelle
  updateVertraegeTable(vertraege) {
    const tbody = document.getElementById('vertraege-table-body');
    if (!tbody) return;

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    if (!vertraege || vertraege.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${isAdmin ? '10' : '9'}" class="no-data">
            <div class="empty-state">
              <div class="empty-icon">📄</div>
              <h3>Keine Verträge vorhanden</h3>
              <p>Für dieses Unternehmen wurden noch keine Verträge erstellt.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const formatDate = (date) => {
      return date ? new Date(date).toLocaleDateString('de-DE') : '-';
    };

    const escapeHtml = (text) => {
      if (!text) return '';
      return window.validatorSystem?.sanitizeHtml(text) || text;
    };

    tbody.innerHTML = vertraege.map(vertrag => {
      const creator = vertrag.creator || {};
      const kampagne = vertrag.kampagne || {};

      const creatorName = creator.vorname 
        ? `${escapeHtml(creator.vorname)} ${escapeHtml(creator.nachname || '')}`.trim()
        : '-';

      const typClass = vertrag.typ ? `typ-${vertrag.typ.toLowerCase().replace(/\s+/g, '-')}` : '';

      const dateiHtml = vertrag.datei_url 
        ? `<a href="${escapeHtml(vertrag.datei_url)}" target="_blank" class="datei-link datei-icon" title="PDF anzeigen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>`
        : '<span class="text-muted">—</span>';

      // Unterschriebener Vertrag Icon (externes Link-Icon, Bearbeiten im Aktionsmenü)
      const canEdit = isAdmin || window.currentUser?.rolle === 'mitarbeiter';
      const unterschriebenHtml = vertrag.unterschriebener_vertrag_url
        ? `<a href="${escapeHtml(vertrag.unterschriebener_vertrag_url)}" target="_blank" class="signed-link" title="Unterschriebenen Vertrag öffnen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>`
        : (canEdit 
          ? `<button class="btn-add-signed" data-id="${vertrag.id}" title="Link hinzufügen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>`
          : '<span class="text-muted">—</span>');

      const statusBadge = vertrag.is_draft
        ? '<span class="status-badge status-draft">Entwurf</span>'
        : '<span class="status-badge status-final">Finalisiert</span>';

      const actionsHtml = this.renderVertragActions(vertrag, isAdmin);

      return `
        <tr class="table-row-clickable" data-vertrag-id="${vertrag.id}">
          ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="vertraege-check" data-id="${vertrag.id}"></td>` : ''}
          <td class="col-name">
            <a href="#" class="table-link" data-table="vertrag" data-id="${vertrag.id}">
              ${escapeHtml(vertrag.name) || '—'}
            </a>
          </td>
          <td>${statusBadge}</td>
          <td>
            ${vertrag.typ 
              ? `<span class="status-badge ${typClass}">${escapeHtml(vertrag.typ)}</span>`
              : '-'}
          </td>
          <td>
            ${kampagne.id ? `
              <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
                ${escapeHtml(KampagneUtils.getDisplayName(kampagne))}
              </a>
            ` : '-'}
          </td>
          <td>
            ${creator.id ? `
              <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
                ${creatorName}
              </a>
            ` : '-'}
          </td>
          <td>${dateiHtml}</td>
          <td class="col-signed">${unterschriebenHtml}</td>
          <td>${formatDate(vertrag.created_at)}</td>
          <td class="col-actions">
            ${actionsHtml}
          </td>
        </tr>
      `;
    }).join('');

    // Actions Dropdown initialisieren
    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }

    // Signed Contract Event Handlers binden
    this.bindSignedContractEvents();
  }

  // Rendere Aktionen basierend auf Draft-Status
  renderVertragActions(vertrag, isAdmin) {
    const isDraft = vertrag.is_draft;
    
    // HTML-Escape-Funktion für URLs mit Sonderzeichen
    const escapeAttr = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
    
    let actions = '';
    
    // Icon für unterschriebenen Vertrag (Link-Icon)
    const signedIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>`;

    // Unterschriebener Vertrag Aktion (hinzufügen oder bearbeiten)
    const signedAction = vertrag.unterschriebener_vertrag_url
      ? `<a href="#" class="action-item" data-action="edit-signed" data-id="${vertrag.id}" data-url="${escapeAttr(vertrag.unterschriebener_vertrag_url)}">
          ${signedIcon}
          Unterschriebenen Vertrag bearbeiten
        </a>`
      : `<a href="#" class="action-item" data-action="add-signed" data-id="${vertrag.id}">
          ${signedIcon}
          Unterschriebenen Vertrag verlinken
        </a>`;

    if (isDraft) {
      actions = `
        <a href="#" class="action-item" data-action="continue" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
          Weiter bearbeiten
        </a>
        <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('view') || ''}
          Details anzeigen
        </a>
        ${signedAction}
      `;
    } else {
      actions = `
        <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('view') || ''}
          Details anzeigen
        </a>
        <a href="#" class="action-item" data-action="edit" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
          Bearbeiten
        </a>
        ${vertrag.datei_url ? `
          <a href="#" class="action-item" data-action="download" data-id="${vertrag.id}">
            ${window.ActionsDropdown?.getHeroIcon('download') || ''}
            PDF herunterladen
          </a>
        ` : ''}
        ${signedAction}
      `;
    }
    
    if (isAdmin) {
      actions += `
        <div class="action-separator"></div>
        <a href="#" class="action-item action-danger" data-action="delete" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
          Löschen
        </a>
      `;
    }
    
    return `
      <div class="actions-dropdown-container" data-entity-type="vertraege">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          ${actions}
        </div>
      </div>
    `;
  }

  // ============================================
  // RENDER & EVENTS
  // ============================================

  // Haupt-Render-Methode
  async render() {
    const html = this.viewMode === 'folders' 
      ? this.renderFoldersView() 
      : this.renderVertraegeView();

    window.setContentSafely(window.content, html);
  }

  // Events binden
  bindEvents() {
    // Cleanup alte Events
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // View-Toggle Events (Liste vs Grid)
    const btnViewList = document.getElementById('btn-view-list');
    const btnViewGrid = document.getElementById('btn-view-grid');
    
    if (btnViewList) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'list') return; // Bereits in Listen-Ansicht
        
        this.listViewMode = 'list';
        this.selectedVertraege.clear();
        this.pagination.currentPage = 1;
        this.loadAndRender();
      };
      btnViewList.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewList.removeEventListener('click', handler));
    }
    
    if (btnViewGrid) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'grid') return; // Bereits in Grid-Ansicht
        
        this.listViewMode = 'grid';
        this.selectedVertraege.clear();
        this.loadAndRender();
      };
      btnViewGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewGrid.removeEventListener('click', handler));
    }

    // Neuer Vertrag anlegen Button
    const newBtn = document.getElementById('btn-vertrag-new');
    if (newBtn) {
      const handler = (e) => {
        e.preventDefault();
        // Falls in Unternehmens-Ansicht, mit Unternehmen-ID navigieren
        if (this.currentUnternehmenId) {
          window.navigateTo(`/vertraege/new?unternehmen=${this.currentUnternehmenId}`);
        } else {
          window.navigateTo('/vertraege/new');
        }
      };
      newBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => newBtn.removeEventListener('click', handler));
    }

    // Zurück-Button (nur in Vertragsansicht)
    const backBtn = document.getElementById('btn-back-to-folders');
    if (backBtn) {
      const handler = (e) => {
        e.preventDefault();
        this.switchToFoldersView();
      };
      backBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => backBtn.removeEventListener('click', handler));
    }

    // Ordner-Klick
    const foldersGrid = document.getElementById('folders-grid');
    if (foldersGrid) {
      const handler = (e) => {
        const folder = e.target.closest('.folder-card');
        if (folder) {
          const unternehmenId = folder.dataset.unternehmenId;
          const unternehmenName = folder.dataset.unternehmenName;
          this.switchToVertraegeView(unternehmenId, unternehmenName);
        }
      };
      foldersGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => foldersGrid.removeEventListener('click', handler));
    }

    // Vertrag Detail Links
    document.addEventListener('click', this._vertragLinkHandler = (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'vertrag') {
        e.preventDefault();
        const vertragId = e.target.dataset.id;
        window.navigateTo(`/vertraege/${vertragId}`);
      }
    });

    // Creator Links
    document.addEventListener('click', this._creatorLinkHandler = (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'creator') {
        e.preventDefault();
        const creatorId = e.target.dataset.id;
        window.navigateTo(`/creator/${creatorId}`);
      }
    });

    // Kampagne Links
    document.addEventListener('click', this._kampagneLinkHandler = (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'kampagne') {
        e.preventDefault();
        const kampagneId = e.target.dataset.id;
        window.navigateTo(`/kampagnen/${kampagneId}`);
      }
    });

    // Unternehmen Links
    document.addEventListener('click', this._unternehmenLinkHandler = (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'unternehmen') {
        e.preventDefault();
        const unternehmenId = e.target.dataset.id;
        window.navigateTo(`/unternehmen/${unternehmenId}`);
      }
    });

    // Row-Click (auf Detail navigieren)
    const rows = document.querySelectorAll('.table-row-clickable');
    rows.forEach(row => {
      const handler = (e) => {
        // Ignoriere Klicks auf Actions, Checkboxes und Links
        if (e.target.closest('.actions-dropdown-container')) return;
        if (e.target.closest('input[type="checkbox"]')) return;
        if (e.target.closest('a')) return;
        
        const vertragId = row.dataset.vertragId;
        if (vertragId) {
          window.navigateTo(`/vertraege/${vertragId}`);
        }
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });

    // Selection Events (nur in Vertragsansicht)
    if (this.viewMode === 'vertraege') {
      this.bindSelectionEvents();
      this.bindActionEvents();
    }

    // Event-Listener für Signed-Contract Actions vom ActionsDropdown
    const signedActionHandler = async (e) => {
      const { action, vertragId, existingUrl } = e.detail;
      if (action === 'add-signed') {
        const result = await this.openSignedContractModal(vertragId);
        if (result.action === 'save') {
          await this.saveSignedContractUrl(vertragId, result.url);
        }
      } else if (action === 'edit-signed') {
        const result = await this.openSignedContractModal(vertragId, existingUrl);
        if (result.action === 'save') {
          await this.saveSignedContractUrl(vertragId, result.url);
        } else if (result.action === 'remove') {
          await this.removeSignedContractUrl(vertragId);
        }
      }
    };
    window.addEventListener('vertrag-signed-action', signedActionHandler);
    this._boundEventListeners.add(() => window.removeEventListener('vertrag-signed-action', signedActionHandler));
  }

  // Selection Events binden
  bindSelectionEvents() {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    if (!isAdmin) return;

    // Alle auswählen Button
    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
      const handler = (e) => {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.vertraege-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedVertraege.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-vertraege');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      };
      selectAllBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => selectAllBtn.removeEventListener('click', handler));
    }

    // Auswahl aufheben Button
    const deselectBtn = document.getElementById('btn-deselect-all');
    if (deselectBtn) {
      const handler = (e) => {
        e.preventDefault();
        this.deselectAll();
      };
      deselectBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => deselectBtn.removeEventListener('click', handler));
    }

    // Ausgewählte löschen Button
    const deleteSelectedBtn = document.getElementById('btn-delete-selected');
    if (deleteSelectedBtn) {
      const handler = (e) => {
        e.preventDefault();
        this.showDeleteSelectedConfirmation();
      };
      deleteSelectedBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => deleteSelectedBtn.removeEventListener('click', handler));
    }

    // Select-All Checkbox (Header)
    const selectAllCheckbox = document.getElementById('select-all-vertraege');
    if (selectAllCheckbox) {
      const handler = (e) => {
        const checkboxes = document.querySelectorAll('.vertraege-check');
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) {
            this.selectedVertraege.add(cb.dataset.id);
          } else {
            this.selectedVertraege.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
      };
      selectAllCheckbox.addEventListener('change', handler);
      this._boundEventListeners.add(() => selectAllCheckbox.removeEventListener('change', handler));
    }

    // Einzelne Checkboxes
    document.querySelectorAll('.vertraege-check').forEach(cb => {
      const handler = () => {
        if (cb.checked) {
          this.selectedVertraege.add(cb.dataset.id);
        } else {
          this.selectedVertraege.delete(cb.dataset.id);
        }
        this.updateSelection();
        this.updateSelectAllCheckbox();
      };
      cb.addEventListener('change', handler);
      this._boundEventListeners.add(() => cb.removeEventListener('change', handler));
    });
  }

  // Action Events binden
  bindActionEvents() {
    document.querySelectorAll('.action-item[data-action]').forEach(item => {
      const handler = async (e) => {
        e.preventDefault();
        const action = item.dataset.action;
        const id = item.dataset.id;
        
        switch (action) {
          case 'view':
            window.navigateTo(`/vertraege/${id}`);
            break;
          case 'edit':
          case 'continue':
            window.navigateTo(`/vertraege/${id}/edit`);
            break;
          case 'download':
            this.downloadVertrag(id);
            break;
          case 'delete':
            this.deleteVertrag(id);
            break;
          case 'add-signed': {
            const result = await this.openSignedContractModal(id);
            if (result.action === 'save') {
              await this.saveSignedContractUrl(id, result.url);
            }
            break;
          }
          case 'edit-signed': {
            const existingUrl = item.dataset.url;
            const result = await this.openSignedContractModal(id, existingUrl);
            if (result.action === 'save') {
              await this.saveSignedContractUrl(id, result.url);
            } else if (result.action === 'remove') {
              await this.removeSignedContractUrl(id);
            }
            break;
          }
        }
      };
      item.addEventListener('click', handler);
      this._boundEventListeners.add(() => item.removeEventListener('click', handler));
    });
  }

  // ============================================
  // VIEW SWITCHING
  // ============================================

  // Wechsel zu Ordner-Ansicht
  switchToFoldersView() {
    this.viewMode = 'folders';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.selectedVertraege.clear();
    
    this.updateBreadcrumb();
    this.loadAndRender();
  }

  // Wechsel zu Verträge-Ansicht
  switchToVertraegeView(unternehmenId, unternehmenName) {
    this.viewMode = 'vertraege';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.selectedVertraege.clear();
    
    // Pagination zurücksetzen
    this.pagination.currentPage = 1;
    
    this.updateBreadcrumb();
    this.loadAndRender();
  }

  // ============================================
  // SELECTION HELPERS
  // ============================================

  updateSelection() {
    const selectedCount = this.selectedVertraege.size;
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

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-vertraege');
    const individualCheckboxes = document.querySelectorAll('.vertraege-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.vertraege-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  deselectAll() {
    this.selectedVertraege.clear();
    
    const checkboxes = document.querySelectorAll('.vertraege-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const selectAllCheckbox = document.getElementById('select-all-vertraege');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  async downloadVertrag(id) {
    const vertrag = this.vertraege.find(v => v.id === id);
    if (!vertrag?.datei_url) {
      window.toastSystem?.show('Keine PDF-Datei vorhanden', 'warning');
      return;
    }
    window.open(vertrag.datei_url, '_blank');
  }

  async deleteVertrag(id) {
    const result = await window.confirmationModal?.open({
      title: 'Vertrag löschen?',
      message: 'Möchten Sie diesen Vertrag wirklich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      const vertrag = this.vertraege.find(v => v.id === id);
      if (vertrag?.datei_path) {
        await window.supabase.storage
          .from('vertraege')
          .remove([vertrag.datei_path]);
      }

      const { error } = await window.supabase
        .from('vertraege')
        .delete()
        .eq('id', id);

      if (error) throw error;

      window.toastSystem?.show('Vertrag gelöscht', 'success');
      await this.loadAndRender();

    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedVertraege.size;
    if (selectedCount === 0) {
      window.toastSystem?.show('Keine Verträge ausgewählt', 'warning');
      return;
    }

    const result = await window.confirmationModal?.open({
      title: `${selectedCount} Verträge löschen?`,
      message: 'Möchten Sie die ausgewählten Verträge wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    await this.deleteSelected();
  }

  async deleteSelected() {
    if (window.currentUser?.rolle !== 'admin') return;
    
    const selectedIds = Array.from(this.selectedVertraege);
    const totalCount = selectedIds.length;

    try {
      const vertraegeToDelete = this.vertraege.filter(v => selectedIds.includes(v.id) && v.datei_path);
      if (vertraegeToDelete.length > 0) {
        const paths = vertraegeToDelete.map(v => v.datei_path);
        await window.supabase.storage
          .from('vertraege')
          .remove(paths);
      }

      const { error } = await window.supabase
        .from('vertraege')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      this.selectedVertraege.clear();
      window.toastSystem?.show(`${totalCount} Vertrag/Verträge gelöscht`, 'success');
      await this.loadAndRender();

    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // ============================================
  // UNTERSCHRIEBENER VERTRAG MODAL
  // ============================================

  // Modal zum Hinzufügen/Bearbeiten des Links zum unterschriebenen Vertrag
  openSignedContractModal(vertragId, existingUrl = '') {
    return new Promise((resolve) => {
      const isEdit = !!existingUrl;
      const modal = document.createElement('div');
      modal.className = 'modal overlay-modal';
      modal.innerHTML = `
        <div class="modal-dialog signed-contract-modal">
          <div class="modal-header">
            <h3>${isEdit ? 'Link bearbeiten' : 'Unterschriebenen Vertrag verlinken'}</h3>
            <button class="modal-close" data-action="close">×</button>
          </div>
          <div class="modal-body">
            <p class="modal-description">
              Fügen Sie den Link zur unterschriebenen Vertragsversion ein (z.B. Dropbox, Google Drive, OneDrive).
            </p>
            <div class="form-group">
              <label for="signed-url-input">URL zum unterschriebenen Vertrag</label>
              <input 
                type="url" 
                id="signed-url-input" 
                class="form-input" 
                placeholder="https://www.dropbox.com/..." 
                value="${existingUrl}"
                autocomplete="off"
              >
              <span class="input-hint">Der Link sollte mit http:// oder https:// beginnen</span>
              <span class="input-error" id="url-error" style="display: none;"></span>
            </div>
          </div>
          <div class="modal-footer">
            ${isEdit ? `<button type="button" class="danger-btn" data-action="remove">Link entfernen</button>` : ''}
            <button type="button" class="secondary-btn" data-action="cancel">Abbrechen</button>
            <button type="button" class="primary-btn" data-action="save">Speichern</button>
          </div>
        </div>`;

      document.body.appendChild(modal);

      const input = modal.querySelector('#signed-url-input');
      const errorSpan = modal.querySelector('#url-error');
      const saveBtn = modal.querySelector('[data-action="save"]');

      // URL Validierung
      const validateUrl = (url) => {
        if (!url.trim()) {
          return { valid: false, message: 'Bitte geben Sie eine URL ein' };
        }
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, message: 'URL muss mit http:// oder https:// beginnen' };
          }
          return { valid: true };
        } catch {
          return { valid: false, message: 'Ungültige URL' };
        }
      };

      const showError = (message) => {
        errorSpan.textContent = message;
        errorSpan.style.display = 'block';
        input.classList.add('input-error-border');
      };

      const hideError = () => {
        errorSpan.style.display = 'none';
        input.classList.remove('input-error-border');
      };

      input.addEventListener('input', hideError);

      const close = (result) => {
        if (!modal.parentNode) return;
        modal.remove();
        resolve(result);
      };

      // Button Events
      modal.querySelector('[data-action="close"]').addEventListener('click', () => close({ action: 'cancel' }));
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ action: 'cancel' }));
      
      saveBtn.addEventListener('click', () => {
        const url = input.value.trim();
        const validation = validateUrl(url);
        if (!validation.valid) {
          showError(validation.message);
          return;
        }
        close({ action: 'save', url });
      });

      const removeBtn = modal.querySelector('[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => close({ action: 'remove' }));
      }

      // Klick außerhalb des Dialogs schließt
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close({ action: 'cancel' });
      });

      // Escape schließt, Enter speichert
      const onKey = (ev) => {
        if (ev.key === 'Escape') {
          window.removeEventListener('keydown', onKey);
          close({ action: 'cancel' });
        } else if (ev.key === 'Enter' && document.activeElement === input) {
          ev.preventDefault();
          saveBtn.click();
        }
      };
      window.addEventListener('keydown', onKey);

      // Focus auf Input
      setTimeout(() => input.focus(), 100);
    });
  }

  // Link speichern
  async saveSignedContractUrl(vertragId, url) {
    try {
      const { error } = await window.supabase
        .from('vertraege')
        .update({ unterschriebener_vertrag_url: url })
        .eq('id', vertragId);

      if (error) throw error;

      window.toastSystem?.show('Link gespeichert', 'success');
      await this.reloadData();
      this.bindSignedContractEvents();

    } catch (error) {
      console.error('❌ Fehler beim Speichern:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // Link entfernen
  async removeSignedContractUrl(vertragId) {
    const result = await window.confirmationModal?.open({
      title: 'Link entfernen?',
      message: 'Möchten Sie den Link zum unterschriebenen Vertrag wirklich entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      const { error } = await window.supabase
        .from('vertraege')
        .update({ unterschriebener_vertrag_url: null })
        .eq('id', vertragId);

      if (error) throw error;

      window.toastSystem?.show('Link entfernt', 'success');
      await this.reloadData();
      this.bindSignedContractEvents();

    } catch (error) {
      console.error('❌ Fehler beim Entfernen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // Event Handler für Signed Contract Buttons (nur Add-Button in der Tabelle)
  bindSignedContractEvents() {
    document.querySelectorAll('.btn-add-signed').forEach(btn => {
      const handler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const vertragId = btn.dataset.id;
        const result = await this.openSignedContractModal(vertragId);
        if (result.action === 'save') {
          await this.saveSignedContractUrl(vertragId, result.url);
        }
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });
  }

  // Cleanup
  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    
    this.selectedVertraege.clear();
    this.vertraege = [];
    this.unternehmenFolders = [];
    this.viewMode = 'folders';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
  }
}

// Exportiere Instanz
export const vertraegeList = new VertraegeList();
