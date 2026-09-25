// AusgangsrechnungenList.js
// Kundenrechnung-Liste. Eigenes Modul, kein AuftragList.

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { defaultReNrPrefix, isBareReNrPrefix } from '../auftrag/logic/PrefixedNumberSort.js';
import {
  ALL_TAB,
  NO_RENR_TAB,
  UNDATED_TAB,
  formatMonthEmptyText,
  getCurrentMonthSelection,
  parseMonthTab
} from '../auftrag/logic/InvoiceMonthFilter.js';
import { renderInvoiceMonthSheet, updateInvoiceMonthTabUI } from '../auftrag/logic/InvoiceMonthSheet.js';
import { ENTITY_KUNDENRECHNUNG, isFinalAuftrag as isFinalAuftragRow, loadCounts, loadRows } from '../rechnung/Monatsblatt.js';
import { animateNumber } from '../../core/animation/animateNumber.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { getPaymentRowStatusClass, sumPaidInvoiceRows } from '../auftrag/logic/PaymentRowStatus.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { AuftragCashFlowCalendar } from '../auftrag/AuftragCashFlowCalendar.js';

export function isFinalAuftrag(row) {
  return isFinalAuftragRow(row);
}

export function visibleContractRows(rows, { usesPagination, page = 1, limit = 25 } = {}) {
  const list = rows || [];
  if (usesPagination === false) return list;
  const from = (page - 1) * limit;
  return list.slice(from, from + limit);
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: 0, maximumFractionDigits: 0
});
const CHECK_ICON = `${icon('check-bold')}`;
const CROSS_ICON = `${icon('x-mark')}`;

export class AusgangsrechnungenList {
  constructor() {
    this.selectedAuftraege = new Set();
    this.currentView = 'list';
    this.activeTab = 'auftraege';
    this.cashFlowCalendar = null;
    this.searchQuery = '';
    this._searchDebounceTimer = null;
    this._abortController = null;
    this._loadRequestId = 0;
    this._isAdmin = null;
    this._isKunde = null;
    this.rechnungen = [];
    this._blattCounts = { months: { undated: 0, 'no-renr': 0, alle: 0, months: Array(12).fill(0) } };
    this.statusOptions = [
      { id: 'Beauftragt', name: 'Beauftragt' },
      { id: 'Abgeschlossen', name: 'Abgeschlossen' },
      { id: 'Storniert', name: 'Storniert' }
    ];
    this.resetToCurrentMonth();
  }

  get isAdmin() {
    if (this._isAdmin === null) this._isAdmin = window.isAdmin();
    return this._isAdmin;
  }

  get isKunde() {
    if (this._isKunde === null) this._isKunde = window.isKunde();
    return this._isKunde;
  }

  resetToCurrentMonth() {
    const { year, month } = getCurrentMonthSelection();
    this.currentYear = year;
    this.currentMonth = month;
  }

  async init() {
    this.resetToCurrentMonth();
    window.setHeadline('Kundenrechnungen');
    window.bulkActionSystem?.registerList('auftrag', this);

    if (this.isKunde && window.supabase) {
      const { count } = await window.supabase
        .from('kunde_marke')
        .select('*', { count: 'exact', head: true })
        .eq('kunde_id', window.currentUser.id);
      this._kundeHasMultipleMarken = (count || 0) > 1;
    } else {
      this._kundeHasMultipleMarken = false;
    }

    await this.render();
    this.bindEvents();
    this.initializeFilterBar();
    await this.reloadBlatt({ withCounts: true, firstPaint: true });
    this.refreshInactiveTabCount();
  }

  async render() {
    window.setHeadline('Kundenrechnungen');
    const isContracts = this.activeTab === 'contracts';
    window.setContentSafely(window.content, '<div id="page-tab-content" class="kundenrechnungen-page"></div>');
    this.renderAuftraegeContent();
    if (!isContracts && this.currentView === 'calendar') {
      await this.initCashFlowCalendar();
    }
  }

  _renderPageHeader(isContracts, { withFilters = false } = {}) {
    const viewToggleDisabled = isContracts ? 'disabled' : '';
    const filterDropdownStyle = isContracts ? 'style="display:none;"' : '';
    const placeholder = isContracts ? 'Contract suchen...' : 'Auftrag suchen...';

    const filtersLeft = withFilters ? `
      <div class="page-header-left">
        ${SearchInput.render('auftrag', {
          placeholder,
          currentValue: this.searchQuery
        })}
        ${!this.isKunde ? `<div id="filter-dropdown-container" ${filterDropdownStyle}></div>` : ''}
      </div>
    ` : '';

    const tableActions = withFilters ? `
      <div class="table-actions">
        ${this.isAdmin ? '<button id="btn-select-all" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>' : ''}
        ${this.isAdmin ? '<button id="btn-deselect-all" class="mdc-btn mdc-btn--secondary" style="display:none;">Auswahl aufheben</button>' : ''}
        <span id="selected-count" style="display:none;">0 ausgewählt</span>
        ${this.isAdmin ? '<button id="btn-delete-selected" class="mdc-btn mdc-btn--delete" style="display:none;">Ausgewählte löschen</button>' : ''}
      </div>
    ` : '';

    return `
      <div class="page-header">
        ${filtersLeft}
        <div class="page-header-right">
          ${tableActions}
          <div class="view-toggle">
            <button id="btn-view-list" class="mdc-btn mdc-btn--secondary ${this.currentView === 'list' ? 'active' : ''}" ${viewToggleDisabled}>${icon('table-grid')} Liste</button>
            <button id="btn-view-calendar" class="mdc-btn mdc-btn--secondary ${this.currentView === 'calendar' ? 'active' : ''}" ${viewToggleDisabled}>${icon('calendar-days')} Kalender</button>
          </div>
        </div>
      </div>
    `;
  }

  renderAuftraegeContent() {
    const container = document.getElementById('page-tab-content');
    if (!container) return;

    const isContracts = this.activeTab === 'contracts';

    if (this.currentView === 'calendar') {
      container.innerHTML = `
        <div class="kr-sticky-head">${this._renderPageHeader(isContracts)}</div>
        <div class="kr-scroll-body">
          <div id="auftrag-content-container">
            <div id="calendar-container"></div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="kr-sticky-head">
        ${this._renderPageHeader(isContracts, { withFilters: true })}
        ${this.renderTabNavigation()}
      </div>

      <div class="kr-scroll-body">
        ${this.renderInvoiceSummaryCards()}
        <div id="auftrag-table-wrapper">
          ${this.renderListView(isContracts ? 'contracts' : 'auftraege')}
        </div>
      </div>

      ${isContracts ? '' : `<div class="kr-sticky-foot">${this.renderMonthSheet()}</div>`}
    `;
  }

  renderTabNavigation() {
    if (!window.canViewContracts?.()) return '';
    const isContracts = this.activeTab === 'contracts';
    return `
      <div class="tab-navigation auftrag-tabs">
        <button class="tab-button ${!isContracts ? 'active' : ''}" data-tab="auftraege">
          Aufträge<span class="tab-count" data-tab-count="auftraege">0</span>
        </button>
        <button class="tab-button ${isContracts ? 'active' : ''}" data-tab="contracts">
          Contracts<span class="tab-count" data-tab-count="contracts">0</span>
        </button>
      </div>
    `;
  }

  getListColumnCount() {
    if (this.isKunde) return 18;
    return 19;
  }

  renderListView(mode = 'auftraege') {
    const isContracts = mode === 'contracts';
    const loadingText = 'Lade Kundenrechnungen...';
    const tableClass = isContracts ? 'auftrag-table contracts-table' : 'auftrag-table';

    return `
    <div class="table-container" id="auftrag-table-container">
        <table class="data-table ${tableClass}">
          <thead>
            <tr>
              <th class="col-unternehmen">Unternehmen</th>
              <th class="col-marke">Marke</th>
              <th class="col-angebotsnr">Angebotsnummer</th>
              <th class="col-rechnungsnr">RE-Nr.</th>
              <th class="col-teilrechnung">Teilrechnung</th>
              <th class="col-externe-po">Externe PO</th>
              <th class="col-rechnung-gestellt">RE-Datum</th>
              <th class="col-zahlungsziel">Zahlungsziel</th>
              <th class="col-re-faelligkeit">Fällig am</th>
              <th class="col-erwarteter-ze table-cell-center">Zahlungseingang</th>
              <th class="col-netto">Netto</th>
              <th class="col-mwst-prozent">MwSt</th>
              <th class="col-ust">MwSt-Betrag</th>
              <th class="col-brutto">Bruttobetrag</th>
              <th class="col-re-gestellt table-cell-center">RE gestellt</th>
              <th class="col-ueberwiesen-bool table-cell-center">Bezahlt</th>
              <th class="col-erstellt-am">Erstellt am</th>
              <th class="col-erstellt-von">Erstellt von</th>
              ${!this.isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
            </tr>
          </thead>
          <tbody id="auftraege-table-body">
            <tr>
              <td colspan="${this.getListColumnCount()}" class="loading">${loadingText}</td>
            </tr>
          </tbody>
          ${this.renderInvoiceSummaryFoot()}
        </table>
    </div>
  `;
  }

  renderInvoiceSummaryCards() {
    const zero = this.formatSummaryCurrency(0);
    const cards = [
      { field: 'nettobetrag', label: 'Netto gesamt' },
      { field: 're_datum_netto', label: 'Netto mit RE-Datum' },
      { field: 'bezahlt_netto', label: 'Netto bereits bezahlt' }
    ];
    return `
      <div class="auftragsdetails-summary" id="ausgangsrechnungen-summary-cards">
        <div class="summary-cards">
          ${cards.map(({ field, label }) => `
            <div class="summary-card" data-summary-card="${field}">
              <div class="summary-value" data-summary-value="${field}">${zero}</div>
              <div class="summary-label">${label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderInvoiceSummaryFoot() {
    const zero = this.formatSummaryCurrency(0);
    return `
      <tfoot id="ausgangsrechnungen-summary">
        <tr>
          <td colspan="10" class="col-summary-label">Summe</td>
          <td class="col-netto" data-summary="nettobetrag">${zero}</td>
          <td class="col-mwst-prozent"></td>
          <td class="col-ust" data-summary="ust_betrag">${zero}</td>
          <td class="col-brutto" data-summary="bruttobetrag">${zero}</td>
          <td colspan="${this.isKunde ? 4 : 5}"></td>
        </tr>
      </tfoot>
    `;
  }

  formatSummaryCurrency(value) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
      .format(Number(value) || 0);
  }

  formatCurrency(value) {
    return value ? currencyFormatter.format(value) : '-';
  }

  formatDate(date) {
    return date ? new Date(date).toLocaleDateString('de-DE') : '-';
  }

  formatZahlungsziel(tage) {
    if (tage === null || tage === undefined) return '-';
    if (tage === 0) return 'Sofort';
    return `${tage} Tage`;
  }

  formatBoolean(value) {
    return value ? CHECK_ICON : CROSS_ICON;
  }

  formatUnternehmenTag(unternehmen) {
    if (!unternehmen?.firmenname) return '-';
    const bubbleData = {
      name: unternehmen.firmenname,
      label: unternehmen.internes_kuerzel || unternehmen.firmenname,
      type: 'org',
      logo_url: unternehmen.logo_url || null,
      thumb_url: unternehmen.logo_thumb_url || null
    };
    if (!this.isKunde) {
      bubbleData.id = unternehmen.id;
      bubbleData.entityType = 'unternehmen';
    }
    return avatarBubbles.renderBubbles([bubbleData], { showLabel: true });
  }

  formatMarkeTag(marke) {
    if (!marke?.markenname) return '-';
    const bubbleData = {
      name: marke.markenname,
      type: 'org',
      logo_url: marke.logo_url || null,
      thumb_url: marke.logo_thumb_url || null
    };
    if (!this.isKunde) {
      bubbleData.id = marke.id;
      bubbleData.entityType = 'marke';
    }
    return avatarBubbles.renderBubbles([bubbleData], { showLabel: true });
  }

  renderCreatedBy(user) {
    if (!user || !user.name) return '-';
    return avatarBubbles.renderBubbles([{
      name: user.name,
      type: 'person',
      id: user.id,
      entityType: 'mitarbeiter',
      profile_image_url: user.profile_image_url,
      thumb_url: user.profile_image_thumb_url || null
    }]);
  }

  sumInvoiceRows(rows) {
    return (rows || []).reduce((acc, row) => {
      acc.nettobetrag += parseFloat(row.nettobetrag) || 0;
      acc.ust_betrag += parseFloat(row.ust_betrag) || 0;
      acc.bruttobetrag += parseFloat(row.bruttobetrag) || 0;
      return acc;
    }, { nettobetrag: 0, ust_betrag: 0, bruttobetrag: 0 });
  }

  // Netto der Zeilen mit gesetztem RE-Datum (rechnung_gestellt_am).
  sumReDatumNetto(rows) {
    return (rows || []).reduce((sum, row) => {
      const datum = row?.rechnung_gestellt_am;
      if (datum === undefined || datum === null || datum === '') return sum;
      return sum + (parseFloat(row.nettobetrag) || 0);
    }, 0);
  }

  updateInvoiceSummary(rows, { animate = false } = {}) {
    const totals = this.sumInvoiceRows(rows);
    const paid = sumPaidInvoiceRows(rows);
    const foot = document.getElementById('ausgangsrechnungen-summary');
    const cards = document.getElementById('ausgangsrechnungen-summary-cards');
    const format = (v) => this.formatSummaryCurrency(v);
    const entries = {
      ...totals,
      re_datum_netto: this.sumReDatumNetto(rows),
      bezahlt_netto: paid.netto
    };
    Object.entries(entries).forEach(([field, value]) => {
      const targets = [
        foot?.querySelector(`[data-summary="${field}"]`),
        cards?.querySelector(`[data-summary-value="${field}"]`)
      ];
      targets.forEach((el) => {
        if (!el) return;
        if (animate) animateNumber(el, value, { format });
        else el.textContent = format(value);
      });
    });
  }

  renderMonthSheet() {
    return renderInvoiceMonthSheet({
      rootId: 'ausgangsrechnungen-month-tabs',
      yearSelectId: 'ausgangsrechnungen-year-select',
      year: this.currentYear,
      month: this.currentMonth,
      extraTabs: [{ tab: NO_RENR_TAB, label: 'Ohne Rechnungsnummer' }]
    });
  }

  renderRechnungsnummerCell(auftrag) {
    const stored = auftrag.re_nr || '';
    if (!this.isAdmin) {
      return window.validatorSystem.sanitizeHtml(stored || '-');
    }
    const display = stored || defaultReNrPrefix();
    const { id, entity } = this._inlineTarget(auftrag);
    return `<input type="text" class="grid-input auftrag-inline-re-nr-input"
      data-entity="${entity}" data-id="${id}" data-field="re_nr"
      data-previous-value="${escapeAttr(display)}"
      value="${escapeAttr(display)}"
      placeholder="Rechnungsnummer">`;
  }

  renderExternePoCell(auftrag) {
    const value = auftrag.externe_po || '';
    if (!this.isAdmin) {
      return window.validatorSystem.sanitizeHtml(value || '-');
    }
    const { id, entity } = this._inlineTarget(auftrag);
    return `<input type="text" class="grid-input auftrag-inline-text-input"
      data-entity="${entity}" data-id="${id}" data-field="externe_po"
      data-previous-value="${escapeAttr(value)}"
      value="${escapeAttr(value)}"
      placeholder="Externe PO">`;
  }

  renderInvoiceDateCell(auftrag) {
    if (!this.isAdmin) {
      return this.formatDate(auftrag.rechnung_gestellt_am);
    }
    const { id, entity } = this._inlineTarget(auftrag);
    return CustomDatePicker.render({
      id,
      entity,
      field: 'rechnung_gestellt',
      dateField: 'rechnung_gestellt_am',
      value: auftrag.rechnung_gestellt_am,
      label: 'Rechnungsdatum',
      inputClass: 'auftrag-inline-date-input'
    });
  }

  async updateTable(auftraege, mode = 'auftraege', { animate = false } = {}) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    this.updateInvoiceSummary(auftraege, { animate });

    const isContracts = mode === 'contracts';
    const actionEntity = isContracts ? 'contract' : 'auftrag';

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!auftraege || auftraege.length === 0) {
        const html = renderEmptyState({
          icon: 'invoice',
          title: 'Keine Kundenrechnungen vorhanden',
          text: isContracts
            ? 'Es wurden noch keine Kundenrechnungen erstellt.'
            : formatMonthEmptyText(this.currentMonth, this.currentYear)
        });
        tbody.innerHTML = `<tr><td colspan="${this.getListColumnCount()}" class="empty-state-cell">${html}</td></tr>`;
        return;
      }

      tbody.innerHTML = auftraege.map(auftrag => {
        const paymentStatusClass = getPaymentRowStatusClass(auftrag);
        const trLabel = auftrag._teilrechnung?.label || '1 von 1';
        const mwstProzent = auftrag.ust_prozent != null ? `${auftrag.ust_prozent}%` : '19%';
        return `
        <tr data-id="${auftrag.id}" data-tr-id="${auftrag.teilrechnung_id || auftrag.id}" class="${paymentStatusClass}" data-rechnung-gestellt="${Boolean(auftrag.rechnung_gestellt_am)}" data-ueberwiesen="${Boolean(auftrag.ueberwiesen_am)}" data-re-faelligkeit="${auftrag.re_faelligkeit || ''}">
          <td class="col-unternehmen">${this.formatUnternehmenTag(auftrag.unternehmen)}</td>
          <td class="col-marke">${this.formatMarkeTag(auftrag.marke)}</td>
          <td class="col-angebotsnr">${window.validatorSystem.sanitizeHtml(auftrag.angebotsnummer || '-')}</td>
          <td class="col-rechnungsnr">${this.renderRechnungsnummerCell(auftrag)}</td>
          <td class="col-teilrechnung">${trLabel}</td>
          <td class="col-externe-po">${this.renderExternePoCell(auftrag)}</td>
          <td class="col-rechnung-gestellt table-cell-center">${this.renderInvoiceDateCell(auftrag)}</td>
          <td class="col-zahlungsziel">${this.formatZahlungsziel(auftrag.zahlungsziel_tage)}</td>
          <td class="col-re-faelligkeit">${this.formatDate(auftrag.re_faelligkeit)}</td>
          <td class="col-erwarteter-ze table-cell-center">${this.formatDate(auftrag.re_faelligkeit)}</td>
          <td class="col-netto">${this.formatCurrency(auftrag.nettobetrag)}</td>
          <td class="col-mwst-prozent">${mwstProzent}</td>
          <td class="col-ust">${this.formatCurrency(auftrag.ust_betrag)}</td>
          <td class="col-brutto">${this.formatCurrency(auftrag.bruttobetrag)}</td>
          <td class="col-re-gestellt table-cell-center">${this.renderBillingDateCell(auftrag, 'rechnung_gestellt', 'rechnung_gestellt_am')}</td>
          <td class="col-ueberwiesen-bool table-cell-center">${this.renderBillingDateCell(auftrag, 'ueberwiesen', 'ueberwiesen_am')}</td>
          <td class="col-erstellt-am">${this.formatDate(auftrag.created_at)}</td>
          <td class="col-erstellt-von">${this.renderCreatedBy(auftrag.created_by)}</td>
          ${!this.isKunde ? `<td class="col-actions">${actionBuilder.create(actionEntity, auftrag.id, window.currentUser, {
            statusOptions: this.statusOptions,
            currentStatus: { id: auftrag.status || 'Beauftragt', name: auftrag.status || 'Beauftragt' }
          })}</td>` : ''}
        </tr>
      `;
      }).join('');
    });
  }

  _inlineTarget(auftrag) {
    return auftrag.teilrechnung_id
      ? { id: auftrag.teilrechnung_id, entity: 'auftrag_teilrechnung' }
      : { id: auftrag.id, entity: 'auftrag' };
  }

  renderBillingDateCell(auftrag, boolField, dateField) {
    if (!this.isAdmin) {
      return this.formatBoolean(Boolean(auftrag[dateField]));
    }
    const { id, entity } = this._inlineTarget(auftrag);
    const label = boolField === 'rechnung_gestellt' ? 'Rechnung gestellt am' : 'Ueberwiesen am';
    return CustomDatePicker.render({
      id,
      entity,
      field: boolField,
      dateField,
      value: auftrag[dateField],
      label,
      inputClass: 'auftrag-inline-date-input'
    });
  }

  _blattOpts() {
    const filters = filterSystem.getFilters('auftrag') || {};
    if (this.searchQuery.trim()) filters.auftragsname = this.searchQuery.trim();
    return {
      entity: ENTITY_KUNDENRECHNUNG,
      year: this.currentYear,
      month: this.currentMonth,
      filters,
      search: this.searchQuery,
      mode: this.activeTab === 'contracts' ? 'contracts' : 'auftraege'
    };
  }

  async reloadBlatt({ withCounts = false, firstPaint = false, animate = false } = {}) {
    const requestId = ++this._loadRequestId;
    const opts = this._blattOpts();
    const tbody = document.getElementById('auftraege-table-body');
    if (!firstPaint) TableAnimationHelper.showLoadingOverlay(tbody);

    const { rows } = await loadRows(opts);
    if (requestId !== this._loadRequestId) return;

    this.rechnungen = rows;
    await this.updateTable(rows, this.activeTab === 'contracts' ? 'contracts' : 'auftraege', { animate });
    this.updateTabCount(this.activeTab, rows.length);

    if (withCounts && this.activeTab !== 'contracts') {
      this._hydrateCounts(opts, requestId);
    }
  }

  async _hydrateCounts(opts, requestId) {
    try {
      const counts = await loadCounts(opts);
      if (requestId !== this._loadRequestId) return;
      this._blattCounts = counts;
      this.updateMonthTabUI();
    } catch (error) {
      console.warn('⚠️ Kundenrechnung-Counts fehlgeschlagen:', error);
    }
  }

  updateMonthTabUI() {
    updateInvoiceMonthTabUI({
      rootId: 'ausgangsrechnungen-month-tabs',
      yearSelectId: 'ausgangsrechnungen-year-select',
      year: this.currentYear,
      month: this.currentMonth,
      counts: this._blattCounts?.months || { undated: 0, 'no-renr': 0, alle: 0, months: Array(12).fill(0) }
    });
  }

  selectInvoiceMonth(tab) {
    const next = parseMonthTab(tab);
    if (Number.isNaN(next) && next !== UNDATED_TAB && next !== NO_RENR_TAB && next !== ALL_TAB) return;
    if (next === this.currentMonth) return;
    this.currentMonth = next;
    this.reloadBlatt({ withCounts: false, animate: true });
  }

  selectInvoiceYear(year) {
    const nextYear = parseInt(year, 10);
    if (Number.isNaN(nextYear) || nextYear === this.currentYear) return;
    this.currentYear = nextYear;
    this.reloadBlatt({ withCounts: true, animate: true });
  }

  updateTabCount(tab, count) {
    const el = document.querySelector(`[data-tab-count="${tab}"]`);
    if (el) el.textContent = count ?? 0;
  }

  async refreshInactiveTabCount() {
    if (!window.canViewContracts?.() || !window.supabase) return;
    try {
      const inactiveTab = this.activeTab === 'contracts' ? 'auftraege' : 'contracts';
      let query = window.supabase.from('auftrag').select('*', { count: 'estimated', head: true });
      query = inactiveTab === 'contracts'
        ? query.eq('auftragtype', 'Contracting')
        : query.neq('auftragtype', 'Contracting');
      const { count } = await query;
      this.updateTabCount(inactiveTab, count || 0);
    } catch (error) {
      console.warn('⚠️ Tab-Count fuer inaktiven Tab konnte nicht geladen werden:', error);
    }
  }

  async switchTab(tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.currentView = 'list';
    if (this.cashFlowCalendar) {
      this.cashFlowCalendar.destroy();
      this.cashFlowCalendar = null;
    }
    this.renderAuftraegeContent();
    SearchInput.bind('auftrag', (value) => this.handleSearch(value));
    this.initializeFilterBar();
    await this.reloadBlatt({ withCounts: tab !== 'contracts' });
    this.refreshInactiveTabCount();
  }

  async initializeFilterBar() {
    if (this.isKunde) return;
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (!filterContainer) return;
    SearchInput.bind('auftrag', (value) => this.handleSearch(value));
    await filterDropdown.init('auftrag', filterContainer, {
      onFilterApply: (filters) => this.onFiltersApplied(filters),
      onFilterReset: () => this.onFiltersReset()
    });
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('auftrag', filters);
    this.reloadBlatt({ withCounts: true });
  }

  onFiltersReset() {
    filterSystem.resetFilters('auftrag');
    this.reloadBlatt({ withCounts: true });
  }

  handleSearch(query) {
    clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();
      this.reloadBlatt({ withCounts: true });
    }, 300);
  }

  async initCashFlowCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    this.cashFlowCalendar = new AuftragCashFlowCalendar();
    await this.cashFlowCalendar.init(container);
  }

  bindEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    document.addEventListener('click', (e) => {
      const monthTabBtn = e.target.closest('#ausgangsrechnungen-month-tabs .tab-button[data-tab]');
      if (monthTabBtn) {
        e.preventDefault();
        this.selectInvoiceMonth(monthTabBtn.dataset.tab);
        return;
      }

      const tabBtn = e.target.closest('.auftrag-tabs .tab-button[data-tab]');
      if (tabBtn) {
        e.preventDefault();
        this.switchTab(tabBtn.dataset.tab);
        return;
      }

      if (this.activeTab === 'contracts') {
        const contractRow = e.target.closest('.contracts-table tr[data-id]');
        if (contractRow && !e.target.closest('a, button, input, label, .actions-dropdown')) {
          e.preventDefault();
          window.navigateTo(`/contracts/${contractRow.dataset.id}`);
          return;
        }
      }

      if (e.target.id === 'btn-view-list' || e.target.closest('#btn-view-list')) {
        e.preventDefault();
        if (this.activeTab === 'contracts' || this.currentView === 'list') return;
        this.cashFlowCalendar?.destroy();
        this.cashFlowCalendar = null;
        this.currentView = 'list';
        this.renderAuftraegeContent();
        SearchInput.bind('auftrag', (value) => this.handleSearch(value));
        this.initializeFilterBar();
        this.reloadBlatt({ withCounts: true });
        document.getElementById('btn-view-list')?.classList.add('active');
        document.getElementById('btn-view-calendar')?.classList.remove('active');
        return;
      }

      if (e.target.id === 'btn-view-calendar' || e.target.closest('#btn-view-calendar')) {
        e.preventDefault();
        if (this.activeTab === 'contracts' || this.currentView === 'calendar') return;
        this.currentView = 'calendar';
        this.renderAuftraegeContent();
        this.initCashFlowCalendar();
        document.getElementById('btn-view-list')?.classList.remove('active');
        document.getElementById('btn-view-calendar')?.classList.add('active');
        return;
      }

      if (e.target.closest('[data-empty-action="reset-filters"]')) {
        e.preventDefault();
        this.onFiltersReset();
      }
    }, { signal });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'ausgangsrechnungen-year-select') {
        this.selectInvoiceYear(e.target.value);
        return;
      }
      if (
        e.target.classList.contains('auftrag-inline-re-nr-input') ||
        e.target.classList.contains('auftrag-inline-text-input')
      ) {
        this.handleInlineReNrChange(e.target);
        return;
      }
      if (e.target.classList.contains('auftrag-inline-date-input')) {
        this.handleInlineBillingDateChange(e.target);
      }
    }, { signal });

    document.addEventListener('focusin', (e) => {
      if (!e.target.classList.contains('auftrag-inline-re-nr-input')) return;
      const input = e.target;
      const len = input.value?.length ?? 0;
      requestAnimationFrame(() => {
        try { input.setSelectionRange(len, len); } catch (_) { /* noop */ }
      });
    }, { signal });

    this._inlineDatePickerCleanup = CustomDatePicker.bind(document);

    window.addEventListener('entityUpdated', (e) => {
      const entity = e?.detail?.entity;
      if (entity !== 'auftrag' && entity !== 'auftrag_teilrechnung' && entity !== 'auftrag_details' && entity !== 'auftragsdetails') return;

      const field = e.detail.field;
      if (
        (entity === 'auftrag' || entity === 'auftrag_teilrechnung') &&
        e.detail.action === 'updated' &&
        (field === 'rechnung_gestellt_am' || field === 'ueberwiesen_am' || field === 're_nr' || field === 'externe_po')
      ) {
        this.reloadBlatt({ withCounts: field === 'rechnung_gestellt_am' || field === 're_nr' });
        return;
      }

      this.reloadBlatt({ withCounts: true });
    }, { signal });
  }

  async handleInlineReNrChange(input) {
    if (!this.isAdmin || !input) return;
    const id = input.dataset.id;
    const entity = input.dataset.entity || 'auftrag';
    const field = input.dataset.field || 're_nr';
    if (!id || !field) return;

    const previousValue = input.dataset.previousValue ?? '';
    const nextValue = input.value?.trim() || '';
    if (nextValue === previousValue) return;

    const isReNr = field === 're_nr';
    const payloadValue = isReNr && isBareReNrPrefix(nextValue) ? null : (nextValue || null);
    input.disabled = true;
    try {
      const result = await window.dataService.updateEntity(entity, id, { [field]: payloadValue });
      if (!result?.success) throw new Error(result?.error || 'Update fehlgeschlagen');

      if (isReNr && payloadValue == null) {
        const prefix = defaultReNrPrefix();
        input.value = prefix;
        input.dataset.previousValue = prefix;
      } else {
        input.dataset.previousValue = nextValue;
      }
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity, action: 'updated', id, field, value: payloadValue }
      }));
    } catch (error) {
      input.value = previousValue;
      window.toastSystem?.show('Aktualisierung fehlgeschlagen', 'error');
    } finally {
      input.disabled = false;
    }
  }

  async handleInlineBillingDateChange(input) {
    if (!this.isAdmin || !input) return;
    const auftragId = input.dataset.id;
    const field = input.dataset.field;
    const dateField = input.dataset.dateField;
    const entity = input.dataset.entity || 'auftrag';
    if (!auftragId || !field) return;

    const previousValue = input.dataset.previousValue || '';
    const nextValue = CustomDatePicker.getValue(input);
    if (nextValue === previousValue) return;

    const payload = nextValue
      ? { [dateField]: nextValue, [field]: true }
      : { [dateField]: null, [field]: false };

    CustomDatePicker.setDisabled(input, true);
    try {
      const result = await window.dataService.updateEntity(entity, auftragId, payload);
      if (!result?.success) throw new Error(result?.error || 'Update fehlgeschlagen');
      input.dataset.previousValue = nextValue;
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity, action: 'updated', id: auftragId, field: dateField, value: nextValue || null }
      }));
    } catch (error) {
      CustomDatePicker.setValue(input, previousValue);
      window.toastSystem?.show('Aktualisierung fehlgeschlagen', 'error');
    } finally {
      CustomDatePicker.setDisabled(input, false);
    }
  }

  destroy() {
    clearTimeout(this._searchDebounceTimer);
    this._abortController?.abort();
    this._abortController = null;
    this._inlineDatePickerCleanup?.();
    this._inlineDatePickerCleanup = null;
    this.cashFlowCalendar?.destroy();
    this.cashFlowCalendar = null;
    this.rechnungen = [];
    this._isAdmin = null;
    this._isKunde = null;
  }
}

export const ausgangsrechnungenList = new AusgangsrechnungenList();
