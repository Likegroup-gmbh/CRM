// VertraegeList.js (ES6-Modul)
// Verträge-Übersichtsseite mit Unternehmens-Ordnern
// Phase 1: Ordner-Ansicht (Unternehmen alphabetisch)
// Phase 2: Verträge-Liste pro Unternehmen (wie Strategie-Layout)

import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { modularFilterSystem } from '../../core/filters/ModularFilterSystem.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { UploaderField } from '../../core/form/fields/UploaderField.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { syncVertragCheckbox } from '../../core/VertragSyncHelper.js';

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

  getVertragPermissions() {
    const role = String(window.currentUser?.rolle || '').trim().toLowerCase();
    const isAdmin = role === 'admin';
    const perms = window.currentUser?.permissions?.vertraege || {};
    return {
      isAdmin,
      canBulkDelete: isAdmin || role === 'mitarbeiter',
      canView: isAdmin || perms.can_view === true,
      canEdit: isAdmin || perms.can_edit === true
    };
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
    this.updateBreadcrumbDisplay();
    
    // Berechtigungsprüfung (einheitlich über PermissionSystem + Overrides)
    const { canView } = this.getVertragPermissions();

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

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;

    if (this.viewMode === 'folders') {
      // Base view - router handles breadcrumb
      return;
    }

    window.breadcrumbSystem.updateDetailLabel(this.currentUnternehmenName || 'Unternehmen');
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
    const { canEdit } = this.getVertragPermissions();
    const viewToggleHtml = ViewModeToggle.render([
      { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.listViewMode === 'list' },
      { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.listViewMode === 'grid' }
    ]);

    return `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              ${viewToggleHtml}
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
          unterschriebener_vertrag_path,
          dropbox_file_url,
          dropbox_file_path,
          kooperation_id,
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
    const { isAdmin, canBulkDelete, canEdit } = this.getVertragPermissions();

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
            ${canBulkDelete ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
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
                ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-vertraege"></th>` : ''}
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

    const { isAdmin, canBulkDelete, canEdit } = this.getVertragPermissions();

    if (!vertraege || vertraege.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${canBulkDelete ? '10' : '9'}" class="no-data">
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

      const signedUrl = vertrag.dropbox_file_url || vertrag.unterschriebener_vertrag_url;
      let unterschriebenHtml;
      if (signedUrl) {
        unterschriebenHtml = `<a href="${escapeHtml(signedUrl)}" target="_blank" class="contract-signed-action contract-signed-action--open" title="Unterschriebenen Vertrag öffnen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            Öffnen
          </a>`;
      } else if (canEdit && vertrag.datei_url && !vertrag.is_draft) {
        unterschriebenHtml = `<button type="button" class="contract-signed-action contract-signed-action--upload" data-id="${vertrag.id}" title="Unterschriebenen Vertrag hochladen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
              </svg>
              Hochladen
            </button>`;
      } else if (canEdit) {
        unterschriebenHtml = `<button type="button" class="contract-signed-action contract-signed-action--add" data-id="${vertrag.id}" title="Link hinzufügen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>`;
      } else {
        unterschriebenHtml = '<span class="text-muted">—</span>';
      }

      const statusBadge = vertrag.is_draft
        ? '<span class="status-badge status-draft">Entwurf</span>'
        : '<span class="status-badge status-final">Finalisiert</span>';

      const actionsHtml = this.renderVertragActions(vertrag, isAdmin, canEdit);

      return `
        <tr class="table-row-clickable" data-vertrag-id="${vertrag.id}" data-vertrag-draft="${vertrag.is_draft ? '1' : '0'}">
          ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="vertraege-check" data-id="${vertrag.id}"></td>` : ''}
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

    // Action- und Selection-Events auf die neuen DOM-Elemente binden
    if (this.viewMode === 'vertraege') {
      this.bindSelectionEvents();
      this.bindActionEvents();
    }
  }

  // Rendere Aktionen basierend auf Draft-Status
  renderVertragActions(vertrag, isAdmin, canEdit) {
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
      ? `<a href="#" class="action-item" data-action="edit-signed" data-id="${vertrag.id}" data-url="${escapeAttr(vertrag.unterschriebener_vertrag_url)}" data-path="${escapeAttr(vertrag.unterschriebener_vertrag_path || '')}">
          ${signedIcon}
          Unterschriebenen Vertrag bearbeiten
        </a>`
      : `<a href="#" class="action-item" data-action="add-signed" data-id="${vertrag.id}">
          ${signedIcon}
          Unterschriebenen Vertrag hochladen
        </a>`;

    if (isDraft) {
      actions = `
        ${canEdit ? `
        <a href="#" class="action-item" data-action="continue" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
          Weiter bearbeiten
        </a>` : ''}
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
        ${canEdit ? `
        <a href="#" class="action-item" data-action="edit" data-id="${vertrag.id}">
          ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
          Bearbeiten
        </a>` : ''}
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
        const row = e.target.closest('tr[data-vertrag-draft]');
        const isDraft = row?.dataset?.vertragDraft === '1';
        if (isDraft) {
          window.navigateTo(`/vertraege/${vertragId}/edit`);
        } else {
          window.navigateTo(`/vertraege/${vertragId}`);
        }
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
          const isDraft = row.dataset.vertragDraft === '1';
          if (isDraft) {
            window.navigateTo(`/vertraege/${vertragId}/edit`);
          } else {
            window.navigateTo(`/vertraege/${vertragId}`);
          }
        }
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });

    // Event-Listener für Signed-Contract Actions vom ActionsDropdown
    const signedActionHandler = async (e) => {
      const { action, vertragId, existingUrl, existingPath } = e.detail;
      if (action === 'add-signed') {
        const result = await this.openSignedContractModal(vertragId);
        if (result.action === 'save' && result.file) {
          await this.saveSignedContract(vertragId, result.file);
        }
      } else if (action === 'edit-signed') {
        const result = await this.openSignedContractModal(vertragId, existingUrl, existingPath);
        if (result.action === 'save' && result.file) {
          await this.saveSignedContract(vertragId, result.file);
        } else if (result.action === 'remove') {
          await this.removeSignedContract(vertragId);
        }
      }
    };
    window.addEventListener('vertrag-signed-action', signedActionHandler);
    this._boundEventListeners.add(() => window.removeEventListener('vertrag-signed-action', signedActionHandler));
  }

  // Selection Events binden
  bindSelectionEvents() {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const canBulkDelete = isAdmin || window.currentUser?.rolle?.toLowerCase() === 'mitarbeiter';
    if (!canBulkDelete) return;

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
          case 'view': {
            const row = item.closest('tr[data-vertrag-draft]');
            const isDraft = row?.dataset?.vertragDraft === '1';
            if (isDraft) {
              window.navigateTo(`/vertraege/${id}/edit`);
            } else {
              window.navigateTo(`/vertraege/${id}`);
            }
            break;
          }
          case 'edit':
          case 'continue':
            if (!this.getVertragPermissions().canEdit) {
              window.toastSystem?.show('Sie haben keine Berechtigung, Vertragsentwürfe zu bearbeiten.', 'warning');
              break;
            }
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
            if (result.action === 'save' && result.file) {
              await this.saveSignedContract(id, result.file);
            }
            break;
          }
          case 'edit-signed': {
            const existingUrl = item.dataset.url;
            const existingPath = item.dataset.path || '';
            const result = await this.openSignedContractModal(id, existingUrl, existingPath);
            if (result.action === 'save' && result.file) {
              await this.saveSignedContract(id, result.file);
            } else if (result.action === 'remove') {
              await this.removeSignedContract(id);
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
    
    this.updateBreadcrumbDisplay();
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
    
    this.updateBreadcrumbDisplay();
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

      if (vertrag?.unterschriebener_vertrag_path) {
        await window.supabase.storage
          .from('unterschriebene-vertraege')
          .remove([vertrag.unterschriebener_vertrag_path]);
      }

      if (vertrag?.dropbox_file_path) {
        try {
          await fetch('/.netlify/functions/dropbox-delete-vertrag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: vertrag.dropbox_file_path })
          });
        } catch (dbxErr) {
          console.warn('Dropbox-Löschung fehlgeschlagen (wird ignoriert):', dbxErr);
        }
      }

      const { error } = await window.supabase
        .from('vertraege')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Vertrag-Checkbox auf Kooperation synchronisieren (nur wenn signed)
      const hadSigned = vertrag?.unterschriebener_vertrag_url || vertrag?.dropbox_file_url;
      if (hadSigned && vertrag?.kooperation_id) {
        await syncVertragCheckbox(vertrag.kooperation_id, false);
      }

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
    const role = window.currentUser?.rolle?.toLowerCase();
    if (role !== 'admin' && role !== 'mitarbeiter') return;
    
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
  // UNTERSCHRIEBENER VERTRAG MODAL (Upload)
  // ============================================

  // Modal zum Hochladen des unterschriebenen Vertrags (PDF)
  openSignedContractModal(vertragId, existingUrl = '', existingPath = '') {
    return new Promise((resolve) => {
      const hasExisting = !!existingUrl;
      const modal = document.createElement('div');
      modal.className = 'modal overlay-modal';
      
      // Dateiname aus Pfad extrahieren
      const existingFileName = existingPath ? existingPath.split('/').pop() : '';
      
      modal.innerHTML = `
        <div class="modal-dialog signed-contract-modal">
          <div class="modal-header">
            <h3>${hasExisting ? 'Unterschriebenen Vertrag ersetzen' : 'Unterschriebenen Vertrag hochladen'}</h3>
            <button class="modal-close" data-action="close">×</button>
          </div>
          <div class="modal-body">
            ${hasExisting ? `
              <div class="existing-file-info">
                <div class="existing-file-header">
                  <span class="file-icon">📄</span>
                  <span class="file-name">${existingFileName || 'Unterschriebener Vertrag'}</span>
                </div>
                <div class="existing-file-actions">
                  <a href="${existingUrl}" target="_blank" rel="noopener" class="btn-download">
                    <span>↓</span> Herunterladen
                  </a>
                </div>
              </div>
              <p class="modal-description">
                Sie können den bestehenden Vertrag herunterladen oder durch eine neue Version ersetzen.
              </p>
            ` : `
              <p class="modal-description">
                Laden Sie die unterschriebene Vertragsversion als PDF hoch (max. 10 MB).
              </p>
            `}
            <div class="form-group">
              <label>${hasExisting ? 'Neue Version hochladen (optional)' : 'PDF-Datei auswählen'}</label>
              <div class="uploader" data-name="signed_contract_file"></div>
            </div>
          </div>
          <div class="modal-footer">
            ${hasExisting ? `<button type="button" class="danger-btn" data-action="remove">Vertrag entfernen</button>` : ''}
            <button type="button" class="secondary-btn" data-action="cancel">Abbrechen</button>
            <button type="button" class="primary-btn" data-action="save">${hasExisting ? 'Ersetzen' : 'Hochladen'}</button>
          </div>
        </div>`;

      document.body.appendChild(modal);

      // UploaderField initialisieren
      const uploaderRoot = modal.querySelector('.uploader[data-name="signed_contract_file"]');
      const uploader = new UploaderField({
        multiple: false,
        accept: 'application/pdf',
        maxFileSize: 10 * 1024 * 1024, // 10 MB
        onFilesChanged: (files) => {
          // Save-Button aktivieren/deaktivieren
          const saveBtn = modal.querySelector('[data-action="save"]');
          if (!hasExisting) {
            saveBtn.disabled = files.length === 0;
          }
        }
      });
      uploader.mount(uploaderRoot);

      const saveBtn = modal.querySelector('[data-action="save"]');
      
      // Bei neuem Upload: Button initial deaktivieren
      if (!hasExisting) {
        saveBtn.disabled = true;
      }

      const close = (result) => {
        if (!modal.parentNode) return;
        modal.remove();
        resolve(result);
      };

      // Button Events
      modal.querySelector('[data-action="close"]').addEventListener('click', () => close({ action: 'cancel' }));
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ action: 'cancel' }));
      
      saveBtn.addEventListener('click', () => {
        const files = uploader.files;
        if (files.length === 0 && !hasExisting) {
          window.toastSystem?.show('Bitte wählen Sie eine PDF-Datei aus', 'error');
          return;
        }
        // Wenn keine neue Datei ausgewählt aber bestehende vorhanden: Modal einfach schließen
        if (files.length === 0 && hasExisting) {
          close({ action: 'cancel' });
          return;
        }
        close({ action: 'save', file: files[0] });
      });

      const removeBtn = modal.querySelector('[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => close({ action: 'remove' }));
      }

      // Klick außerhalb des Dialogs schließt
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close({ action: 'cancel' });
      });

      // Escape schließt
      const onKey = (ev) => {
        if (ev.key === 'Escape') {
          window.removeEventListener('keydown', onKey);
          close({ action: 'cancel' });
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // Unterschriebenen Vertrag hochladen und speichern
  async saveSignedContract(vertragId, file) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      // Zuerst: Bestehende Datei löschen falls vorhanden
      const { data: existing } = await window.supabase
        .from('vertraege')
        .select('unterschriebener_vertrag_path')
        .eq('id', vertragId)
        .single();

      if (existing?.unterschriebener_vertrag_path) {
        console.log('🗑️ Lösche bestehende Datei:', existing.unterschriebener_vertrag_path);
        await window.supabase.storage
          .from('unterschriebene-vertraege')
          .remove([existing.unterschriebener_vertrag_path]);
      }

      // Dateiname sanitizen
      const timestamp = Date.now();
      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '_')
        .substring(0, 200);
      const path = `${vertragId}/${timestamp}_${safeName}`;

      console.log(`📤 Uploading: ${file.name} -> ${path}`);

      // Upload zu Storage
      const { error: uploadError } = await window.supabase.storage
        .from('unterschriebene-vertraege')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('❌ Upload-Fehler:', uploadError);
        throw uploadError;
      }

      // Public URL holen
      const { data: urlData } = window.supabase.storage
        .from('unterschriebene-vertraege')
        .getPublicUrl(path);

      const publicUrl = urlData?.publicUrl || '';

      // In DB speichern
      const { error: dbError } = await window.supabase
        .from('vertraege')
        .update({ 
          unterschriebener_vertrag_url: publicUrl,
          unterschriebener_vertrag_path: path 
        })
        .eq('id', vertragId);

      if (dbError) {
        console.error('❌ DB-Fehler:', dbError);
        throw dbError;
      }

      // Vertrag-Checkbox auf Kooperation synchronisieren
      const vertrag = this.vertraege.find(v => v.id === vertragId);
      if (vertrag?.kooperation_id) {
        await syncVertragCheckbox(vertrag.kooperation_id, true);
      }

      console.log('✅ Unterschriebener Vertrag hochgeladen:', path);
      window.toastSystem?.show('Vertrag hochgeladen', 'success');
      await this.reloadData();
      this.bindSignedContractEvents();

    } catch (error) {
      console.error('❌ Fehler beim Hochladen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // Unterschriebenen Vertrag entfernen (Storage + DB)
  async removeSignedContract(vertragId) {
    const result = await window.confirmationModal?.open({
      title: 'Vertrag entfernen?',
      message: 'Möchten Sie den hochgeladenen unterschriebenen Vertrag wirklich entfernen? Die Datei wird unwiderruflich gelöscht.',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      if (!window.supabase) {
        throw new Error('Supabase nicht verfügbar');
      }

      const { data } = await window.supabase
        .from('vertraege')
        .select('unterschriebener_vertrag_path, dropbox_file_path')
        .eq('id', vertragId)
        .single();

      if (data?.unterschriebener_vertrag_path) {
        const { error: storageError } = await window.supabase.storage
          .from('unterschriebene-vertraege')
          .remove([data.unterschriebener_vertrag_path]);

        if (storageError) {
          console.warn('⚠️ Storage-Löschfehler (nicht kritisch):', storageError);
        }
      }

      if (data?.dropbox_file_path) {
        try {
          await fetch('/.netlify/functions/dropbox-delete-vertrag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: data.dropbox_file_path })
          });
        } catch (dbxErr) {
          console.warn('Dropbox-Löschung fehlgeschlagen (wird ignoriert):', dbxErr);
        }
      }

      const { error } = await window.supabase
        .from('vertraege')
        .update({ 
          unterschriebener_vertrag_url: null,
          unterschriebener_vertrag_path: null,
          dropbox_file_url: null,
          dropbox_file_path: null
        })
        .eq('id', vertragId);

      if (error) throw error;

      // Vertrag-Checkbox auf Kooperation synchronisieren
      const vertrag = this.vertraege.find(v => v.id === vertragId);
      if (vertrag?.kooperation_id) {
        await syncVertragCheckbox(vertrag.kooperation_id, false);
      }

      console.log('✅ Unterschriebener Vertrag entfernt');
      window.toastSystem?.show('Vertrag entfernt', 'success');
      await this.reloadData();
      this.bindSignedContractEvents();

    } catch (error) {
      console.error('❌ Fehler beim Entfernen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // Event Handler für Signed Contract Buttons (nur Add-Button in der Tabelle)
  bindSignedContractEvents() {
    document.querySelectorAll('.contract-signed-action--add').forEach(btn => {
      const handler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const vertragId = btn.dataset.id;
        const result = await this.openSignedContractModal(vertragId);
        if (result.action === 'save' && result.file) {
          await this.saveSignedContract(vertragId, result.file);
        }
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });

    document.querySelectorAll('.contract-signed-action--upload').forEach(btn => {
      const handler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const vertragId = btn.dataset.id;
        const vertrag = this.vertraege?.find(v => v.id === vertragId);
        if (!vertrag) return;

        const { VertragUploadDrawer } = await import('./VertragUploadDrawer.js');
        const drawer = new VertragUploadDrawer();
        drawer.open(vertragId, {
          kooperationId: vertrag.kooperation_id,
          unternehmen: vertrag.kunde?.firmenname || this.currentUnternehmenName || '',
          kampagne: vertrag.kampagne?.kampagnenname || vertrag.kampagne?.eigener_name || '',
          creator: vertrag.creator ? `${vertrag.creator.vorname || ''} ${vertrag.creator.nachname || ''}`.trim() : '',
          vertragstyp: vertrag.typ || ''
        }, () => {
          window.toastSystem?.show('Vertrag erfolgreich hochgeladen', 'success');
          this.reloadData();
        });
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
