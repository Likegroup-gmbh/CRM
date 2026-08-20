// AusgangsrechnungenList.js
// Zeigt pro Auftrag je eine Zeile pro Teilrechnung, sortiert nach Rechnungsnummer (re_nr)

import { AuftragList } from '../auftrag/AuftragList.js';
import { defaultReNrPrefix, sortRowsByPrefixedNumberDesc } from '../auftrag/logic/PrefixedNumberSort.js';
import {
  MONTH_LABELS,
  NO_RENR_TAB,
  UNDATED_TAB,
  countRowsByMonth,
  filterRowsByMonthYear,
  findInvoiceCacheRow,
  formatMonthEmptyText,
  parseMonthTab,
  resolveDefaultMonth
} from '../auftrag/logic/InvoiceMonthFilter.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
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
    this._monthInitialized = false;
  }

  async render() {
    window.setHeadline('Kundenrechnungen');

    const isContracts = this.activeTab === 'contracts';
    const viewToggleDisabled = isContracts ? 'disabled' : '';

    const VIEW_LIST_ICON = `${icon('table-grid')}`;
    const VIEW_CAL_ICON = `${icon('calendar-days')}`;

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-list" class="mdc-btn mdc-btn--secondary ${this.currentView === 'list' ? 'active' : ''}" ${viewToggleDisabled}>${VIEW_LIST_ICON} Liste</button>
            <button id="btn-view-calendar" class="mdc-btn mdc-btn--secondary ${this.currentView === 'calendar' ? 'active' : ''}" ${viewToggleDisabled}>${VIEW_CAL_ICON} Kalender</button>
          </div>
        </div>
      </div>

      <div id="page-tab-content"></div>
    `;

    window.setContentSafely(window.content, html);
    this._shellRendered = true;

    this.renderAuftraegeContent();
    if (!isContracts && this.currentView === 'calendar') {
      await this.initCashFlowCalendar();
    }
  }

  _getSortField() {
    return 're_nr';
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
        </table>
    </div>

    ${isContracts ? '' : this.renderMonthSheet()}
  `;
  }

  renderMonthSheet() {
    const nowYear = new Date().getFullYear();
    const yearOptions = [];
    for (let year = nowYear - 5; year <= nowYear + 5; year += 1) {
      yearOptions.push(`<option value="${year}" ${year === this.currentYear ? 'selected' : ''}>${year}</option>`);
    }

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

  async updateTable(auftraege, mode = 'auftraege') {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

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

  renderExpectedPaymentDateCell(auftrag) {
    if (!this.isAdmin) {
      return this.formatDate(auftrag.erwarteter_monat_zahlungseingang);
    }
    const { id, entity } = this._inlineTarget(auftrag);
    return CustomDatePicker.render({
      id,
      entity,
      field: 'erwarteter_monat_zahlungseingang',
      dateField: '',
      value: auftrag.erwarteter_monat_zahlungseingang,
      label: 'Erwarteter Zahlungseingang',
      inputClass: 'auftrag-inline-date-input'
    });
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
    this.updateTable(filtered, 'auftraege');
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
    if (Number.isNaN(next) && next !== UNDATED_TAB && next !== NO_RENR_TAB) return;
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

      if (!this._monthInitialized) {
        this.currentMonth = resolveDefaultMonth(sorted, this.currentYear, this.currentMonth);
        this._monthInitialized = true;
      }

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
    this._monthInitialized = false;
    super.destroy();
  }
}

export const ausgangsrechnungenList = new AusgangsrechnungenList();
