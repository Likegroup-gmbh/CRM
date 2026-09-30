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
import { listAllProduktionen } from './ProduktionService.js';
import { verbrauchZeilenProKampagne } from './produktionsbudget.js';
import { bindDragToScroll, destroyDragToScroll } from '../kampagne/KampagneListUtils.js';

const COLUMN_COUNT = 11;

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
  const briefing = produktion?.briefing;
  const haystack = textBits([
    produktion?.name,
    produktion?.kampagne?.eigener_name,
    produktion?.kampagne?.kampagnenname,
    produktion?.produkt?.name,
    briefing?.aktivierung_name,
    (briefing?.produkte || []).map(row => row?.produkt?.name),
    (briefing?.verknuepfte_personas || []).map(persona => persona?.name),
    (produktion?.creator_auswahl || []).map(casting => casting?.name),
    (produktion?.strategie || []).map(konzept => konzept?.name),
    (produktion?.skripte || []).map(skript => skript?.titel || skript?.hook),
    (produktion?.vertraege || []).map(vertrag => vertrag?.name)
  ]);
  return haystack.some(value => value.includes(needle));
}

function produktionProduktLinks(produktion) {
  const links = produktLinksFromJunction(produktion?.briefing?.produkte);
  const own = produktion?.produkt;
  if (own?.id && own?.name && !links.some(item => String(item.id) === String(own.id))) {
    links.unshift({ id: own.id, label: own.name, kind: 'produkt' });
  }
  return links;
}

function renderRow(produktion, zeile) {
  const briefingName = produktion.briefing?.aktivierung_name || '';
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
      <td>${renderVerknuepfungen(produktionProduktLinks(produktion))}</td>
      <td>${esc(briefing)}</td>
      <td>${renderVerknuepfungen(namedLinks(produktion.briefing?.verknuepfte_personas, { labelKey: 'name', kind: 'persona' }))}</td>
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
    <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produktion</th>
              <th>Kampagne</th>
              <th>Produkte</th>
              <th>Briefing</th>
              <th>Personas</th>
              <th>Casting</th>
              <th>Konzept</th>
              <th>Skripte</th>
              <th>Verträge</th>
              <th>Budget</th>
              <th>Verbrauch</th>
            </tr>
          </thead>
          <tbody id="produktion-table-body">
            ${renderProduktionBody(produktionen, searchQuery)}
          </tbody>
        </table>
    </div>`;
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
  }

  async init() {
    window.setHeadline?.('Produktion');
    this._abort?.abort();
    this._abort = new AbortController();
    this._shellReady = false;
    this.rows = [];
    this.searchQuery = '';
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
      window.setContentSafely?.(window.content, renderProduktionListHtml(this.rows, {
        searchQuery: this.searchQuery
      }));
      this._shellReady = true;
      this.bindEvents();
      return;
    }
    this.renderBody();
  }

  renderBody() {
    const tbody = window.content?.querySelector('#produktion-table-body');
    if (!tbody) return;
    tbody.innerHTML = renderProduktionBody(this.rows, this.searchQuery);
  }

  patchVerbrauch(produktionen) {
    if (this._abort?.signal.aborted) return;
    this.rows = produktionen || [];
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
    bindDragToScroll(this);
    SearchInput.bind('produktion', (value) => {
      this.searchQuery = value;
      this.renderBody();
    }, signal);
    window.content?.addEventListener('click', (event) => {
      const reset = event.target.closest?.('[data-empty-action="reset-filters"]');
      if (reset) {
        event.preventDefault();
        this.searchQuery = '';
        const input = document.getElementById('produktion-search-input');
        const clearBtn = document.getElementById('produktion-search-clear');
        if (input) input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        this.renderBody();
        return;
      }
      const link = event.target.closest?.('a.table-link[data-id]');
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
