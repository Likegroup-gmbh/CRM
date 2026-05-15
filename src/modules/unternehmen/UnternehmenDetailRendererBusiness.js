// UnternehmenDetailRendererBusiness.js
// Tab-Renderer: Aufträge, Auftragsdetails, Briefings, Kampagnen

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderAuftragAmpel } from '../auftrag/logic/AuftragStatusUtils.js';
import { formatZahlungsziel, formatBoolean, renderMarkeBubble, renderPersonBubble, renderArtTags, renderBudgetProgress } from './UnternehmenDetailRendererHelpers.js';

export function renderAuftraege(detail) {
  if (!detail.auftraege || detail.auftraege.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Aufträge vorhanden</h3>
        <p>Es wurden noch keine Aufträge für dieses Unternehmen erstellt.</p>
      </div>
    `;
  }

  const isKunde = window.isKunde();

  const rows = detail.auftraege.map(auftrag => `
    <tr>
      <td>${renderMarkeBubble(detail, auftrag.marke)}</td>
      <td>
        <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id}">
          ${detail.sanitize(auftrag.auftragsname) || 'Unbekannter Auftrag'}
        </a>
      </td>
      <td>${detail.sanitize(auftrag.angebotsnummer) || '-'}</td>
      <td>${detail.sanitize(auftrag.re_nr) || '-'}</td>
      <td>${detail.sanitize(auftrag.externe_po) || '-'}</td>
      <td>${detail.formatDate(auftrag.rechnung_gestellt_am)}</td>
      <td>${formatZahlungsziel(auftrag.zahlungsziel_tage)}</td>
      <td>${detail.formatDate(auftrag.re_faelligkeit)}</td>
      <td>${detail.formatCurrency(auftrag.nettobetrag)}</td>
      <td>${detail.formatCurrency(auftrag.ust_betrag)}</td>
      <td>${detail.formatCurrency(auftrag.bruttobetrag)}</td>
      <td class="table-cell-center">${formatBoolean(auftrag.rechnung_gestellt)}</td>
      <td class="table-cell-center">${formatBoolean(auftrag.ueberwiesen)}</td>
      <td>${detail.formatDate(auftrag.ueberwiesen_am)}</td>
      ${!isKunde ? `<td>${renderPersonBubble(detail, auftrag.ansprechpartner, 'ansprechpartner')}</td>` : ''}
      <td>${renderPersonBubble(detail, auftrag.created_by)}</td>
      <td>${renderAuftragAmpel(auftrag.status)}</td>
      ${!isKunde ? `<td>${actionBuilder.create('auftrag', auftrag.id)}</td>` : ''}
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table data-table--nowrap">
        <thead>
          <tr>
            <th>Marke</th>
            <th>Auftragsname</th>
            <th>Angebotsnummer</th>
            <th>Rechnungsnummer</th>
            <th>Externe PO</th>
            <th>Rechnungsdatum</th>
            <th>Zahlungsziel</th>
            <th>Rechnungsfälligkeit</th>
            <th>Betrag netto</th>
            <th>Umsatzsteuer</th>
            <th>Betrag brutto</th>
            <th class="table-cell-center">Rechnung gestellt</th>
            <th class="table-cell-center">Überwiesen</th>
            <th>Bezahlt am</th>
            ${!isKunde ? '<th>Ansprechpartner</th>' : ''}
            <th>Erstellt von</th>
            <th>Status</th>
            ${!isKunde ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderAuftragsdetails(detail) {
  if (!detail.auftragsdetails || detail.auftragsdetails.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Auftragsdetails vorhanden</h3>
        <p>Es wurden noch keine Auftragsdetails für die Aufträge dieses Unternehmens erstellt.</p>
      </div>
    `;
  }

  const isKunde = window.isKunde();

  const rows = detail.auftragsdetails.map(d => {
    const auftrag = d.auftrag || {};
    return `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="auftragsdetails" data-id="${d.id}">
          ${detail.sanitize(auftrag.auftragsname) || 'Unbekannter Auftrag'}
        </a>
      </td>
      <td>${renderMarkeBubble(detail, auftrag.marke)}</td>
      <td>${detail.sanitize(isKunde ? auftrag.externe_po : auftrag.po) || '-'}</td>
      <td>${renderAuftragAmpel(auftrag.status)}</td>
      <td>${detail.formatDate(auftrag.start)}</td>
      <td>${detail.formatDate(auftrag.ende)}</td>
      <td>${detail.formatDate(d.created_at)}</td>
      ${!isKunde ? `<td>${renderPersonBubble(detail, d.created_by)}</td>` : ''}
      ${!isKunde ? `<td>${actionBuilder.create('auftragsdetails', d.id)}</td>` : ''}
    </tr>
  `}).join('');

  return `
    <div class="data-table-container">
      <table class="data-table data-table--nowrap">
        <thead>
          <tr>
            <th>Auftrag</th>
            <th>Marke</th>
            <th>${isKunde ? 'PO extern' : 'PO intern'}</th>
            <th>Status</th>
            <th>Start</th>
            <th>Ende</th>
            <th>Erstellt am</th>
            ${!isKunde ? '<th>Erstellt von</th>' : ''}
            ${!isKunde ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderBriefings(detail) {
  if (!detail.briefings || detail.briefings.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Briefings vorhanden</h3>
        <p>Es wurden noch keine Briefings für dieses Unternehmen erstellt.</p>
      </div>
    `;
  }

  const rows = detail.briefings.map(briefing => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="briefing" data-id="${briefing.id}">
          ${detail.sanitize(briefing.product_service_offer) || 'Unbekanntes Briefing'}
        </a>
      </td>
      <td>${renderMarkeBubble(detail, briefing.marke)}</td>
      <td>${briefing.kampagne?.id ? `<span class="tag tag--type">${detail.sanitize(KampagneUtils.getDisplayName(briefing.kampagne))}</span>` : '-'}</td>
      <td>${renderPersonBubble(detail, briefing.assignee)}</td>
      <td>${actionBuilder.create('briefing', briefing.id)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Produkt/Angebot</th>
            <th>Marke</th>
            <th>Kampagne</th>
            <th>Zugewiesen</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderKampagnen(detail) {
  if (!detail.kampagnen || detail.kampagnen.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Kampagnen vorhanden</h3>
        <p>Es wurden noch keine Kampagnen für dieses Unternehmen erstellt.</p>
      </div>
    `;
  }

  const isKunde = window.isKunde();

  const rows = detail.kampagnen.map(k => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="kampagne" data-id="${k.id}">
          ${detail.sanitize(KampagneUtils.getDisplayName(k))}
        </a>
      </td>
      <td>${renderMarkeBubble(detail, k.marke)}</td>
      <td>${renderArtTags(detail, k.art_der_kampagne_display || k.art_der_kampagne)}</td>
      <td>${renderBudgetProgress(detail, k)}</td>
      <td>${k.creatoranzahl || 0}</td>
      <td>${k.videoanzahl || 0}</td>
      ${!isKunde ? `<td>${actionBuilder.create('kampagne', k.id)}</td>` : ''}
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table data-table--nowrap">
        <thead>
          <tr>
            <th>Kampagnenname</th>
            <th>Marke</th>
            <th>Art der Kampagne</th>
            <th>Budget</th>
            <th>Creator Anzahl</th>
            <th>Video Anzahl</th>
            ${!isKunde ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
