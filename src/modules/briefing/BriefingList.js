// BriefingList.js (ES6-Modul)
// Grid: Unternehmen → Marken → Briefings. Liste: bisherige flache Tabelle.
// RLS: intern voll, Kunden nur eigener Scope (kunde_unternehmen / kunde_marke).
// Navigation, Klicks/Auswahl und Tabellenzeilen liegen in briefingList*.js.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { attachPersonasToBriefings } from '../../core/ui/tableVerknuepfungen.js';
import { installBriefingListNavigation } from './briefingListNavigation.js';
import { installBriefingListAktionen } from './briefingListAktionen.js';
import { installBriefingListZeilen } from './briefingListZeilen.js';

export class BriefingList {
  constructor() {
    this.selectedBriefings = new Set();
    this._boundEventListeners = new Set();
    this._abortController = null;
    this.briefings = [];
    this._forceReload = true;

    this.viewMode = 'companies';
    this.listViewMode = 'grid';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;

    this.companyFolders = [];
    this.brandFolders = [];
    this.currentItems = [];
  }

  sanitize(value) {
    return window.validatorSystem?.sanitizeHtml(value) || value || '';
  }

  async init(id) {
    if (id && id !== 'new' && window.moduleRegistry) {
      return window.navigateTo(`/briefing/${id}`);
    }

    this.applyQueryParams(new URLSearchParams(window.location.search));
    this._forceReload = true;

    window.setHeadline('Briefings Übersicht');

    if (window.bulkActionSystem) {
      window.bulkActionSystem.hideForKunden();
    }

    const canView = (window.canViewPage && window.canViewPage('briefing')) || await window.checkUserPermission('briefing', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Briefings anzuzeigen.</p>
        </div>
      `;
      return;
    }

    window.bulkActionSystem?.registerList('briefing', this);

    this.bindEvents();
    await this.loadAndRender();
  }

  async loadAndRender() {
    try {
      if (this.listViewMode === 'list') {
        this.viewMode = 'companies';
        await this.render();
        await this.initializeFilterBar();
        const currentFilters = filterSystem.getFilters('briefing');
        const briefings = await this.loadBriefings(currentFilters);
        this.briefings = briefings;
        await this.updateTable(briefings);
        this.updateBreadcrumbDisplay();
        this.syncListUrl();
        return;
      }

      if (this.briefings.length === 0 || this._forceReload) {
        this.briefings = await this.loadBriefings({});
        this._forceReload = false;
      }

      this.buildCurrentFolders();
      this.applyMarkenEbeneSprung();
      this.renderFolderView();

      if (this.viewMode === 'items') {
        this.updateItemsTable();
      }
    } catch (error) {
      window.ErrorHandler.handle(error, 'BriefingList.loadAndRender');
    }
  }

  async loadBriefings(filters = {}) {
    if (!window.supabase) return [];

    let query = window.supabase
      .from('campaign_briefings')
      .select(`
        id, aktivierung_name, bereich, is_draft, ansatz,
        content_deadline, go_live, created_at, updated_at,
        unternehmen_id, marke_id, persona_ids,
        unternehmen:unternehmen_id(id, firmenname, logo_url),
        marke:marke_id(id, markenname, logo_url),
        kampagne:kampagne_id(id, start, deadline, auftrag:auftrag_id(start, ende)),
        produkte:campaign_briefing_produkt(produkt:produkt_id(id, name)),
        creator_auswahl(id, name),
        strategie(id, name),
        skripte(id, titel)
      `)
      .eq('ist_altbestand', false)
      .order('created_at', { ascending: false });

    const apply = (field, val, type = 'string') => {
      if (val == null || val === '' || val === '[object Object]') return;
      const v = String(val);
      switch (type) {
        case 'uuid':
          query = query.eq(field, v);
          break;
        case 'bool':
          query = query.eq(field, v === 'true');
          break;
        case 'dateRange':
          if (val.from) query = query.gte(field, val.from);
          if (val.to) query = query.lte(field, val.to);
          break;
        case 'stringIlike':
          query = query.ilike(field, `%${v}%`);
          break;
        default:
          query = query.eq(field, v);
      }
    };

    apply('unternehmen_id', filters.unternehmen_id, 'uuid');
    apply('marke_id', filters.marke_id, 'uuid');
    apply('bereich', filters.bereich);
    apply('is_draft', filters.is_draft, 'bool');
    if (filters.aktivierung_name) apply('aktivierung_name', filters.aktivierung_name, 'stringIlike');
    if (filters.content_deadline) apply('content_deadline', filters.content_deadline, 'dateRange');

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const personaIds = [...new Set(rows.flatMap((row) => row.persona_ids || []).filter(Boolean))];
    const personas = await this.fetchPersonasByIds(personaIds);
    return attachPersonasToBriefings(rows, personas);
  }

  async fetchPersonasByIds(ids) {
    if (!ids.length || !window.supabase) return [];
    const all = [];
    for (let i = 0; i < ids.length; i += 80) {
      const chunk = ids.slice(i, i + 80);
      const { data, error } = await window.supabase
        .from('personas')
        .select('id, name')
        .in('id', chunk);
      if (error) throw error;
      all.push(...(data || []));
    }
    return all;
  }

  async render() {
    const canEdit = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_edit;
    const canBulkDelete = window.canBulkDelete();

    const html = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${ViewModeToggle.render([
              { buttonId: 'btn-view-list', label: 'Liste', icon: 'list', active: this.listViewMode === 'list' },
              { buttonId: 'btn-view-grid', label: 'Grid', icon: 'grid', active: this.listViewMode === 'grid' }
            ])}
            <div id="filter-dropdown-container"></div>
          </div>
        </div>
        <div class="table-actions">
          ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
          <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-briefing-new" class="mdc-btn">Neues Briefing anlegen</button>' : ''}
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${canBulkDelete ? `<th class="col-checkbox"><input type="checkbox" id="select-all-briefings"></th>` : ''}
              <th class="col-name">Aktivierung</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th class="col-leistungszeitraum">Leistungszeitraum</th>
              <th>Bereich</th>
              <th>Status</th>
              <th>Erstellt am</th>
              <th>Content Deadline</th>
              <th>Produkte</th>
              <th>Personas</th>
              <th>Casting</th>
              <th>Konzept</th>
              <th>Skript</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-table-body">
            <tr>
              <td colspan="${canBulkDelete ? '15' : '14'}" class="loading">Lade Briefings...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('briefing', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('briefing', filters);
    this.loadAndRender();
  }

  onFiltersReset() {
    filterSystem.resetFilters('briefing');
    this.loadAndRender();
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('briefing');
    return Object.keys(filters).length > 0;
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    this.briefings = [];
    this.companyFolders = [];
    this.brandFolders = [];
    this.currentItems = [];
    this.viewMode = 'companies';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this._forceReload = true;
  }
}

installBriefingListNavigation(BriefingList.prototype);
installBriefingListAktionen(BriefingList.prototype);
installBriefingListZeilen(BriefingList.prototype);

export const briefingList = new BriefingList();
