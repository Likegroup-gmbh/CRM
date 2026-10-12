// CreatorList.js (ES6-Modul)
// Creator-Liste mit neuem Filtersystem - Performance-optimiert
// Basiert auf BasePaginatedList

import { BasePaginatedList } from '../../core/BasePaginatedList.js';
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { creatorUtils } from './CreatorUtils.js';
import { CreatorGridView } from './CreatorGridView.js';
import { injectFirmaCreateButton } from './FirmaCreateDrawer.js';
import { GENERATIONEN, GROESSEN, bindGenerationControls, normalizeHandle } from './creatorProfil.js';
import { mountCreatorBetreuung, syncCreatorBetreuung } from '../ansprechpartner/betreuung.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { connectInstagramSilent } from '../../core/ActionsDropdownHandlers.js';
import { icon } from '../../core/icons/IconSystem.js';
import { settleRezensionFilters } from './rezension.js';
import { formatCreatorSumme, queryToSelection, selectionToQuery } from './creatorFilterQuery.js';
import { ladeVideoAnzahl, normalizeSort, sortiereNachName, sortiereNachVideos } from './creatorBuchung.js';
import {
  columnStartsCollapsed,
  mountCreatorFilterColumn,
  paintFilterValues
} from './creatorFilterColumn.js';

const ANSICHT_KEY = 'creator-ansicht';

function readAnsicht() {
  try {
    return localStorage.getItem(ANSICHT_KEY) === 'liste' ? 'liste' : 'grid';
  } catch {
    return 'grid';
  }
}

export class CreatorList extends BasePaginatedList {
  constructor(opts = {}) {
    const mode = opts.mode || 'all'; // 'all' | 'management'
    const isManagement = mode === 'management';

    super('creator', {
      itemsPerPage: 25,
      headline: isManagement ? 'Management-Creator Übersicht' : 'Creator Übersicht',
      breadcrumbLabel: 'Creator',
      sortField: 'nachname',
      sortAscending: true,
      paginationContainerId: 'pagination-container-creator',
      tbodySelector: '.data-table tbody',
      tableColspan: 14, // Mit Admin-Checkbox
      checkboxClass: 'creator-check',
      selectAllId: 'select-all-creators',
      ...opts
    });

    this.mode = mode;
    this._managementCreatorIds = null;

    // Bulk-Connect-Status
    this._bulkConnectRunning = false;
    this._bulkConnectAbort = false;

    // Zusätzliche Creator-spezifische Properties
    this.selectedCreator = this.selectedItems; // Alias für Kompatibilität

    this.groesseFilter = [];
    this.generationFilter = '';
    this.ansicht = readAnsicht();
    this.sort = 'name';
    this.videoTage = 0;
    this._videoKey = '';
    this._videoOrder = [];
    this.gridView = new CreatorGridView(this);
    this._gridLoadedOnce = false;

    // Referenz auf Basis-loadData, um aus der Override heraus die Tabellen-Logik
    // aufrufen zu können.
    this._superLoadData = BasePaginatedList.prototype.loadData.bind(this);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // IMPLEMENTIERUNG DER ABSTRAKTEN METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Lädt die Creator-Daten für eine Seite
   */
  usesFilterColumn() {
    return this.mode === 'all';
  }

  async loadPageData(page, limit, filters) {
    const sort = normalizeSort(filters?._sort);
    if (sort === 'name' && this.usesFilterColumn()) return this.loadNamePage(page, limit, filters);
    if (sort === 'video30' || sort === 'video90' || sort === 'kooperation') {
      const tage = sort === 'video30' ? 30 : sort === 'video90' ? 90 : 'alle';
      return this.loadVideoPage(page, limit, filters, tage);
    }
    return this.loadCreatorPage(page, limit, filters);
  }

  async loadCreatorPage(page, limit, filters) {
    const queryFilters = { ...filters };
    delete queryFilters._videoTage;
    delete queryFilters._sort;
    // Summe über den Karten ist die genaue Trefferzahl, nicht die Schätzung fürs Weiterladen.
    if (this.usesFilterColumn() && page === 1 && !queryFilters._idOnly) queryFilters._countExact = true;

    // Management-Modus: nur Creator mit aktiver Management-Verknüpfung laden
    if (this.mode === 'management' && window.supabase) {
      const ids = await this.loadManagementCreatorIds();
      if (!ids || ids.length === 0) {
        return { data: [], total: 0 };
      }
      queryFilters._allowedIds = ids;
    }

    const result = await window.dataService.loadEntitiesWithPagination(
      'creator',
      queryFilters,
      page,
      limit
    );
    
    return {
      data: result.data || [],
      total: result.total || 0
    };
  }

  orderBase(filters) {
    const base = { ...filters };
    delete base._videoTage;
    delete base._sort;
    delete base._sortBy;
    delete base._sortOrder;
    delete base._countExact;
    delete base._idOnly;
    return base;
  }

  async pageFromOrder(page, limit, order, stamp) {
    const start = (page - 1) * limit;
    const slice = (order || []).slice(start, start + limit);
    if (!slice.length) return { data: [], total: order?.length || 0 };
    const result = await this.loadCreatorPage(1, slice.length, { _allowedIds: slice.map((row) => row.id) });
    const byId = new Map((result.data || []).map((creator) => [creator.id, creator]));
    const data = slice.map((row) => {
      const creator = byId.get(row.id);
      if (creator && stamp) stamp(creator, row);
      return creator;
    }).filter(Boolean);
    return { data, total: order.length };
  }

  async loadNamePage(page, limit, filters) {
    const base = this.orderBase(filters);
    const key = JSON.stringify(base);
    if (this._nameKey !== key) {
      const creators = await this.loadAllMatchingIds(base);
      this._nameOrder = sortiereNachName(creators);
      this._nameKey = key;
    }
    return this.pageFromOrder(page, limit, this._nameOrder);
  }

  async loadVideoPage(page, limit, filters, tage) {
    const base = this.orderBase(filters);
    const key = JSON.stringify(base);
    if (this._videoKey !== key || this._videoTageCache !== tage) {
      try {
        const creators = await this.loadAllMatchingIds(base);
        const counts = await ladeVideoAnzahl(window.supabase, tage);
        this._videoOrder = sortiereNachVideos(creators, counts);
        this._videoKey = key;
        this._videoTageCache = tage;
      } catch (error) {
        console.error('Videozahl konnte nicht geladen werden', error);
        window.toastSystem?.show('Videozahl konnte nicht geladen werden', 'error');
        this.setSort('name', { reload: false });
        return this.loadNamePage(page, limit, base);
      }
    }
    return this.pageFromOrder(page, limit, this._videoOrder, (creator, row) => {
      if (tage !== 'alle') creator.videos = row.anzahl;
    });
  }

  async loadAllMatchingIds(filters) {
    const creators = [];
    const limit = 500;
    let page = 1;
    while (page < 20) {
      const result = await this.loadCreatorPage(page, limit, { ...filters, _idOnly: true });
      creators.push(...(result.data || []));
      if ((result.data || []).length < limit) break;
      page += 1;
    }
    return creators;
  }

  /**
   * Lädt alle creator_id mit aktiver Management-Verknüpfung (Cache pro Modul-Instanz)
   */
  async loadManagementCreatorIds() {
    if (this._managementCreatorIds !== null) return this._managementCreatorIds;

    try {
      const { data, error } = await window.supabase
        .from('creator_management')
        .select('creator_id')
        .eq('ist_aktiv', true);

      if (error) {
        console.error('❌ CREATORLIST: Fehler beim Laden der Management-Verknüpfungen:', error);
        return null;
      }

      const unique = [...new Set((data || []).map(r => r.creator_id).filter(Boolean))];
      this._managementCreatorIds = unique;
      return unique;
    } catch (err) {
      console.error('❌ CREATORLIST: Exception beim Laden der Management-Verknüpfungen:', err);
      return null;
    }
  }

  resetEntityCaches() {
    this._managementCreatorIds = null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GRID ALS EINZIGE ANSICHT
  // ══════════════════════════════════════════════════════════════════════════

  /** Override: die Uebersicht ist immer das Grid, nie die Tabelle. */
  async loadData() {
    if (this._destroyed) return;
    const scrollTop = this._gridLoadedOnce;
    this._gridLoadedOnce = true;
    this.writeSelectionToUrl();
    await this.gridView.reload({ scrollTop });
  }

  onResultTotal(total) {
    const el = document.getElementById('creator-result-count');
    if (el) el.textContent = formatCreatorSumme(total);
  }

  readBarFromLocation() {
    const selection = queryToSelection(window.location.search, {
      groessen: GROESSEN,
      generationen: GENERATIONEN.map((entry) => entry.label)
    });
    this.searchQuery = selection.search;
    this.groesseFilter = selection.groesse;
    this.generationFilter = selection.generation;
    this.sort = selection.sort || 'name';
    this.videoTage = this.sort === 'video30' ? 30 : this.sort === 'video90' ? 90 : 0;
  }

  writeSelectionToUrl() {
    if (!this.usesFilterColumn()) return;
    const filterIds = this._filterColumn
      ? new Set(this._filterColumn.filters.map((filter) => filter.id))
      : null;
    const values = { ...filterSystem.getFilters(this.entityType) };
    const params = selectionToQuery({
      search: this.searchQuery,
      groesse: this.usesFilterColumn() ? (Array.isArray(values.groesse) ? values.groesse : []) : this.groesseFilter,
      generation: this.usesFilterColumn() ? (values.generation || '') : this.generationFilter,
      sort: this.sort,
      filters: values,
      filterIds
    });
    const next = params.toString();
    const url = next ? `/creator?${next}` : '/creator';
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === url) return;
    try {
      window.history.replaceState({ ...(window.history.state || {}), route: url }, '', url);
    } catch {
      // History nicht verfügbar
    }
  }

  async renderShell() {
    if (this.usesFilterColumn() && !this._shellRendered) this.readBarFromLocation();
    return super.renderShell();
  }

  /**
   * Soft-Update nach Connect/Refresh: nur die betroffene Grid-Karte ersetzen,
   * damit die Scroll-Position nicht nach oben springt.
   * @returns {Promise<boolean>} true = Full-Reload unterdrücken
   */
  async loadMoreForScroll() {
    if (!this.gridView) return false;
    return this.gridView.loadMoreForScroll();
  }

  async handleEntityUpdated(detail) {
    if (!detail?.id) return false;

    const action = detail.action || '';
    if (action === 'deleted' || action === 'bulk-deleted' || action === 'created') {
      return false;
    }

    return this.gridView.refreshCard(detail.id);
  }

  destroy() {
    clearTimeout(this._filterColumn?.timer);
    this.gridView?.destroy();
    this._gridLoadedOnce = false;
    super.destroy();
  }
  
  /**
   * Rendert eine einzelne Creator-Zeile
   */
  renderSingleRow(creator) {
    const canBulkDelete = this.canBulkDelete;
    const sanitize = this.sanitize.bind(this);
    
    const externalLinkIcon = `${icon('external-link')}`;
    
    const formatLink = (url) => {
      if (!url) return '-';
      const safeUrl = window.validatorSystem?.sanitizeUrl(url);
      if (!safeUrl) return '-';
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="table-link-external" title="${sanitize(url)}">${externalLinkIcon}</a>`;
    };

    // Instagram-Connect: ohne Link ausgegraut, nach Connect als Refresh
    const actionOptions = {};
    if (!creator.instagram) actionOptions.disabledActions = ['connect'];
    if (creator.ig_connected_at) actionOptions.igConnected = true;

    // Kleiner Tabellen-Avatar: 128px-Thumb reicht, Fallback fuer Altbestand
    const avatarSource = creator.profilbild_thumb_url || creator.profilbild_url;
    const safeAvatarUrl = avatarSource ? window.validatorSystem?.sanitizeUrl(avatarSource) : null;
    const avatarHtml = safeAvatarUrl
      ? `<img src="${safeAvatarUrl}" alt="${sanitize(`${creator.vorname || ''} ${creator.nachname || ''}`.trim())}" class="table-avatar table-avatar-img" loading="lazy" />`
      : `<span class="table-avatar">${(creator.vorname || '?')[0].toUpperCase()}</span>`;
    
    return `
      <tr data-id="${creator.id}">
        ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="creator-check" data-id="${creator.id}"></td>` : ''}
        <td class="col-name col-name-with-icon">
          ${avatarHtml}
          <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
            ${sanitize(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || '-')}
          </a>
        </td>
        <td>${this.renderLocationTag(creator.lieferadresse_stadt, 'stadt')}</td>
        <td>${this.renderLocationTag(creator.lieferadresse_land, 'land')}</td>
        <td>${creator.mail ? `<a href="mailto:${sanitize(creator.mail)}">${sanitize(creator.mail)}</a>` : '-'}</td>
        <td>${sanitize(creator.telefonnummer || '-')}</td>
        <td>${this.formatAgeRange(creator.alter_min, creator.alter_max, creator.alter_jahre)}</td>
        <td>${this.renderCreatorTypeTags(creator.creator_types)}</td>
        <td>${this.renderBrancheTags(creator.branchen)}</td>
        <td class="table-cell-center">${formatLink(creator.instagram)}</td>
        <td>${creatorUtils.formatFollowerRange(creator.instagram_follower)}</td>
        <td class="table-cell-center">${formatLink(creator.tiktok)}</td>
        <td>${creatorUtils.formatFollowerRange(creator.tiktok_follower)}</td>
        <td class="col-actions">
          ${actionBuilder.create('creator', creator.id, null, actionOptions)}
        </td>
      </tr>
    `;
  }
  
  /**
   * Rendert den Shell-Content (Struktur ohne Daten)
   */
  renderShellContent() {
    const canEdit = this.canEdit;
    const canBulkDelete = this.canBulkDelete;

    // Groessen-Chips nutzen den bestehenden View-Umschalter, hier mehrfach waehlbar
    const groesseChips = this.usesFilterColumn() ? '' : ViewModeToggle.render(GROESSEN.map((label) => ({
      buttonId: `creator-groesse-${label}`,
      label,
      active: this.groesseFilter.includes(label)
    })));

    const generationOptions = this.usesFilterColumn() ? '' : ['<option value="">Alle Generationen</option>']
      .concat(GENERATIONEN.map((entry) => `<option value="${entry.label}"${this.generationFilter === entry.label ? ' selected' : ''}>${entry.label}</option>`))
      .join('');
    const generationSelect = generationOptions
      ? `<select id="creator-generation" class="form-input" aria-label="Generation">${generationOptions}</select>`
      : '';

    const ansichtToggle = this.usesFilterColumn() ? ViewModeToggle.render([
      { buttonId: 'creator-ansicht-grid', label: 'Kacheln', icon: 'grid', active: this.ansicht !== 'liste' },
      { buttonId: 'creator-ansicht-liste', label: 'Liste', icon: 'list', active: this.ansicht === 'liste' }
    ]) : '';

    const collapsed = this.usesFilterColumn() && columnStartsCollapsed();
    const filterSlot = this.usesFilterColumn()
      ? `<button type="button" id="creator-filter-toggle" class="mdc-btn mdc-btn--secondary" aria-expanded="${collapsed ? 'false' : 'true'}">Sortieren und Filtern</button>`
      : '<div id="filter-dropdown-container"></div>';

    const toolbar = `
      <div class="table-filter-wrapper creator-filter-sticky">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render('creator', {
              placeholder: 'Name oder Handle...',
              currentValue: this.searchQuery
            })}
            ${ansichtToggle}
            ${groesseChips}
            ${generationSelect}
            ${filterSlot}
          </div>
          <div class="filter-right">
            ${canEdit ? '<button id="btn-creator-new" class="mdc-btn">Creator anlegen</button>' : ''}
          </div>
        </div>
        ${this.usesFilterColumn() ? `
          <div class="creator-column-chips" id="creator-column-chips"></div>
          <p class="creator-result-count" id="creator-result-count" aria-live="polite"></p>
        ` : ''}
      </div>
    `;

    const actions = `
      <div class="table-filter-wrapper">
        <div class="table-actions">
          ${this.isAdmin ? '<button id="btn-connect-all" class="mdc-btn mdc-btn--secondary">Connect</button>' : ''}
          ${canBulkDelete ? `<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
          <button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>` : ''}
        </div>
      </div>
    `;

    const grid = `
      <div class="creator-views view-grid" id="creator-views-${this.mode}">
        ${this.gridView.renderShell()}
      </div>
    `;

    if (!this.usesFilterColumn()) return `${toolbar}${actions}${grid}`;

    return `
      <div class="creator-browser${collapsed ? ' is-column-collapsed' : ''}">
        <div class="creator-filter-backdrop" data-action="close-creator-filters"></div>
        <aside class="creator-filter-column" id="creator-filter-column" aria-label="Sortieren und Filtern">
          <div class="creator-filter-column__head">
            <span class="creator-filter-column__title">Sortieren und Filtern</span>
            <button type="button" class="creator-filter-column__close" data-action="close-creator-filters" aria-label="Sortieren und Filtern schließen">${icon('x-mark')}</button>
          </div>
          <div id="creator-filter-column-body"></div>
        </aside>
        <div class="creator-browser__main">
          ${toolbar}
          ${actions}
          ${grid}
        </div>
      </div>
    `;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // ÜBERSCHRIEBENE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialisiert die Filter-Bar mit Creator-spezifischen Einstellungen
   */
  async initializeFilterBar() {
    // Sort-Dropdown initialisieren
    const sortContainer = document.getElementById('sort-dropdown-container');
    if (sortContainer) {
      sortDropdown.init('creator', sortContainer, {
        nameField: 'nachname',
        defaultSort: 'name_asc',
        onSortChange: (sortConfig) => this.onSortChange(sortConfig)
      });
    }
    
    if (this.usesFilterColumn()) {
      try {
        this._filterColumn = await mountCreatorFilterColumn(this);
      } catch (err) {
        console.error('Filterspalte konnte nicht geladen werden', err);
        const body = document.getElementById('creator-filter-column-body');
        if (body) body.textContent = 'Filter konnten nicht geladen werden.';
      }
      return;
    }

    // Filter-Dropdown initialisieren (Management-Creator und andere Listen)
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('creator', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(settleRezensionFilters(filters)),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }
  
  /**
   * Zusätzliche Events binden (Suche, Creator-New Button)
   */
  bindAdditionalEvents(signal) {
    this._filterColumn?.bind(signal);

    // Suchfeld Events über globale Komponente
    SearchInput.bind('creator', (value) => this.handleSearch(value), signal);

    // Groesse: mehrere Chips gleichzeitig, keine Auswahl heisst alle
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[id^="creator-groesse-"]');
      if (!chip) return;
      const label = GROESSEN.find((entry) => chip.id === `creator-groesse-${entry}`);
      if (!label) return;
      e.preventDefault();
      this.groesseFilter = this.groesseFilter.includes(label)
        ? this.groesseFilter.filter((entry) => entry !== label)
        : [...this.groesseFilter, label];
      chip.classList.toggle('active');
      this.loadData();
    }, { signal });

    document.getElementById('creator-generation')?.addEventListener('change', (e) => {
      this.generationFilter = e.target.value;
      this.loadData();
    }, { signal });

    document.addEventListener('click', (e) => {
      const ansicht = e.target.closest('#creator-ansicht-grid, #creator-ansicht-liste');
      if (ansicht) {
        e.preventDefault();
        const next = ansicht.id === 'creator-ansicht-liste' ? 'liste' : 'grid';
        if (next === this.ansicht) return;
        this.ansicht = next;
        try { localStorage.setItem(ANSICHT_KEY, next); } catch { /* privat */ }
        document.getElementById('creator-ansicht-grid')?.classList.toggle('active', next !== 'liste');
        document.getElementById('creator-ansicht-liste')?.classList.toggle('active', next === 'liste');
        this.gridView.setAnsicht(next);
      }
    }, { signal });

    // Grid-spezifische Events (Bio-Toggle, Connect-CTA, Retry)
    this.gridView.bindEvents(signal);
    
    // Neuen Creator anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-creator-new') {
        e.preventDefault();
        window.navigateTo('/creator/new');
      }
    }, { signal });
    
    // Delete Selected Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-delete-selected') {
        e.preventDefault();
        this.showDeleteSelectedConfirmation();
      }
    }, { signal });

    // Bulk Instagram Connect
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-connect-all')) {
        e.preventDefault();
        this.runBulkConnect();
      }
    }, { signal });

    this._updateConnectAllCount();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BULK INSTAGRAM CONNECT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Basis-Query für nicht verbundene Creator (Instagram-Handle gesetzt,
   * ig_connected_at leer).
   */
  _notConnectedQuery(select, options = {}) {
    return window.supabase
      .from('creator')
      .select(select, options)
      .not('instagram', 'is', null)
      .neq('instagram', '')
      .is('ig_connected_at', null);
  }

  /**
   * Zeigt im Button die Gesamtanzahl der nicht verbundenen Creator.
   */
  async _updateConnectAllCount() {
    const btn = document.getElementById('btn-connect-all');
    if (!btn || this._bulkConnectRunning || !window.supabase) return;

    try {
      const { count, error } = await this._notConnectedQuery('id', { count: 'exact', head: true });
      if (error) throw error;
      btn.textContent = `Connect (${count ?? 0})`;
    } catch (err) {
      console.warn('Connect-Count konnte nicht geladen werden:', err);
      btn.textContent = 'Connect';
    }
  }

  /**
   * Lädt alle IDs der nicht verbundenen Creator (seitenweise, um das
   * Supabase-Limit von 1000 Zeilen zu umgehen).
   */
  async _loadNotConnectedIds() {
    const ids = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this._notConnectedQuery('id')
        .order('id')
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Fehler beim Laden der nicht verbundenen Creator:', error);
        break;
      }

      ids.push(...(data || []).map(r => r.id));
      if (!data || data.length < pageSize) break;
    }

    return ids;
  }

  /**
   * Abbruch-freundliches Warten: schläft in 500ms-Schritten und bricht ab,
   * sobald das Abort-Flag gesetzt wird.
   */
  async _bulkConnectWait(ms) {
    const step = 500;
    for (let waited = 0; waited < ms; waited += step) {
      if (this._bulkConnectAbort) return;
      await new Promise(resolve => setTimeout(resolve, Math.min(step, ms - waited)));
    }
  }

  /**
   * Connected alle nicht verbundenen Creator sequentiell (~2s Throttle).
   * Bei Meta-Rate-Limit wird pausiert (60s, eskalierend bis 10min) und der
   * gleiche Creator erneut versucht; andere Fehler werden übersprungen.
   * Jede Karte aktualisiert sich einzeln via entityUpdated.
   * Erneuter Klick während des Laufs (auch in einer Pause) stoppt.
   */
  async runBulkConnect() {
    const btn = document.getElementById('btn-connect-all');

    if (this._bulkConnectRunning) {
      this._bulkConnectAbort = true;
      if (btn) btn.textContent = 'Wird gestoppt…';
      return;
    }

    this._bulkConnectRunning = true;
    this._bulkConnectAbort = false;

    const THROTTLE_MS = 2000;
    const BACKOFF_START_MS = 60 * 1000;
    const BACKOFF_MAX_MS = 10 * 60 * 1000;

    const setLabel = (text) => {
      const liveBtn = document.getElementById('btn-connect-all');
      if (liveBtn) liveBtn.textContent = text;
    };

    try {
      setLabel('Lade Liste…');

      const ids = await this._loadNotConnectedIds();
      const total = ids.length;
      let connected = 0;
      let backoffMs = BACKOFF_START_MS;

      const progress = () => `${connected}/${total} ✓`;
      setLabel(`Connect · ${progress()}`);

      for (let i = 0; i < ids.length; i += 1) {
        if (this._bulkConnectAbort) break;

        const result = await connectInstagramSilent(ids[i]);

        if (result.ok) {
          connected++;
          backoffMs = BACKOFF_START_MS;
        } else if (result.retryable) {
          // Rate-Limit: warten und denselben Creator erneut versuchen
          if (!this._bulkConnectAbort) {
            setLabel(`Rate-Limit – Pause ${Math.round(backoffMs / 1000)}s · ${progress()}`);
            await this._bulkConnectWait(backoffMs);
            backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
            i -= 1;
          }
          continue;
        }
        // nicht-retryable Fehler: einfach weiter zum nächsten Creator

        if (!this._bulkConnectAbort) {
          setLabel(`Connect · ${progress()}`);
          await this._bulkConnectWait(THROTTLE_MS);
        }
      }

      console.log(`✅ Bulk-Connect beendet: ${connected}/${total} verbunden`);
    } finally {
      this._bulkConnectRunning = false;
      this._bulkConnectAbort = false;
      await this._updateConnectAllCount();
    }
  }
  
  /**
   * Baut die Filter für Creator inkl. Suche
   */
  buildFilters() {
    const filters = super.buildFilters();
    
    // Suchbegriff als name-Filter hinzufügen (sucht in vorname UND nachname)
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      filters.name = this.searchQuery.trim();
    }
    if (!this.usesFilterColumn()) {
      if (this.groesseFilter?.length) filters.groesse = [...this.groesseFilter];
      if (this.generationFilter) filters.generation = this.generationFilter;
    }
    if (this.usesFilterColumn()) {
      const sort = normalizeSort(this.sort);
      filters._sort = sort;
      if (sort === 'follower') {
        filters._sortBy = 'instagram_follower';
        filters._sortOrder = 'desc';
      } else if (sort === 'rezension') {
        filters._sortBy = 'rezension_schnitt';
        filters._sortOrder = 'desc';
      }
    }

    return settleRezensionFilters(filters);
  }

  setSort(sort, { reload = true } = {}) {
    const next = normalizeSort(sort);
    this.sort = next;
    this.videoTage = next === 'video30' ? 30 : next === 'video90' ? 90 : 0;
    document.querySelectorAll('input[name="creator-sort"]').forEach((input) => {
      input.checked = input.value === next;
    });
    if (reload) this.loadData();
  }

  setFavoritVon(userId) {
    if (!userId) return;
    const current = { ...filterSystem.getFilters(this.entityType) };
    current.favorit_von = [userId];
    filterSystem.applyFilters(this.entityType, current);
    const column = document.getElementById('creator-filter-column');
    if (column && this._filterColumn) paintFilterValues(column, this._filterColumn.filters, current);
    this._filterColumn?.renderChips();
    this.pagination.currentPage = 1;
    this.loadDataDebounced(50);
  }

  onFiltersReset() {
    const column = document.getElementById('creator-filter-column');
    if (column && this._filterColumn) paintFilterValues(column, this._filterColumn.filters, {});
    filterSystem.resetFilters(this.entityType);
    this.pagination.currentPage = 1;
    this._filterColumn?.renderChips();
    this.loadDataDebounced(50);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // CREATOR-SPEZIFISCHE METHODEN
  // ══════════════════════════════════════════════════════════════════════════
  
  // Generische Tag-Render-Methode
  _renderTags(items, tagClass) {
    if (!items || items.length === 0) return '-';
    const arr = Array.isArray(items) ? items : [items];
    const sanitize = this.sanitize.bind(this);
    const tags = arr.map(item => {
      const label = typeof item === 'object' ? (item.name || item.label || item) : item;
      return `<span class="tag ${tagClass}">${sanitize(String(label).trim())}</span>`;
    }).join('');
    return `<div class="tags tags-compact">${tags}</div>`;
  }

  renderSprachenTags(sprachen) {
    return this._renderTags(sprachen, 'tag--lang');
  }

  renderBrancheTags(branchen) {
    return this._renderTags(branchen, 'tag--branche');
  }

  renderCreatorTypeTags(typen) {
    return this._renderTags(typen, 'tag--type');
  }

  renderLocationTag(value, type) {
    if (!value || (typeof value === 'string' && !value.trim())) return '-';
    const sanitized = this.sanitize(value);
    return `<span class="tag tag--${type}">${sanitized}</span>`;
  }

  formatAgeRange(min, max, legacy) {
    // Fallback auf altes alter_jahre Feld
    if (!min && !max && legacy) {
      return `${legacy}`;
    }
    if (!min && !max) return '-';
    if (min && max && min !== max) {
      return `${min}-${max}`;
    }
    return `${min || max}`;
  }
  
  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = filterSystem.getFilters('creator');
    return Object.keys(filters).length > 0;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // BULK DELETE
  // ══════════════════════════════════════════════════════════════════════════
  
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedItems.size;
    if (selectedCount === 0) {
      alert('Keine Creator ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie den ausgewählten Creator wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Creator wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.deleteSelectedCreators();
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedCreators();
    }
  }

  async deleteSelectedCreators() {
    const selectedIds = Array.from(this.selectedItems);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Creator...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      const result = await window.dataService.deleteEntities('creator', selectedIds);
      
      if (result.success) {
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Creator erfolgreich gelöscht.`);
        
        this.deselectAll();
        
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadData();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'creator', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      await this.loadData();
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // CREATE FORM (für Routing)
  // ══════════════════════════════════════════════════════════════════════════
  
  showCreateForm() {
    window.setHeadline('Neuen Creator anlegen');
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neuer Creator');
    }
    window.content.innerHTML = `
      <div class="form-page form-page--half">
        <form id="creator-instagram-start">
          <div class="form-field">
            <label for="creator-instagram-link">Instagram-Link</label>
            <input id="creator-instagram-link" name="instagram" type="url" class="form-input"
                   placeholder="https://instagram.com/…" required />
            <span class="form-hint">Gleicher Handle öffnet den vorhandenen Creator.</span>
          </div>
          <div class="form-actions">
            <button type="submit" class="mdc-btn mdc-btn--create">
              <span class="mdc-btn__label">Weiter</span>
            </button>
            <button type="button" class="mdc-btn mdc-btn--secondary" id="creator-skip-instagram">
              <span class="mdc-btn__label">Ohne Instagram-Link weiter</span>
            </button>
          </div>
        </form>
      </div>
    `;
    document.getElementById('creator-instagram-start')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.continueFromInstagram(event.target.instagram.value);
    });
    document.getElementById('creator-skip-instagram')?.addEventListener('click', () => {
      this.renderCreatorForm('');
    });
  }

  async continueFromInstagram(raw) {
    const handle = normalizeHandle(raw);
    if (handle && window.supabase) {
      const { data } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname, mail, telefonnummer, instagram, profilbild_url, ig_biography')
        .ilike('instagram', `%${handle}%`)
        .limit(20);
      const existing = (data || []).find((row) => normalizeHandle(row.instagram) === handle);
      if (existing) {
        await this.fillEmptyFromScrape(existing, raw);
        window.navigateTo(`/creator/${existing.id}`);
        return;
      }
    }
    this.renderCreatorForm(raw);
  }

  async fillEmptyFromScrape(existing, rawUrl) {
    try {
      const scraped = await creatorAuswahlService.scrapeCreator(rawUrl);
      const patch = {};
      const name = String(scraped?.name || '').trim();
      const [vorname, ...rest] = name.split(/\s+/);
      if (!existing.vorname && vorname) patch.vorname = vorname;
      if (!existing.nachname && rest.length) patch.nachname = rest.join(' ');
      if (!existing.instagram && (scraped?.handle || normalizeHandle(rawUrl))) {
        patch.instagram = scraped?.handle || normalizeHandle(rawUrl);
      }
      if (!existing.ig_biography && scraped?.bio) patch.ig_biography = scraped.bio;
      const photo = scraped?.profile_image_url || scraped?.profileImageUrl;
      if (!existing.profilbild_url && photo) patch.profilbild_url = photo;
      if (Object.keys(patch).length) {
        await window.dataService.updateEntity('creator', existing.id, patch);
      }
    } catch (error) {
      console.warn('Instagram-Daten konnten leere Felder nicht füllen', error);
    }
  }

  renderCreatorForm(instagramPrefill = '') {
    const formHtml = window.formSystem.renderFormOnly('creator');
    window.content.innerHTML = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
          </div>
        </div>
        <div class="form-split-right hidden" id="creator-split-container">
          <div id="creator-embedded-form"></div>
        </div>
      </div>
    `;

    window.formSystem.bindFormEvents('creator', null);
    injectFirmaCreateButton();

    const form = document.getElementById('creator-form');
    if (!form) return;
    const instagramField = form.querySelector('[name="instagram"]');
    if (instagramField && instagramPrefill) instagramField.value = instagramPrefill;
    bindGenerationControls(form);
    mountCreatorBetreuung(form);
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    };
    this.setupDuplicateValidation(form);
  }

  setupDuplicateValidation(form) {
    const vornameField = form.querySelector('#vorname, input[name="vorname"]');
    const nachnameField = form.querySelector('#nachname, input[name="nachname"]');
    
    if (!vornameField || !nachnameField) {
      console.warn('⚠️ CREATORLIST: Vorname- oder Nachname-Feld nicht gefunden');
      return;
    }

    let messageContainer = nachnameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      nachnameField.parentElement.appendChild(messageContainer);
    }

    [vornameField, nachnameField].forEach(field => {
      field.addEventListener('blur', async () => {
        const vorname = vornameField.value.trim();
        const nachname = nachnameField.value.trim();
        
        if (vorname && nachname) {
          await this.validateCreatorDuplicate(vorname, nachname, messageContainer);
        } else {
          this.clearDuplicateMessages(messageContainer);
        }
      });

      field.addEventListener('input', () => {
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      });
    });
  }

  async validateCreatorDuplicate(vorname, nachname, messageContainer) {
    if (!vorname || !nachname || vorname.trim().length < 1 || nachname.trim().length < 1) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) {
      console.warn('⚠️ CREATORLIST: DuplicateChecker nicht verfügbar');
      return;
    }

    try {
      const result = await window.duplicateChecker.checkCreator(vorname, nachname, null);

      if (result.exact) {
        this.showDuplicateError(messageContainer, result.similar);
        this.disableSubmitButton(true);
      } else if (result.similar.length > 0) {
        this.showDuplicateWarning(messageContainer, result.similar);
        this.enableSubmitButton();
      } else {
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      }
    } catch (error) {
      console.error('❌ CREATORLIST: Fehler bei Duplikat-Validierung:', error);
    }
  }

  showDuplicateError(container, entries) {
    const sanitize = this.sanitize.bind(this);
    const sanitizeImgUrl = (url) => window.validatorSystem?.sanitizeUrl(url);
    
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Creator existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => {
              const imgSource = entry.profilbild_thumb_url || entry.profilbild_url;
              const safeImgUrl = imgSource ? sanitizeImgUrl(imgSource) : null;
              return `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${sanitize(entry.id)}">
                  ${safeImgUrl ? `<img src="${safeImgUrl}" alt="${sanitize(entry.vorname)} ${sanitize(entry.nachname)}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${sanitize(entry.vorname)} ${sanitize(entry.nachname)}${entry.instagram ? ` <span class="duplicate-meta">(@${sanitize(entry.instagram)})</span>` : ''}</span>
                </a>
              </li>
            `;}).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    
    this.bindDuplicateLinks(container, 'creator');
  }

  showDuplicateWarning(container, entries) {
    const sanitize = this.sanitize.bind(this);
    const sanitizeImgUrl = (url) => window.validatorSystem?.sanitizeUrl(url);
    
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => {
            const imgSource = entry.profilbild_thumb_url || entry.profilbild_url;
            const safeImgUrl = imgSource ? sanitizeImgUrl(imgSource) : null;
            return `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${sanitize(entry.id)}">
                ${safeImgUrl ? `<img src="${safeImgUrl}" alt="${sanitize(entry.vorname)} ${sanitize(entry.nachname)}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${sanitize(entry.vorname)} ${sanitize(entry.nachname)}${entry.instagram ? ` <span class="duplicate-meta">(@${sanitize(entry.instagram)})</span>` : ''}</span>
              </a>
            </li>
          `;}).join('')}
        </ul>
      </div>
    `;
    
    this.bindDuplicateLinks(container, 'creator');
  }

  bindDuplicateLinks(container, entityType) {
    const links = container.querySelectorAll('.duplicate-link[data-entity-id]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id) {
          const route = `/${entityType}/${id}`;
          if (window.navigationSystem) {
            window.navigationSystem.navigateTo(route);
          }
        }
      });
    });
  }

  clearDuplicateMessages(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  disableSubmitButton(disable) {
    const form = document.getElementById('creator-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = disable;
        if (disable) {
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
      }
    }
  }

  enableSubmitButton() {
    const form = document.getElementById('creator-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  }

  async handleFormSubmit() {
    const btn = document.querySelector('.mdc-btn.mdc-btn--create');
    
    if (btn?.dataset.locked === 'true') return;
    if (btn) {
      btn.dataset.locked = 'true';
      btn.classList.add('is-loading');
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Wird angelegt…';
    }

    try {
      const form = document.getElementById('creator-form');
      const formData = new FormData(form);
      const submitData = {};

      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        
        let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
        }
        
        if (!hiddenSelect) {
          const tagContainer = form.querySelector(`select[name="${fieldName}"]`)?.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = Array.from(tags).map(tag => tag.dataset.value).filter(Boolean);
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
          if (values.length > 0) {
            submitData[fieldName] = values;
          }
        }
      });

      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            submitData[key] = value;
          }
        }
      }

      // Checkboxes/Toggles explizit als Boolean setzen (auch wenn nicht angehakt)
      const toggleInputs = form.querySelectorAll('input[type="checkbox"][name]');
      toggleInputs.forEach(input => {
        submitData[input.name] = input.checked;
      });

      for (const [key, value] of Object.entries(submitData)) {
        if (Array.isArray(value)) {
          submitData[key] = [...new Set(value)];
        }
      }

      const validation = window.validatorSystem.validateForm(submitData, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true },
        mail: { type: 'email' },
        telefonnummer: { type: 'phone' },
        portfolio_link: { type: 'url' }
      });
      
      const mail = String(submitData.mail || '').trim();
      const phone = String(submitData.telefonnummer || '').trim();
      const phoneMissing = submitData.telefon_nicht_vorhanden === true;
      if (!mail) validation.errors = { ...(validation.errors || {}), mail: 'Mail ist Pflicht' };
      if (!phone && !phoneMissing) {
        validation.errors = { ...(validation.errors || {}), telefonnummer: 'Telefon ist Pflicht, oder „nicht vorhanden“' };
      }
      if (!mail || (!phone && !phoneMissing)) validation.isValid = false;

      if (!validation.isValid) {
        if (btn) {
          btn.dataset.locked = 'false';
          btn.classList.remove('is-loading');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Anlegen';
        }
        this.showValidationErrors(validation.errors);
        return;
      }

      const result = await window.dataService.createEntity('creator', submitData);

      if (result.success) {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.classList.add('is-success');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Creator angelegt';
        }
        
        this.showSuccessMessage('Creator erfolgreich erstellt!');
        await syncCreatorBetreuung(result.id, form);
        await this.auslesenWennNeu(result.id, '', submitData.instagram);

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'creator', id: result.id, action: 'created' }
        }));
        window.navigateTo('/creator');
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      if (btn) {
        btn.dataset.locked = 'false';
        btn.classList.remove('is-loading');
        const labelEl = btn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Anlegen';
      }
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }

  async auslesenWennNeu(creatorId, before, after) {
    const next = normalizeHandle(after);
    if (!creatorId || !next || next === normalizeHandle(before)) return;
    window.toastSystem?.show('Instagram-Daten werden geladen', 'info');
    const result = await connectInstagramSilent(creatorId);
    if (!result?.ok) window.toastSystem?.show('Instagram konnte nicht ausgelesen werden', 'error');
  }

  showValidationErrors(errors) {
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        fieldElement.parentNode.appendChild(errorElement);
      }
    });
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.parentNode.insertBefore(successDiv, form);
    }
  }

  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    
    const form = document.getElementById('creator-form');
    if (form) {
      form.parentNode.insertBefore(errorDiv, form);
    }
  }
}

// Exportiere Instanzen für globale Nutzung
export const creatorList = new CreatorList({ mode: 'all' });
export const managementCreatorList = new CreatorList({ mode: 'management' });
