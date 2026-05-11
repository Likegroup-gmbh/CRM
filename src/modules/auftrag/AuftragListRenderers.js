// AuftragListRenderers.js
// Tabellen-Rendering Methoden fuer AuftragList (Prototype-Mixin)

import { AuftragList } from './AuftragListCore.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { renderAuftragAmpel } from './logic/AuftragStatusUtils.js';

AuftragList.prototype.renderCreatedBy = function(user) {
  if (!user || !user.name) return '-';
  const items = [{
    name: user.name,
    type: 'person',
    id: user.id,
    entityType: 'mitarbeiter',
    profile_image_url: user.profile_image_url,
    thumb_url: user.profile_image_thumb_url || null
  }];
  return avatarBubbles.renderBubbles(items);
};

AuftragList.prototype.getListColumnCount = function() {
  if (this.isKunde) {
    return 16;
  }
  return (this.isAdmin ? 1 : 0) + 19;
};

AuftragList.prototype.renderAuftragsdetailsLink = function(auftrag) {
  if (auftrag.auftragsdetails_id) {
    const name = window.validatorSystem.sanitizeHtml(auftrag.auftragsname || 'Unbekannter Auftrag');
    return `
      <a href="#" onclick="event.preventDefault(); window.navigateTo('/auftragsdetails/${auftrag.auftragsdetails_id}')" class="table-link details-link" title="Auftragsdetails anzeigen">
        ${name}
      </a>
    `;
  }
  if (auftrag.auftragtype === 'Contracting') {
    return '<span class="tag tag--contracting">Contracting</span>';
  }
  return '-';
};

AuftragList.prototype.renderContractDetailsLink = function(auftrag) {
  const name = window.validatorSystem.sanitizeHtml(auftrag.auftragsname || auftrag.titel || 'Contract');
  return `
    <a href="#" onclick="event.preventDefault(); window.navigateTo('/contracts/${auftrag.id}')" class="table-link details-link" title="Contract anzeigen">
      ${name}
    </a>
  `;
};

AuftragList.prototype.renderListView = function(mode = 'auftraege') {
  const isContracts = mode === 'contracts';
  const loadingText = isContracts ? 'Lade Contracts...' : 'Lade Aufträge...';
  const tableClass = isContracts ? 'auftrag-table contracts-table' : 'auftrag-table';

  return `
    <div class="table-container" id="auftrag-table-container">
        <table class="data-table ${tableClass}">
          <thead>
            <tr>
              ${this.isAdmin ? `<th class="col-checkbox">
                <input type="checkbox" id="select-all-auftraege">
              </th>` : ''}
              <th class="col-unternehmen">Unternehmen</th>
              <th class="col-marke">Marke</th>
              ${!this.isKunde ? '<th class="col-details">Details</th>' : ''}
              <th class="col-angebotsnr">Angebotsnummer</th>
              <th class="col-rechnungsnr">Rechnungsnummer</th>
              <th class="col-externe-po">Externe PO</th>
              <th class="col-rechnung-gestellt">Rechnungsdatum</th>
              <th class="col-zahlungsziel">Zahlungsziel</th>
              <th class="col-re-faelligkeit">Rechnungsfälligkeit</th>
              <th class="col-netto">Betrag netto</th>
              <th class="col-ust">Umsatzsteuer</th>
              <th class="col-brutto">Betrag brutto</th>
              <th class="col-re-gestellt table-cell-center">Rechnung gestellt</th>
              <th class="col-ueberwiesen-bool table-cell-center">Überwiesen</th>
              <th class="col-ueberwiesen">Bezahlt am</th>
              ${!this.isKunde ? '<th class="col-ansprechpartner">Ansprechpartner</th>' : ''}
              <th class="col-erstellt-von">Erstellt von</th>
              <th class="col-status">Status</th>
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
};

AuftragList.prototype.updateTable = async function(auftraege, mode = 'auftraege') {
  const tbody = document.querySelector('.data-table tbody');
  if (!tbody) return;

  const isContracts = mode === 'contracts';
  const emptyTitle = isContracts ? 'Keine Contracts vorhanden' : 'Keine Aufträge vorhanden';
  const emptySubtitle = isContracts
    ? 'Es wurden noch keine Contracts erstellt.'
    : 'Es wurden noch keine Aufträge erstellt.';
  const actionEntity = isContracts ? 'contract' : 'auftrag';

  await TableAnimationHelper.animatedUpdate(tbody, () => {
    if (!auftraege || auftraege.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${this.getListColumnCount()}" class="no-data">
            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📋</div>
              <h3 style="color: #666; margin-bottom: 8px;">${emptyTitle}</h3>
              <p style="color: #999; margin-bottom: 20px;">${emptySubtitle}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = auftraege.map(auftrag => {
      const paymentStatusClass = auftrag.ueberwiesen
        ? 'auftrag-row--ueberwiesen'
        : auftrag.rechnung_gestellt
          ? 'auftrag-row--rechnung-gestellt'
          : '';
      const rowClasses = paymentStatusClass;
      const detailsLink = isContracts
        ? this.renderContractDetailsLink(auftrag)
        : this.renderAuftragsdetailsLink(auftrag);
      return `
      <tr data-id="${auftrag.id}" class="${rowClasses}" data-rechnung-gestellt="${Boolean(auftrag.rechnung_gestellt)}" data-ueberwiesen="${Boolean(auftrag.ueberwiesen)}">
        ${this.isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="auftrag-check" data-id="${auftrag.id}"></td>` : ''}
        <td class="col-unternehmen">${this.formatUnternehmenTag(auftrag.unternehmen)}</td>
        <td class="col-marke">${this.formatMarkeTag(auftrag.marke)}</td>
        ${!this.isKunde ? `<td class="col-details">${detailsLink}</td>` : ''}
        <td class="col-angebotsnr">${window.validatorSystem.sanitizeHtml(auftrag.angebotsnummer || '-')}</td>
        <td class="col-rechnungsnr">${window.validatorSystem.sanitizeHtml(auftrag.re_nr || '-')}</td>
        <td class="col-externe-po">${window.validatorSystem.sanitizeHtml(auftrag.externe_po || '-')}</td>
        <td class="col-rechnung-gestellt">${this.formatDate(auftrag.rechnung_gestellt_am)}</td>
        <td class="col-zahlungsziel">${this.formatZahlungsziel(auftrag.zahlungsziel_tage)}</td>
        <td class="col-re-faelligkeit">${this.formatDate(auftrag.re_faelligkeit)}</td>
        <td class="col-netto">${this.formatCurrency(auftrag.nettobetrag)}</td>
        <td class="col-ust">${this.formatCurrency(auftrag.ust_betrag)}</td>
        <td class="col-brutto">${this.formatCurrency(auftrag.bruttobetrag)}</td>
        <td class="col-re-gestellt table-cell-center">${this.renderBillingDateCell(auftrag, 'rechnung_gestellt', 'rechnung_gestellt_am')}</td>
        <td class="col-ueberwiesen-bool table-cell-center">${this.renderBillingDateCell(auftrag, 'ueberwiesen', 'ueberwiesen_am')}</td>
        <td class="col-ueberwiesen">${this.formatDate(auftrag.ueberwiesen_am)}</td>
        ${!this.isKunde ? `<td class="col-ansprechpartner">${this.formatAnsprechpartner(auftrag.ansprechpartner)}</td>` : ''}
        <td class="col-erstellt-von">${this.renderCreatedBy(auftrag.created_by)}</td>
        <td class="col-status">${renderAuftragAmpel(auftrag.status)}</td>
        ${!this.isKunde ? `<td class="col-actions">${actionBuilder.create(actionEntity, auftrag.id)}</td>` : ''}
      </tr>
    `}).join('');
  });
};
