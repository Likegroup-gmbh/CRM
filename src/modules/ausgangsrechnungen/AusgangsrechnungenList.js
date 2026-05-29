// AusgangsrechnungenList.js
// Zeigt pro Auftrag je eine Zeile pro Teilrechnung, sortiert nach Rechnungsnummer (re_nr)

import { AuftragList } from '../auftrag/AuftragList.js';
import { sortRowsByPrefixedNumberDesc } from '../auftrag/logic/PrefixedNumberSort.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { getPaymentRowStatusClass } from '../auftrag/logic/PaymentRowStatus.js';

const TR_FIELDS = [
  're_nr', 'externe_po', 'nettobetrag', 'ust_betrag', 'bruttobetrag',
  'rechnung_gestellt', 'rechnung_gestellt_am', 're_faelligkeit',
  'erwarteter_monat_zahlungseingang',
  'ueberwiesen', 'ueberwiesen_am'
];

export class AusgangsrechnungenList extends AuftragList {
  constructor() {
    super();
  }

  async render() {
    window.setHeadline('Kundenrechnungen');

    const isContracts = this.activeTab === 'contracts';
    const viewToggleDisabled = isContracts ? 'disabled' : '';

    const VIEW_LIST_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" /></svg>`;
    const VIEW_CAL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-list" class="secondary-btn ${this.currentView === 'list' ? 'active' : ''}" ${viewToggleDisabled}>${VIEW_LIST_ICON} Liste</button>
            <button id="btn-view-calendar" class="secondary-btn ${this.currentView === 'calendar' ? 'active' : ''}" ${viewToggleDisabled}>${VIEW_CAL_ICON} Kalender</button>
          </div>
        </div>
      </div>

      <div id="page-tab-content"></div>
    `;

    window.setContentSafely(window.content, html);

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
              <th class="col-rechnungsnr">Rechnungsnummer</th>
              <th class="col-teilrechnung">Teilrechnung</th>
              <th class="col-externe-po">Externe PO</th>
              <th class="col-rechnung-gestellt">Rechnungsdatum</th>
              <th class="col-zahlungsziel">Zahlungsziel</th>
              <th class="col-re-faelligkeit">Rechnungsfälligkeit</th>
              <th class="col-erwarteter-ze table-cell-center">Erwarteter Zahlungseingang</th>
              <th class="col-netto">Netto</th>
              <th class="col-mwst-prozent">Mehrwertsteuer</th>
              <th class="col-ust">MwSt-Betrag</th>
              <th class="col-brutto">Bruttobetrag</th>
              <th class="col-re-gestellt table-cell-center">Rechnung gestellt</th>
              <th class="col-ueberwiesen-bool table-cell-center">Überwiesen</th>
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

    <div class="pagination-container" id="pagination-auftrag"></div>
  `;
  }

  async updateTable(auftraege, mode = 'auftraege') {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const isContracts = mode === 'contracts';
    const actionEntity = isContracts ? 'contract' : 'auftrag';

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!auftraege || auftraege.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${this.getListColumnCount()}" class="no-data">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📋</div>
                <h3 style="color: #666; margin-bottom: 8px;">Keine Kundenrechnungen vorhanden</h3>
                <p style="color: #999; margin-bottom: 20px;">Es wurden noch keine Kundenrechnungen erstellt.</p>
              </div>
            </td>
          </tr>
        `;
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
          <td class="col-rechnungsnr">${window.validatorSystem.sanitizeHtml(auftrag.re_nr || '-')}</td>
          <td class="col-teilrechnung">${trLabel}</td>
          <td class="col-externe-po">${window.validatorSystem.sanitizeHtml(auftrag.externe_po || '-')}</td>
          <td class="col-rechnung-gestellt">${this.formatDate(auftrag.rechnung_gestellt_am)}</td>
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
      `}).join('');
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

  async loadAuftraegeWithPagination(filters = {}, page = 1, limit = 25, mode = 'auftraege') {
    try {
      if (!window.supabase) {
        return { data: [], count: 0 };
      }

      const filterCopy = { ...filters };

      // 1) Alle passenden Auftrag-IDs laden
      const idQuery = await this.buildFilteredAuftragQuery(filterCopy, mode, 'id');
      const { data: idRows, error: idError } = await idQuery;

      if (idError) {
        console.error('❌ Fehler beim Laden der Auftrags-IDs:', idError);
        throw idError;
      }

      const auftragIds = (idRows || []).map(r => r.id);
      if (auftragIds.length === 0) {
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

      // 5) Clientseitige Pagination
      const totalCount = sorted.length;
      const from = (page - 1) * limit;
      const pageSlice = sorted.slice(from, from + limit);

      return { data: pageSlice, count: totalCount };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Kundenrechnungen:', error);
      throw error;
    }
  }
}

export const ausgangsrechnungenList = new AusgangsrechnungenList();
