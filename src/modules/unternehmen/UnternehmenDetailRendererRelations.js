// UnternehmenDetailRendererRelations.js
// Tab-Renderer: Strategien, Creator-Auswahl, Kooperationen, Creator, Ansprechpartner, Rechnungen, Verträge, Strategiebriefing

import { renderCreatorTable } from '../creator/CreatorTable.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderMarkeBubble, renderPersonBubble } from './UnternehmenDetailRendererHelpers.js';
import { renderStrategiebriefing as renderStrategiebriefingShared, bindStrategiebriefingCreateButton } from '../kickoff/StrategiebriefingRenderer.js';
import { getPaymentRowStatusClass } from '../auftrag/logic/PaymentRowStatus.js';

export function renderStrategien(detail) {
  if (!detail.strategien || detail.strategien.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Strategien vorhanden</h3>
        <p>Es wurden noch keine Strategien für dieses Unternehmen erstellt.</p>
      </div>
    `;
  }

  const rows = detail.strategien.map(s => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="strategie" data-id="${s.id}">
          ${detail.sanitize(s.name) || 'Unbekannte Strategie'}
        </a>
      </td>
      <td>${detail.sanitize(s.teilbereich) || '-'}</td>
      <td class="col-erstellt-von">${detail.sanitize(s.created_by_user?.name) || '-'}</td>
      <td>${detail.formatDate(s.created_at)}</td>
      <td>${actionBuilder.create('strategie', s.id)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Teilbereich</th>
            <th class="col-erstellt-von">Erstellt von</th>
            <th>Erstellt am</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderCreatorAuswahl(detail) {
  if (!detail.creatorAuswahlen || detail.creatorAuswahlen.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Creator-Auswahlen vorhanden</h3>
        <p>Es wurden noch keine Creator-Auswahlen für dieses Unternehmen erstellt.</p>
      </div>
    `;
  }

  const rows = detail.creatorAuswahlen.map(ca => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="sourcing" data-id="${ca.id}">
          ${detail.sanitize(ca.name) || 'Unbekannte Creator-Auswahl'}
        </a>
      </td>
      <td>${detail.formatDate(ca.created_at)}</td>
      <td>${actionBuilder.create('creator_auswahl', ca.id)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Erstellt am</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderKooperationen(detail) {
  if (!detail.kooperationen || detail.kooperationen.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Kooperationen vorhanden</h3>
        <p>Für die Kampagnen dieses Unternehmens wurden keine Kooperationen gefunden.</p>
      </div>
    `;
  }

  const creatorMap = detail._creatorMap || {};

  const rows = detail.kooperationen.map(k => {
    const creator = creatorMap[k.creator_id];
    const creatorName = creator ? `${detail.sanitize(creator.vorname || '')} ${detail.sanitize(creator.nachname || '')}`.trim() : '-';
    return `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="kooperation" data-id="${k.id}">
          ${detail.sanitize(k.name) || 'Kooperation'}
        </a>
      </td>
      <td>${k.kampagne ? detail.sanitize(KampagneUtils.getDisplayName(k.kampagne)) : '-'}</td>
      <td>${creator ? creatorName : '-'}</td>
      <td>${k.videoanzahl || 0}</td>
      <td>${detail.formatCurrency(k.einkaufspreis_gesamt)}</td>
      <td>${detail.formatCurrency(k.verkaufspreis_gesamt)}</td>
      <td>${detail.formatCurrency(k.verkaufspreis_zusatzkosten)}</td>
      <td>${detail.formatDate(k.created_at)}</td>
      <td>${actionBuilder.create('kooperation', k.id)}</td>
    </tr>
  `}).join('');

  return `
    <div class="data-table-container">
      <table class="data-table data-table--nowrap">
        <thead>
          <tr>
            <th>Name</th>
            <th>Kampagne</th>
            <th>Creator</th>
            <th>Videos</th>
            <th>Einkaufspreis</th>
            <th>Verkaufspreis</th>
            <th>Extra Kosten (VK)</th>
            <th>Erstellt</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderCreators(detail) {
  if (!detail.creators || detail.creators.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Creator vorhanden</h3>
        <p>Es gibt keine Creator in Kooperationen für dieses Unternehmen.</p>
      </div>
    `;
  }
  return renderCreatorTable(detail.creators);
}

export function renderAnsprechpartner(detail) {
  if (!detail.ansprechpartner || detail.ansprechpartner.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Ansprechpartner vorhanden</h3>
        <p>Es wurden noch keine Ansprechpartner für dieses Unternehmen zugeordnet.</p>
      </div>
    `;
  }

  const rows = detail.ansprechpartner.map(ap => `
    <tr>
      <td class="col-name-with-icon">
        ${ap.profile_image_url
          ? `<img src="${ap.profile_image_url}" class="table-logo" width="24" height="24" alt="" />`
          : `<span class="table-avatar">${(ap.vorname || '?')[0].toUpperCase()}</span>`}
        <a href="#" class="table-link" data-table="ansprechpartner" data-id="${ap.id}">
          ${detail.sanitize(ap.vorname)} ${detail.sanitize(ap.nachname)}
        </a>
        ${ap.ist_verknuepft ? `<span class="tag tag--verknuepft" title="verknüpft"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="tag--verknuepft-icon"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg></span>` : ''}
      </td>
      <td>${detail.sanitize(ap.position?.name) || '-'}</td>
      <td>${ap.email ? `<a href="mailto:${ap.email}">${detail.sanitize(ap.email)}</a>` : '-'}</td>
      <td>${PhoneDisplay.render(
        ap.telefonnummer_land?.iso_code,
        ap.telefonnummer_land?.vorwahl,
        ap.telefonnummer
      )}</td>
      <td>${PhoneDisplay.render(
        ap.telefonnummer_office_land?.iso_code,
        ap.telefonnummer_office_land?.vorwahl,
        ap.telefonnummer_office
      )}</td>
      <td>${detail.sanitize(ap.stadt) || '-'}</td>
      <td>${actionBuilder.create('ansprechpartner_unternehmen', ap.id)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Position</th>
            <th>Email</th>
            <th>Telefon (Privat)</th>
            <th>Telefon (Büro)</th>
            <th>Stadt</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderRechnungen(detail) {
  if (!detail.rechnungen || detail.rechnungen.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Rechnungen vorhanden</h3>
        <p>Für dieses Unternehmen wurden noch keine Rechnungen erfasst.</p>
      </div>
    `;
  }

  const isKunde = window.isKunde();

  const rows = detail.rechnungen.map(r => {
    const kampagneName = r.kampagne ? (r.kampagne.eigener_name || r.kampagne.kampagnenname || '-') : '-';
    const preisProVideo = r.videoanzahl && r.nettobetrag ? detail.formatCurrency(r.nettobetrag / r.videoanzahl) : '-';
    const creatorBubble = r.creator ? avatarBubbles.renderBubbles([{
      name: [r.creator.vorname, r.creator.nachname].filter(Boolean).join(' '),
      type: 'person', id: r.creator.id, entityType: 'creator'
    }]) : '-';
    return `
    <tr>
      <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${detail.sanitize(r.rechnung_nr || '—')}</a></td>
      <td><span class="status-badge ${r.rechnungstyp === 'contracting' ? 'status-gestellt' : 'status-beauftragt'}">${r.rechnungstyp === 'contracting' ? 'Contracting' : 'Kampagne'}</span></td>
      <td>${r.auftrag ? `<a href="#" class="table-link" data-table="auftrag" data-id="${r.auftrag.id}">${detail.sanitize(r.auftrag.auftragsname || '-')}</a>` : '-'}</td>
      <td>${detail.sanitize(r.po_nummer) || '-'}</td>
      <td>${detail.formatDate(r.created_at)}</td>
      <td>${r.kampagne ? `<a href="#" class="table-link" data-table="kampagne" data-id="${r.kampagne.id}">${detail.sanitize(kampagneName)}</a>` : '-'}</td>
      <td>${detail.sanitize(r.land) || '-'}</td>
      <td>${creatorBubble}</td>
      <td>${detail.formatDate(r.gestellt_am)}</td>
      <td>${detail.formatDate(r.zahlungsziel)}</td>
      <td>${detail.formatCurrency(r.nettobetrag)}</td>
      <td>${r.videoanzahl || '-'}</td>
      <td>${preisProVideo}</td>
      <td>${detail.formatCurrency(r.bruttobetrag)}</td>
      <td>${r.rechnung_pdfs && r.rechnung_pdfs.length > 0 ? r.rechnung_pdfs.map((p, i) => `<a href="${p.file_url || p.open_url}" target="_blank" rel="noopener">PDF${r.rechnung_pdfs.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' ') : (r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>` : '-')}</td>
      <td>${r.status || '-'}</td>
      ${!isKunde ? `<td>${renderPersonBubble(detail, r.created_by)}</td>` : ''}
      ${!isKunde ? `<td>${actionBuilder.create('rechnung', r.id)}</td>` : ''}
    </tr>
  `}).join('');

  return `
    <div class="data-table-container">
      <table class="data-table data-table--nowrap">
        <thead>
          <tr>
            <th>Rechnungsname</th>
            <th>Typ</th>
            <th>Auftrag</th>
            <th>PO-Nummer</th>
            <th>Erstellt am</th>
            <th>Kampagne / Contract</th>
            <th>Land</th>
            <th>Creator</th>
            <th>Gestellt am</th>
            <th>Zahlungsziel</th>
            <th>Nettobetrag</th>
            <th>Videos</th>
            <th>Preis/Video</th>
            <th>Bruttobetrag</th>
            <th>Beleg</th>
            <th>Status</th>
            ${!isKunde ? '<th>Erstellt von</th>' : ''}
            ${!isKunde ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderKundenrechnungen(detail) {
  if (!detail.kundenrechnungen || detail.kundenrechnungen.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Kundenrechnungen vorhanden</h3>
        <p>Für dieses Unternehmen wurden noch keine Kundenrechnungen erfasst.</p>
      </div>
    `;
  }

  const formatDate = (d) => detail.formatDate(d);
  const formatCurrency = (v) => detail.formatCurrency(v);
  const formatZahlungsziel = (tage) => tage ? `${tage} Tage` : '-';
  const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="var(--success-color, #16a34a)" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;
  const uncheckIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--text-muted, #9ca3af)" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`;

  const rows = detail.kundenrechnungen.map(r => {
    const paymentClass = getPaymentRowStatusClass(r);
    return `
    <tr class="${paymentClass}">
      <td>${r.marke ? renderMarkeBubble(detail, r.marke) : '-'}</td>
      <td><a href="#" class="table-link" data-table="auftrag" data-id="${r.id}">${detail.sanitize(r.auftragsname || '-')}</a></td>
      <td>${r._teilrechnung?.label || '1 von 1'}</td>
      <td>${detail.sanitize(r.angebotsnummer || '-')}</td>
      <td>${detail.sanitize(r.re_nr || '-')}</td>
      <td>${detail.sanitize(r.externe_po || '-')}</td>
      <td>${formatDate(r.rechnung_gestellt_am)}</td>
      <td>${formatZahlungsziel(r.zahlungsziel_tage)}</td>
      <td>${formatDate(r.re_faelligkeit)}</td>
      <td>${formatCurrency(r.nettobetrag)}</td>
      <td>${formatCurrency(r.ust_betrag)}</td>
      <td>${formatCurrency(r.bruttobetrag)}</td>
      <td class="table-cell-center">${r.rechnung_gestellt_am ? checkIcon : uncheckIcon}</td>
      <td class="table-cell-center">${r.ueberwiesen_am ? checkIcon : uncheckIcon}</td>
      <td>${formatDate(r.ueberwiesen_am)}</td>
    </tr>
  `}).join('');

  return `
    <div class="data-table-container">
      <table class="data-table data-table--nowrap">
        <thead>
          <tr>
            <th>Marke</th>
            <th>Auftrag</th>
            <th>Teilrechnung</th>
            <th>Angebotsnr.</th>
            <th>Rechnungsnr.</th>
            <th>Externe PO</th>
            <th>Rechnungsdatum</th>
            <th>Zahlungsziel</th>
            <th>Fälligkeit</th>
            <th>Netto</th>
            <th>USt</th>
            <th>Brutto</th>
            <th class="table-cell-center">Gestellt</th>
            <th class="table-cell-center">Überwiesen</th>
            <th>Bezahlt am</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderVertraege(detail) {
  if (!detail.vertraege || detail.vertraege.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Verträge vorhanden</h3>
        <p>Für dieses Unternehmen wurden noch keine Verträge erfasst.</p>
      </div>
    `;
  }

  const getStatusLabel = (isDraft) => isDraft ? 'Entwurf' : 'Final';
  const getStatusClass = (isDraft) => isDraft ? 'draft' : 'aktiv';

  const rows = detail.vertraege.map(v => {
    const creatorName = v.creator ? `${v.creator.vorname || ''} ${v.creator.nachname || ''}`.trim() : '-';
    const kampagneName = KampagneUtils.getDisplayName(v.kampagne);

    return `
      <tr>
        <td><a href="/vertraege/${v.id}" onclick="event.preventDefault(); window.navigateTo('/vertraege/${v.id}')">${detail.sanitize(v.name || '—')}</a></td>
        <td>${detail.sanitize(v.typ || '-')}</td>
        <td><span class="status-badge status-${getStatusClass(v.is_draft)}">${getStatusLabel(v.is_draft)}</span></td>
        <td>${v.kampagne ? `<a href="/kampagne/${v.kampagne.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${v.kampagne.id}')">${detail.sanitize(kampagneName)}</a>` : '-'}</td>
        <td>${v.creator ? `<a href="/creator/${v.creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${v.creator.id}')">${detail.sanitize(creatorName)}</a>` : '-'}</td>
        <td>${v.datei_url ? `<a href="${v.datei_url}" target="_blank" rel="noopener">PDF</a>` : '-'}</td>
        <td>${detail.formatDate(v.created_at)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table vertraege-detail-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Typ</th>
            <th>Status</th>
            <th>Kampagne</th>
            <th>Creator</th>
            <th>Datei</th>
            <th>Erstellt am</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderKickOff(detail) {
  return renderStrategiebriefingShared(detail, { parentType: 'unternehmen' });
}

export function bindUnternehmenKickOffCreateButton(detail) {
  bindStrategiebriefingCreateButton(detail, { parentType: 'unternehmen' });
}
