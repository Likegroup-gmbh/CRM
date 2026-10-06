// ProduktionList.js
// Globale Liste aller Produktionen. Nav, Breadcrumb und Headline heißen Produktion.

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { resolveEmptyState } from '../../core/components/EmptyState.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import {
  namedLinks,
  produktLinksFromJunction,
  renderVerknuepfungen,
  skriptLinks,
  vertragLinks
} from '../../core/ui/tableVerknuepfungen.js';
import { renderLeistungszeitraumCell } from '../../core/utils/leistungszeitraum.js';
import { replaceRoute } from '../../core/breadcrumbTrail.js';
import { listAllProduktionen } from './ProduktionService.js';
import { verbrauchZeilenProKampagne } from './produktionsbudget.js';
import { bindDragToScroll, destroyDragToScroll } from '../kampagne/KampagneListUtils.js';
import {
  buildCompanyFolders,
  buildBrandFolders,
  buildCampaignFolders,
  buildCurrentItems,
  markenEbeneWeg,
  NUR_UNTERNEHMEN_LABEL,
  OHNE_QUERY
} from './ProduktionFolders.js';
import {
  BACK_BUTTON_ID,
  toolbarHtml,
  renderFolderLevel,
  fillFolderGrids
} from './ProduktionFolderRenderer.js';

const COLUMN_COUNT = 12;
const BASE_PATH = '/produktionen';
const LEVEL_ID = 'produktion-level';

function selectorId(id) {
  const value = String(id);
  if (!/^[\w-]+$/.test(value)) return null;
  return value;
}

function esc(value) {
  const text = String(value ?? '');
  return window.validatorSystem?.sanitizeHtml(text) ?? text;
}

function renderBudget(eigenesBudget) {
  if (eigenesBudget == null) return '<span class="text-muted">–</span>';
  return KampagneUtils.formatCurrency(eigenesBudget);
}

function renderVerbrauch(used, total) {
  if (used == null) return '<span class="text-muted budget-pending">…</span>';
  if (total <= 0) return '<span class="text-muted">–</span>';
  const amount = parseFloat(used) || 0;
  const pct = KampagneUtils.getProgressPercentage(amount, total);
  let colorClass = '';
  if (pct >= 90) colorClass = 'summary-progress-fill--danger';
  else if (pct >= 75) colorClass = 'summary-progress-fill--warning';
  return `
    <div class="budget-progress-cell">
      <div class="summary-progress">
        <div class="summary-progress-fill ${colorClass}" style="width: ${pct}%"></div>
      </div>
      <span class="budget-progress-label">${KampagneUtils.formatCurrency(amount)} · ${pct}%</span>
    </div>`;
}

function textBits(values) {
  const bits = [];
  const walk = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const text = String(value).trim();
    if (text) bits.push(text.toLowerCase());
  };
  walk(values);
  return bits;
}

export function matchesProduktionSearch(produktion, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;
  const briefings = briefingsOf(produktion);
  const haystack = textBits([
    produktion?.name,
    produktion?.kampagne?.eigener_name,
    produktion?.kampagne?.kampagnenname,
    produktion?.produkt?.name,
    briefings.map(b => b?.aktivierung_name),
    briefings.flatMap(b => (b?.produkte || []).map(row => row?.produkt?.name)),
    briefings.flatMap(b => (b?.verknuepfte_personas || []).map(persona => persona?.name)),
    (produktion?.creator_auswahl || []).map(casting => casting?.name),
    (produktion?.strategie || []).map(konzept => konzept?.name),
    (produktion?.skripte || []).map(skript => skript?.titel || skript?.hook),
    (produktion?.vertraege || []).map(vertrag => vertrag?.name)
  ]);
  return haystack.some(value => value.includes(needle));
}

// Eine Produktion hat mehrere Briefings (Linien); ältere Zeilen tragen nur `briefing`.
function briefingsOf(produktion) {
  if (Array.isArray(produktion?.briefings) && produktion.briefings.length) return produktion.briefings;
  return produktion?.briefing ? [produktion.briefing] : [];
}

function produktionProduktLinks(produktion) {
  const links = produktLinksFromJunction(briefingsOf(produktion).flatMap(b => b?.produkte || []));
  const own = produktion?.produkt;
  if (own?.id && own?.name && !links.some(item => String(item.id) === String(own.id))) {
    links.unshift({ id: own.id, label: own.name, kind: 'produkt' });
  }
  return links;
}

function renderRow(produktion, zeile) {
  const briefingName = briefingsOf(produktion).map(b => b?.aktivierung_name).filter(Boolean).join(', ');
  const name = produktion.name || briefingName || 'Produktion';
  const briefing = briefingName || '–';
  const kampagne = produktion.kampagne;
  const kampagneLabel = kampagne?.id
    ? `<a href="/kampagne/${kampagne.id}" class="table-link" data-table="kampagne" data-id="${kampagne.id}">${esc(KampagneUtils.getDisplayName(kampagne))}</a>`
    : '–';
  return `
    <tr>
      <td><a href="/produktion/${produktion.id}" class="table-link" data-table="produktion" data-id="${produktion.id}">${esc(name)}</a></td>
      <td>${kampagneLabel}</td>
      ${renderLeistungszeitraumCell(kampagne)}
      <td>${renderVerknuepfungen(produktionProduktLinks(produktion))}</td>
      <td>${esc(briefing)}</td>
      <td>${renderVerknuepfungen(namedLinks(briefingsOf(produktion).flatMap(b => b?.verknuepfte_personas || []), { labelKey: 'name', kind: 'persona' }))}</td>
      <td>${renderVerknuepfungen(namedLinks(produktion.creator_auswahl, { labelKey: 'name', kind: 'casting' }))}</td>
      <td>${renderVerknuepfungen(namedLinks(produktion.strategie, { labelKey: 'name', kind: 'konzept' }))}</td>
      <td>${renderVerknuepfungen(skriptLinks(produktion.skripte))}</td>
      <td>${renderVerknuepfungen(vertragLinks(produktion.vertraege))}</td>
      <td>${renderBudget(zeile?.eigenesBudget)}</td>
      <td>${renderVerbrauch(zeile?.used ?? null, zeile?.total ?? 0)}</td>
    </tr>`;
}

export function renderProduktionBody(produktionen, searchQuery = '') {
  const visible = (produktionen || []).filter(row => matchesProduktionSearch(row, searchQuery));
  // Geteilter Topf rechnet über alle Produktionen der Kampagne, nicht nur
  // über die per Suche sichtbaren Zeilen.
  const zeilen = verbrauchZeilenProKampagne(produktionen || []);
  if (visible.length) return visible.map(row => renderRow(row, zeilen.get(row.id))).join('');
  return `<tr><td colspan="${COLUMN_COUNT}" class="empty-state-cell">${resolveEmptyState({
    hasActiveFilters: Boolean(String(searchQuery || '').trim()),
    states: {
      default: {
        icon: 'list',
        title: 'Noch keine Produktion',
        text: 'Produktionen entstehen mit dem Briefing einer Kampagne.'
      }
    }
  }, 'default')}</td></tr>`;
}

const TABLE_HEADERS = `
  <th>Produktion</th>
  <th>Kampagne</th>
  <th class="col-leistungszeitraum">Leistungszeitraum</th>
  <th>Produkte</th>
  <th>Briefing</th>
  <th>Personas</th>
  <th>Casting</th>
  <th>Konzept</th>
  <th>Skripte</th>
  <th>Verträge</th>
  <th>Budget</th>
  <th>Verbrauch</th>`;

export function renderProduktionTableHtml(produktionen, searchQuery = '') {
  return `
    <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>${TABLE_HEADERS}
            </tr>
          </thead>
          <tbody id="produktion-table-body">
            ${renderProduktionBody(produktionen, searchQuery)}
          </tbody>
        </table>
    </div>`;
}

export function renderProduktionListHtml(produktionen, { searchQuery = '' } = {}) {
  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${SearchInput.render('produktion', {
            placeholder: 'Produktion, Kampagne, Produkt, Briefing…',
            currentValue: searchQuery
          })}
        </div>
      </div>
    </div>
    ${renderProduktionTableHtml(produktionen, searchQuery)}`;
}

export class ProduktionList {
  constructor() {
    this._abort = null;
    this.rows = [];
    this.searchQuery = '';
    this._shellReady = false;
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;

    this.viewMode = 'companies';
    this.listViewMode = 'grid';
    this.resetFolder();

    this.companyFolders = [];
    this.brandFolders = [];
    this.campaignFolders = [];
    this.currentItems = [];
  }

  sanitize(value) {
    return esc(value);
  }

  resetFolder() {
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.currentMarkeId = null;
    this.currentMarkeName = null;
    this._ohneMarke = false;
    this.currentKampagneId = null;
    this.currentKampagneName = null;
  }

  // ---------------------------------------------------------------
  // Pfad: Query <-> Zustand
  // ---------------------------------------------------------------

  applyQueryParams(params) {
    this.resetFolder();
    this.viewMode = 'companies';

    const unternehmenId = params.get('unternehmen');
    if (!unternehmenId) return;
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = params.get('unternehmen_name') || 'Unternehmen';
    this.viewMode = 'brands';

    const marke = params.get('marke');
    if (!marke) return;
    if (marke === OHNE_QUERY) {
      this._ohneMarke = true;
      this.currentMarkeName = NUR_UNTERNEHMEN_LABEL;
    } else {
      this.currentMarkeId = marke;
      this.currentMarkeName = params.get('marke_name') || 'Marke';
    }
    this.viewMode = 'campaigns';

    const kampagne = params.get('kampagne');
    if (!kampagne) return;
    this.currentKampagneId = kampagne;
    this.currentKampagneName = params.get('kampagne_name') || 'Kampagne';
    this.viewMode = 'items';
  }

  listUrl(level = this.viewMode) {
    if (level === 'companies' || !this.currentUnternehmenId) return BASE_PATH;

    const params = new URLSearchParams();
    params.set('unternehmen', this.currentUnternehmenId);
    params.set('unternehmen_name', this.currentUnternehmenName || '');
    if (level === 'brands') return `${BASE_PATH}?${params}`;

    if (this._ohneMarke) {
      params.set('marke', OHNE_QUERY);
      params.set('marke_name', NUR_UNTERNEHMEN_LABEL);
    } else if (this.currentMarkeId) {
      params.set('marke', this.currentMarkeId);
      params.set('marke_name', this.currentMarkeName || '');
    }
    if (level === 'campaigns') return `${BASE_PATH}?${params}`;

    if (this.currentKampagneId) {
      params.set('kampagne', this.currentKampagneId);
      params.set('kampagne_name', this.currentKampagneName || '');
    }
    return `${BASE_PATH}?${params}`;
  }

  syncUrl() {
    const url = this.listUrl();
    replaceRoute(url);
  }

  isSearching() {
    return Boolean(String(this.searchQuery || '').trim());
  }

  // Marken-Ebene entfällt, wenn das Unternehmen keine echte Marke hat.
  markenEbeneWeg() {
    if (!this._ohneMarke || !this.currentUnternehmenId) return false;
    if (this.viewMode !== 'campaigns' && this.viewMode !== 'items') return false;
    return markenEbeneWeg(this.rows, this.currentUnternehmenId);
  }

  updateBreadcrumb() {
    if (!window.breadcrumbSystem) return;
    const root = (clickable) => ({ label: 'Produktion', url: BASE_PATH, clickable });

    if (this.isSearching() || this.viewMode === 'companies') {
      window.breadcrumbSystem.updateBreadcrumb([root(false)]);
      return;
    }

    const firma = (url, clickable) => ({
      label: this.currentUnternehmenName || 'Unternehmen',
      url,
      clickable
    });
    const crumbs = [root(true)];
    const wegGefallen = this.markenEbeneWeg();

    if (this.viewMode === 'brands' || (this.viewMode === 'campaigns' && wegGefallen)) {
      crumbs.push(firma('#', false));
    } else if (this.viewMode === 'campaigns') {
      crumbs.push(firma(this.listUrl('brands'), true));
      crumbs.push({ label: this.currentMarkeName || NUR_UNTERNEHMEN_LABEL, url: '#', clickable: false });
    } else {
      if (wegGefallen) {
        crumbs.push(firma(this.listUrl('campaigns'), true));
      } else {
        crumbs.push(firma(this.listUrl('brands'), true));
        crumbs.push({
          label: this.currentMarkeName || NUR_UNTERNEHMEN_LABEL,
          url: this.listUrl('campaigns'),
          clickable: true
        });
      }
      crumbs.push({ label: this.currentKampagneName || 'Kampagne', url: '#', clickable: false });
    }
    window.breadcrumbSystem.updateBreadcrumb(crumbs);
  }

  // ---------------------------------------------------------------
  // Ebenen wechseln
  // ---------------------------------------------------------------

  switchToCompanies() {
    this.resetFolder();
    this.viewMode = 'companies';
    this.renderLevel();
  }

  switchToBrands(unternehmenId, unternehmenName) {
    this.resetFolder();
    this.viewMode = 'brands';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.renderLevel();
  }

  switchToCampaigns(markeId, markeName, { ohneMarke = false } = {}) {
    this.viewMode = 'campaigns';
    this._ohneMarke = ohneMarke;
    this.currentMarkeId = ohneMarke ? null : markeId;
    this.currentMarkeName = ohneMarke ? NUR_UNTERNEHMEN_LABEL : (markeName || 'Marke');
    this.currentKampagneId = null;
    this.currentKampagneName = null;
    this.renderLevel();
  }

  switchToItems(kampagneId, kampagneName) {
    this.viewMode = 'items';
    this.currentKampagneId = kampagneId;
    this.currentKampagneName = kampagneName || 'Kampagne';
    this.renderLevel();
  }

  goBack() {
    if (this.viewMode === 'items') {
      this.switchToCampaigns(this.currentMarkeId, this.currentMarkeName, { ohneMarke: this._ohneMarke });
    } else if (this.viewMode === 'campaigns') {
      if (this.markenEbeneWeg()) this.switchToCompanies();
      else this.switchToBrands(this.currentUnternehmenId, this.currentUnternehmenName);
    } else if (this.viewMode === 'brands') {
      this.switchToCompanies();
    }
  }

  openFolder(dataset) {
    const level = dataset.folderLevel;
    if (level === 'companies') {
      this.switchToBrands(dataset.unternehmenId, dataset.unternehmenName);
    } else if (level === 'brands') {
      if (dataset.ohneMarke === '1') this.switchToCampaigns(null, dataset.markeName, { ohneMarke: true });
      else this.switchToCampaigns(dataset.markeId, dataset.markeName);
    } else if (level === 'campaigns') {
      this.switchToItems(dataset.kampagneId, dataset.kampagneName);
    }
  }

  setListViewMode(mode) {
    if (this.listViewMode === mode) return;
    this.listViewMode = mode;
    this.renderLevel();
  }

  // ---------------------------------------------------------------
  // Laden und Rendern
  // ---------------------------------------------------------------

  async init() {
    window.setHeadline?.('Produktion');
    this._abort?.abort();
    this._abort = new AbortController();
    this._shellReady = false;
    this.rows = [];
    this.searchQuery = '';
    this.applyQueryParams(new URLSearchParams(window.location.search));
    const signal = this._abort.signal;

    const canView = window.canViewPage?.('kooperation')
      || await window.checkUserPermission?.('kooperation', 'can_view');
    if (signal.aborted) return;
    if (!canView) {
      window.setContentSafely?.(window.content, `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Produktionen anzuzeigen.</p>
        </div>
      `);
      return;
    }

    try {
      const produktionen = await listAllProduktionen({
        onRows: (rows) => {
          if (signal.aborted) return;
          this.rows = rows || [];
          this.renderShell();
        }
      });
      if (signal.aborted) return;
      this.patchVerbrauch(produktionen);
    } catch (error) {
      if (signal.aborted) return;
      window.ErrorHandler?.handle(error, 'ProduktionList.init');
    }
  }

  renderShell() {
    if (this._abort?.signal.aborted) return;
    if (!this._shellReady) {
      window.setContentSafely?.(window.content, `
        <div class="list-container">
          ${toolbarHtml(this)}
          <div id="${LEVEL_ID}"></div>
        </div>
      `);
      this._shellReady = true;
      this.bindEvents();
    }
    this.renderLevel();
  }

  // Marken-Ebene überspringen und die Listen der aktuellen Ebene bauen.
  buildCurrentLevel() {
    if (this.viewMode === 'brands' && markenEbeneWeg(this.rows, this.currentUnternehmenId)) {
      this.viewMode = 'campaigns';
      this._ohneMarke = true;
      this.currentMarkeId = null;
      this.currentMarkeName = NUR_UNTERNEHMEN_LABEL;
      this.currentKampagneId = null;
      this.currentKampagneName = null;
    }

    const scope = {
      unternehmenId: this.currentUnternehmenId,
      markeId: this.currentMarkeId,
      ohneMarke: this._ohneMarke
    };
    if (this.viewMode === 'companies') this.companyFolders = buildCompanyFolders(this.rows);
    else if (this.viewMode === 'brands') this.brandFolders = buildBrandFolders(this.rows, this.currentUnternehmenId);
    else if (this.viewMode === 'campaigns') this.campaignFolders = buildCampaignFolders(this.rows, scope);
    else this.buildCurrentItems();
  }

  buildCurrentItems() {
    this.currentItems = buildCurrentItems(this.rows, {
      unternehmenId: this.currentUnternehmenId,
      markeId: this.currentMarkeId,
      ohneMarke: this._ohneMarke,
      kampagneId: this.currentKampagneId
    });
  }

  tableRows() {
    return this.isSearching() ? this.rows : this.currentItems;
  }

  levelHtml() {
    if (this.isSearching() || this.viewMode === 'items') {
      return renderProduktionTableHtml(this.tableRows(), this.searchQuery);
    }
    return renderFolderLevel(this, this.viewMode);
  }

  renderLevel() {
    if (this._abort?.signal.aborted) return;
    const host = window.content?.querySelector(`#${LEVEL_ID}`);
    if (!host) return;

    if (!this.isSearching()) this.buildCurrentLevel();

    destroyDragToScroll(this);
    host.innerHTML = this.levelHtml();
    fillFolderGrids(host);
    bindDragToScroll(this);

    this.syncToolbar();
    this.updateBreadcrumb();
    this.syncUrl();
  }

  syncToolbar() {
    const root = window.content;
    if (!root) return;
    const back = root.querySelector(`#${BACK_BUTTON_ID}`);
    if (back) {
      back.style.display = !this.isSearching() && this.viewMode !== 'companies' ? '' : 'none';
    }
    root.querySelector('#btn-view-list')?.classList.toggle('active', this.listViewMode === 'list');
    root.querySelector('#btn-view-grid')?.classList.toggle('active', this.listViewMode === 'grid');
  }

  renderBody() {
    const tbody = window.content?.querySelector('#produktion-table-body');
    if (!tbody) return;
    tbody.innerHTML = renderProduktionBody(this.tableRows(), this.searchQuery);
  }

  onSearch(value) {
    const wasSearching = this.isSearching();
    this.searchQuery = value;
    if (wasSearching && this.isSearching()) this.renderBody();
    else this.renderLevel();
  }

  patchVerbrauch(produktionen) {
    if (this._abort?.signal.aborted) return;
    this.rows = produktionen || [];
    if (!this.isSearching() && this.viewMode === 'items') this.buildCurrentItems();
    const root = window.content;
    if (!root) return;
    const zeilen = verbrauchZeilenProKampagne(this.rows);
    for (const produktion of this.rows) {
      const zeile = produktion?.id != null ? zeilen.get(produktion.id) : null;
      if (!zeile || zeile.used == null) continue;
      const id = selectorId(produktion.id);
      if (!id) continue;
      const link = root.querySelector(
        `a.table-link[data-table="produktion"][data-id="${id}"]`
      );
      const cell = link?.closest('tr')?.lastElementChild;
      if (!cell) continue;
      cell.innerHTML = renderVerbrauch(zeile.used, zeile.total);
    }
  }

  bindEvents() {
    const signal = this._abort?.signal;
    if (!signal || signal.aborted) return;
    SearchInput.bind('produktion', (value) => this.onSearch(value), signal);
    window.content?.addEventListener('click', (event) => {
      const target = event.target;

      const reset = target.closest?.('[data-empty-action="reset-filters"]');
      if (reset) {
        event.preventDefault();
        const input = document.getElementById('produktion-search-input');
        const clearBtn = document.getElementById('produktion-search-clear');
        if (input) input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        this.onSearch('');
        return;
      }

      if (target.closest?.('#btn-view-list')) {
        event.preventDefault();
        this.setListViewMode('list');
        return;
      }
      if (target.closest?.('#btn-view-grid')) {
        event.preventDefault();
        this.setListViewMode('grid');
        return;
      }
      if (target.closest?.(`#${BACK_BUTTON_ID}`)) {
        event.preventDefault();
        this.goBack();
        return;
      }

      const folder = target.closest?.('[data-folder-level]');
      if (folder) {
        event.preventDefault();
        this.openFolder(folder.dataset);
        return;
      }

      const link = target.closest?.('a.table-link[data-id]');
      if (!link || link.classList.contains('table-link--rel')) return;
      const id = link.dataset.id;
      if (link.dataset.table === 'produktion') {
        event.preventDefault();
        window.navigateTo(`/produktion/${id}`);
      } else if (link.dataset.table === 'kampagne') {
        event.preventDefault();
        window.navigateTo(`/kampagne/${id}`);
      }
    }, { signal });
  }

  destroy() {
    this._abort?.abort();
    this._abort = null;
    this._shellReady = false;
    destroyDragToScroll(this);
  }
}

export const produktionList = new ProduktionList();
