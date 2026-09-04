// AusgangsrechnungenList.js
// Zeigt pro Auftrag je eine Zeile pro Teilrechnung, sortiert nach Rechnungsnummer (re_nr)

import { AuftragList } from '../auftrag/AuftragList.js';
import { defaultReNrPrefix, sortRowsByPrefixedNumberDesc } from '../auftrag/logic/PrefixedNumberSort.js';
import {
  ALL_TAB,
  MONTH_LABELS,
  NO_RENR_TAB,
  UNDATED_TAB,
  countRowsByMonth,
  filterRowsByMonthYear,
  findInvoiceCacheRow,
  formatMonthEmptyText,
  parseMonthTab
} from '../auftrag/logic/InvoiceMonthFilter.js';
import { animateNumber } from '../../core/animation/animateNumber.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { getPaymentRowStatusClass } from '../auftrag/logic/PaymentRowStatus.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

const TR_FIELDS = [
  're_nr', 'externe_po', 'nettobetrag', 'ust_betrag', 'bruttobetrag',
  'rechnung_gestellt', 'rechnung_gestellt_am', 're_faelligkeit',
  'erwarteter_monat_zahlungseingang',
  'ueberwiesen', 'ueberwiesen_am'
];

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class AusgangsrechnungenList extends AuftragList {
  constructor() {
    super();
    this.usesPagination = false;
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();
    this._allInvoiceRows = [];
  }

  async render() {
    window.setHeadline('Kundenrechnungen');

    const isContracts = this.activeTab === 'contracts';

    // Die Shell besteht nur aus dem Tab-Content. Der Page-Header (View-Toggle)
    // steckt im sticky Kopfbereich, den renderAuftraegeContent baut – so klebt
    // alles bis zu den Monats-Tabs als ein Block oben.
    window.setContentSafely(window.content, '<div id="page-tab-content" class="kundenrechnungen-page"></div>');
    this._shellRendered = true;

    this.renderAuftraegeContent();
    if (!isContracts && this.currentView === 'calendar') {
      await this.initCashFlowCalendar();
    }
  }

  // Kopfzeile: links Suche + Filter, rechts Aktions-Buttons + View-Toggle
  // (Liste/Kalender). In der Listenansicht ist die fruehere .table-filter-wrapper
  // hier mit integriert – eine Box/Zeile weniger im sticky Kopfbereich.
  // Alle Klicks laufen ueber die globale Delegation in AuftragListEvents,
  // SearchInput.bind wird nach jedem Re-Render erneut auf dieselbe ID gebunden.
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

  // Kundenrechnungen-Layout: Header + Auftrag/Contract-Tabs kleben oben
  // (.kr-sticky-head), die Monats-Tabs kleben unten (.kr-sticky-foot).
  // Dazwischen scrollt .kr-scroll-body mit den Summen-Cards und der Tabelle.
  // Die Tabelle bekommt per CSS eine feste Mindesthoehe, damit der Monatswechsel
  // keinen Layout-Sprung verursacht.
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

  _getSortField() {
    return 're_nr';
  }

  getListColumnCount() {
    if (this.isKunde) return 18;
    return 19;
  }

  // Nur die Tabelle – Summen-Cards und Monats-Tabs liegen im sticky Kopfbereich
  // (renderAuftraegeContent), damit sie beim Scrollen stehen bleiben.
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

  // Gleiche Optik wie die Summary-Cards auf Kampagne/Auftragsdetails:
  // Werte oben, Label unten, eine Quelle (sumInvoiceRows) fuer Cards und tfoot.
  renderInvoiceSummaryCards() {
    const zero = this.formatSummaryCurrency(0);
    const cards = [
      { field: 'nettobetrag', label: 'Netto' },
      { field: 'ust_betrag', label: 'Mehrwertsteuer' },
      { field: 'bruttobetrag', label: 'Brutto' }
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

  // Summen der aktuell sichtbaren Zeilen. Der Monatstab zeigt sonst nur, wie viele
  // Rechnungen im Monat liegen, aber nicht, um wie viel Geld es geht.
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

  sumInvoiceRows(rows) {
    return (rows || []).reduce((acc, row) => {
      acc.nettobetrag += parseFloat(row.nettobetrag) || 0;
      acc.ust_betrag += parseFloat(row.ust_betrag) || 0;
      acc.bruttobetrag += parseFloat(row.bruttobetrag) || 0;
      return acc;
    }, { nettobetrag: 0, ust_betrag: 0, bruttobetrag: 0 });
  }

  // animate: Count-Up/Down wie auf den Kampagnen-Summary-Cards (zentrales
  // animateNumber). Cards und tfoot zeigen dieselbe Zahl und laufen synchron.
  updateInvoiceSummary(rows, { animate = false } = {}) {
    const totals = this.sumInvoiceRows(rows);
    const foot = document.getElementById('ausgangsrechnungen-summary');
    const cards = document.getElementById('ausgangsrechnungen-summary-cards');
    const format = (v) => this.formatSummaryCurrency(v);
    Object.entries(totals).forEach(([field, value]) => {
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
    const nowYear = new Date().getFullYear();
    const yearOptions = [];
    for (let year = nowYear - 5; year <= nowYear + 5; year += 1) {
      yearOptions.push(`<option value="${year}" ${year === this.currentYear ? 'selected' : ''}>${year}</option>`);
    }

    const allTab = renderTabButton({
      tab: ALL_TAB,
      label: `Alle<span class="tab-count" data-month-count="${ALL_TAB}">0</span>`,
      isActive: this.currentMonth === ALL_TAB,
      skipPermissionCheck: true
    });

    const monthTabs = MONTH_LABELS.map((label, index) => renderTabButton({
      tab: String(index),
      label: `${label}<span class="tab-count" data-month-count="${index}">0</span>`,
      isActive: this.currentMonth === index,
      skipPermissionCheck: true
    })).join('');

    const undatedTab = renderTabButton({
      tab: UNDATED_TAB,
      label: `Ohne Datum<span class="tab-count" data-month-count="${UNDATED_TAB}">0</span>`,
      isActive: this.currentMonth === UNDATED_TAB,
      skipPermissionCheck: true
    });

    const noRenrTab = renderTabButton({
      tab: NO_RENR_TAB,
      label: `Ohne Rechnungsnummer<span class="tab-count" data-month-count="${NO_RENR_TAB}">0</span>`,
      isActive: this.currentMonth === NO_RENR_TAB,
      skipPermissionCheck: true
    });

    return `
      <div class="tab-navigation ausgangsrechnungen-month-tabs" id="ausgangsrechnungen-month-tabs">
        <select id="ausgangsrechnungen-year-select" class="form-select" aria-label="Jahr">
          ${yearOptions.join('')}
        </select>
        ${allTab}
        ${monthTabs}
        ${undatedTab}
        ${noRenrTab}
      </div>
    `;
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
          <td class="col-erwarteter-ze table-cell-center">${this.renderExpectedPaymentDateCell(auftrag)}</td>
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

  // Der erwartete Zahlungseingang entspricht der RE-Faelligkeit und ist nicht editierbar.
  renderExpectedPaymentDateCell(auftrag) {
    return this.formatDate(auftrag.re_faelligkeit);
  }

  // Bei Kundenrechnungen werden Inline-Edits pro Teilrechnung geschrieben,
  // sonst (kein Teilrechnungs-Datensatz) auf den Auftrag.
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

  applyMonthFilter() {
    const filtered = filterRowsByMonthYear(this._allInvoiceRows, {
      year: this.currentYear,
      month: this.currentMonth
    });
    this.updateTable(filtered, 'auftraege', { animate: true });
    this.updateMonthTabUI();
  }

  afterInvoiceRowsLoaded() {
    this.updateMonthTabUI();
  }

  updateMonthTabUI() {
    const counts = countRowsByMonth(this._allInvoiceRows, this.currentYear);
    MONTH_LABELS.forEach((_, index) => {
      const el = document.querySelector(`[data-month-count="${index}"]`);
      if (el) el.textContent = counts.months[index] || 0;
    });
    const undatedEl = document.querySelector(`[data-month-count="${UNDATED_TAB}"]`);
    if (undatedEl) undatedEl.textContent = counts[UNDATED_TAB] || 0;
    const noRenrEl = document.querySelector(`[data-month-count="${NO_RENR_TAB}"]`);
    if (noRenrEl) noRenrEl.textContent = counts[NO_RENR_TAB] || 0;
    const allEl = document.querySelector(`[data-month-count="${ALL_TAB}"]`);
    if (allEl) allEl.textContent = counts[ALL_TAB] || 0;

    const yearSelect = document.getElementById('ausgangsrechnungen-year-select');
    if (yearSelect && String(yearSelect.value) !== String(this.currentYear)) {
      yearSelect.value = String(this.currentYear);
    }

    document.querySelectorAll('#ausgangsrechnungen-month-tabs .tab-button[data-tab]').forEach(btn => {
      const tab = parseMonthTab(btn.dataset.tab);
      btn.classList.toggle('active', tab === this.currentMonth);
    });
  }

  selectInvoiceMonth(tab) {
    const next = parseMonthTab(tab);
    if (Number.isNaN(next) && next !== UNDATED_TAB && next !== NO_RENR_TAB && next !== ALL_TAB) return;
    if (next === this.currentMonth) return;
    this.currentMonth = next;
    this.applyMonthFilter();
  }

  selectInvoiceYear(year) {
    const nextYear = parseInt(year, 10);
    if (Number.isNaN(nextYear) || nextYear === this.currentYear) return;
    this.currentYear = nextYear;
    this.applyMonthFilter();
  }

  onInlineBillingUpdated({ id, field, value }) {
    const row = findInvoiceCacheRow(this._allInvoiceRows, id);
    if (!row) return;
    row[field] = value || null;
    if (field === 'rechnung_gestellt_am') row.rechnung_gestellt = Boolean(value);
    if (field === 'ueberwiesen_am') row.ueberwiesen = Boolean(value);
    this.applyMonthFilter();
  }

  onInlineReNrUpdated({ id, field = 're_nr', value }) {
    const row = findInvoiceCacheRow(this._allInvoiceRows, id);
    if (!row) return;
    row[field] = value;
    if (field === 're_nr') this.applyMonthFilter();
  }

  async _mergeTeilrechnungSearchIds(auftragIds, searchTerm, mode) {
    if (!searchTerm || !window.supabase) return auftragIds;

    const { data: trHits, error } = await window.supabase
      .from('auftrag_teilrechnung')
      .select('auftrag_id')
      .ilike('re_nr', `%${searchTerm}%`);

    if (error) {
      console.warn('⚠️ Teilrechnungs-Suche nach re_nr fehlgeschlagen:', error);
      return auftragIds;
    }

    const known = new Set(auftragIds);
    const extraIds = [...new Set((trHits || []).map(row => row.auftrag_id).filter(Boolean))]
      .filter(id => !known.has(id));
    if (extraIds.length === 0) return auftragIds;

    let extraQuery = window.supabase.from('auftrag').select('id').in('id', extraIds);
    extraQuery = mode === 'contracts'
      ? extraQuery.eq('auftragtype', 'Contracting')
      : extraQuery.neq('auftragtype', 'Contracting');
    const { data: extraRows, error: extraError } = await extraQuery;
    if (extraError) {
      console.warn('⚠️ Extra-IDs der Teilrechnungs-Suche konnten nicht geladen werden:', extraError);
      return auftragIds;
    }

    return auftragIds.concat((extraRows || []).map(row => row.id));
  }

  async loadAuftraegeWithPagination(filters = {}, page = 1, limit = 25, mode = 'auftraege') {
    try {
      if (!window.supabase) {
        return { data: [], count: 0 };
      }

      const searchTerm = typeof filters.auftragsname === 'string' ? filters.auftragsname.trim() : '';
      const filterCopy = { ...filters };

      // 1) Alle passenden Auftrag-IDs laden
      const idQuery = await this.buildFilteredAuftragQuery(filterCopy, mode, 'id');
      const { data: idRows, error: idError } = await idQuery;

      if (idError) {
        console.error('❌ Fehler beim Laden der Auftrags-IDs:', idError);
        throw idError;
      }

      let auftragIds = (idRows || []).map(r => r.id);
      auftragIds = await this._mergeTeilrechnungSearchIds(auftragIds, searchTerm, mode);
      if (auftragIds.length === 0) {
        this._allInvoiceRows = [];
        return { data: [], count: 0 };
      }

      // 2) Auftraege + Teilrechnungen parallel laden
      const AUFTRAG_SELECT = `
        id,
        auftragsname,
        auftragtype,
        angebotsnummer,
        anzahl_teilrechnungen,
        status,
        po,
        externe_po,
        re_nr,
        re_faelligkeit,
        erwarteter_monat_zahlungseingang,
        zahlungsziel_tage,
        start,
        ende,
        nettobetrag,
        ust_prozent,
        ust_betrag,
        bruttobetrag,
        rechnung_gestellt,
        rechnung_gestellt_am,
        ueberwiesen,
        ueberwiesen_am,
        created_by_id,
        created_at,
        unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url, logo_thumb_url),
        marke:marke_id(id, markenname, logo_url, logo_thumb_url),
        created_by:created_by_id(id, name, profile_image_url, profile_image_thumb_url),
        auftrag_details(id),
        kampagne_arten:auftrag_kampagne_art(art:kampagne_art_id(id, name))
      `;

      const [{ data: auftraege, error: auftraegeError }, { data: teilrechnungen, error: trError }] = await Promise.all([
        window.supabase.from('auftrag').select(AUFTRAG_SELECT).in('id', auftragIds),
        window.supabase.from('auftrag_teilrechnung')
          .select('*')
          .in('auftrag_id', auftragIds)
          .order('position', { ascending: true })
      ]);

      if (auftraegeError) throw auftraegeError;
      if (trError) throw trError;

      // Teilrechnungen nach auftrag_id gruppieren
      const trByAuftrag = new Map();
      for (const tr of (teilrechnungen || [])) {
        if (!trByAuftrag.has(tr.auftrag_id)) {
          trByAuftrag.set(tr.auftrag_id, []);
        }
        trByAuftrag.get(tr.auftrag_id).push(tr);
      }

      const createdByFallbacks = await this.loadCreatedByFallbacks(auftraege || []);

      // 3) Explodieren: pro Teilrechnung eine Zeile
      const exploded = [];
      for (const auftrag of (auftraege || [])) {
        const details = auftrag.auftrag_details;
        const detailsId = Array.isArray(details) ? details[0]?.id : details?.id;

        const base = {
          ...auftrag,
          has_auftragsdetails: Boolean(detailsId),
          auftragsdetails_id: detailsId || null,
          created_by: auftrag.created_by || createdByFallbacks.get(auftrag.created_by_id) || null,
          unternehmen: auftrag.unternehmen ? {
            id: auftrag.unternehmen.id,
            firmenname: auftrag.unternehmen.firmenname,
            internes_kuerzel: auftrag.unternehmen.internes_kuerzel,
            logo_url: auftrag.unternehmen.logo_url,
            logo_thumb_url: auftrag.unternehmen.logo_thumb_url
          } : null,
          marke: auftrag.marke ? {
            id: auftrag.marke.id,
            markenname: auftrag.marke.markenname,
            logo_url: auftrag.marke.logo_url,
            logo_thumb_url: auftrag.marke.logo_thumb_url
          } : null,
          art_der_kampagne: (auftrag.kampagne_arten || [])
            .map(ka => ka.art?.name)
            .filter(Boolean)
        };

        const trs = trByAuftrag.get(auftrag.id);
        if (trs && trs.length > 0) {
          const total = trs.length;
          for (const tr of trs) {
            const row = { ...base };
            for (const field of TR_FIELDS) {
              if (tr[field] !== undefined) row[field] = tr[field];
            }
            row.teilrechnung_id = tr.id;
            row._teilrechnung = {
              position: tr.position,
              total,
              label: `${tr.position} von ${total}`
            };
            exploded.push(row);
          }
        } else {
          base.teilrechnung_id = null;
          base._teilrechnung = { position: 1, total: 1, label: '1 von 1' };
          exploded.push(base);
        }
      }

      // 4) Sortieren nach re_nr (neueste/hoechste zuerst)
      const sorted = sortRowsByPrefixedNumberDesc(exploded, 're_nr');
      this._allInvoiceRows = sorted;

      if (mode !== 'auftraege') {
        const from = (page - 1) * limit;
        return { data: sorted.slice(from, from + limit), count: sorted.length };
      }

      // Kein Auto-Sprung in den ersten Monat mit Daten: die Auswahl (Singleton)
      // bleibt ueber SPA-Navigation erhalten, Default ist der aktuelle Monat.
      const filtered = filterRowsByMonthYear(sorted, {
        year: this.currentYear,
        month: this.currentMonth
      });
      return { data: filtered, count: sorted.length };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kundenrechnungen:', error);
      throw error;
    }
  }

  destroy() {
    this._allInvoiceRows = [];
    super.destroy();
  }
}

export const ausgangsrechnungenList = new AusgangsrechnungenList();
