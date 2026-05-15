// MarkeDetailRendererTables.js
// Tabellen-Renderer: Kampagnen, Auftraege, Ansprechpartner, Rechnungen, Briefings, Kooperationen, Strategien

import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderAuftragAmpel } from '../auftrag/logic/AuftragStatusUtils.js';

export function renderKampagnen(detail) {
  if (!detail.kampagnen || detail.kampagnen.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Kampagnen vorhanden</h3>
        <p>Es wurden noch keine Kampagnen für diese Marke erstellt.</p>
      </div>
    `;
  }

  const rows = detail.kampagnen.map(kampagne => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
          ${detail.sanitize(KampagneUtils.getDisplayName(kampagne))}
        </a>
      </td>
      <td>${detail.formatDate(kampagne.start)}</td>
      <td>${detail.formatDate(kampagne.deadline)}</td>
      <td>${kampagne.creatoranzahl || 0}</td>
      <td>${kampagne.videoanzahl || 0}</td>
      <td>
        ${actionBuilder.create('kampagne', kampagne.id)}
      </td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Kampagnenname</th>
            <th>Start</th>
            <th>Deadline</th>
            <th>Creator</th>
            <th>Videos</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAuftraege(detail) {
  if (!detail.auftraege || detail.auftraege.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Aufträge vorhanden</h3>
        <p>Es wurden noch keine Aufträge für diese Marke erstellt.</p>
      </div>
    `;
  }

  const rows = detail.auftraege.map(auftrag => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id}">
          ${detail.sanitize(auftrag.auftragsname) || 'Unbekannter Auftrag'}
        </a>
      </td>
      <td>${renderAuftragAmpel(auftrag.status)}</td>
      <td>${auftrag.auftragtype || '-'}</td>
      <td>${detail.formatCurrency(auftrag.gesamt_budget)}</td>
      <td>${detail.formatDate(auftrag.created_at)}</td>
      <td>
        ${actionBuilder.create('auftrag', auftrag.id)}
      </td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Auftragsname</th>
            <th>Status</th>
            <th>Typ</th>
            <th>Budget</th>
            <th>Erstellt am</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAnsprechpartner(detail) {
  if (!detail.ansprechpartner || detail.ansprechpartner.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Ansprechpartner vorhanden</h3>
        <p>Es wurden noch keine Ansprechpartner für diese Marke zugeordnet.</p>
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
      </div>
    `;
  }

  const rows = detail.rechnungen.map(r => `
    <tr>
      <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${detail.sanitize(r.rechnung_nr || '—')}</a></td>
      <td>${r.status || '-'}</td>
      <td>${detail.formatCurrency(r.nettobetrag)}</td>
      <td>${detail.formatCurrency(r.bruttobetrag)}</td>
      <td>${detail.formatDate(r.gestellt_am)}</td>
      <td>${r.rechnung_pdfs && r.rechnung_pdfs.length > 0 ? r.rechnung_pdfs.map((p, i) => `<a href="${p.file_url}" target="_blank" rel="noopener">PDF${r.rechnung_pdfs.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' ') : (r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>` : '-')}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table" id="marke-rechnungen-table">
        <thead>
          <tr>
            <th>Rechnungs-Nr</th>
            <th>Status</th>
            <th>Netto</th>
            <th>Brutto</th>
            <th>Gestellt</th>
            <th>Beleg</th>
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
        <p>Es wurden noch keine Briefings für diese Marke erstellt.</p>
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
      <td><span class="status-badge status-${briefing.status?.toLowerCase() || 'unknown'}">${briefing.status || '-'}</span></td>
      <td>${detail.formatDate(briefing.deadline)}</td>
      <td>${detail.formatDate(briefing.created_at)}</td>
      <td>
        ${actionBuilder.create('briefing', briefing.id)}
      </td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Produkt/Angebot</th>
            <th>Status</th>
            <th>Deadline</th>
            <th>Erstellt am</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function renderKooperationen(detail) {
  if (!detail.kooperationen || detail.kooperationen.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Kooperationen vorhanden</h3>
        <p>Für die Kampagnen dieser Marke wurden keine Kooperationen gefunden.</p>
      </div>
    `;
  }

  const isKunde = window.isKunde();

  const rows = detail.kooperationen.map(k => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="kooperation" data-id="${k.id}">
          ${detail.sanitize(k.name) || 'Kooperation'}
        </a>
      </td>
      <td><span class="status-badge status-${k.status?.toLowerCase() || 'unknown'}">${k.status || '-'}</span></td>
      <td>${k.creator ? `${detail.sanitize(k.creator.vorname || '')} ${detail.sanitize(k.creator.nachname || '')}`.trim() || '-' : '-'}</td>
      <td>${detail.sanitize(KampagneUtils.getDisplayName(k.kampagne))}</td>
      <td>${k.videoanzahl || 0}</td>
      ${!isKunde ? `<td>${detail.formatCurrency(k.einkaufspreis_gesamt)}</td>` : ''}
      <td>
        ${actionBuilder.create('kooperation', k.id)}
      </td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Creator</th>
            <th>Kampagne</th>
            <th>Videos</th>
            ${!isKunde ? '<th>Gesamtkosten</th>' : ''}
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function renderStrategien(detail) {
  if (!detail.strategien || detail.strategien.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Strategien vorhanden</h3>
        <p>Es wurden noch keine Strategien für diese Marke erstellt.</p>
      </div>
    `;
  }

  const rows = detail.strategien.map(strategie => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="strategie" data-id="${strategie.id}">
          ${detail.sanitize(strategie.name) || 'Unbenannte Strategie'}
        </a>
      </td>
      <td>${detail.sanitize(strategie.teilbereich) || '-'}</td>
      <td>${strategie.beschreibung ? (strategie.beschreibung.length > 100 ? detail.sanitize(strategie.beschreibung.substring(0, 100)) + '...' : detail.sanitize(strategie.beschreibung)) : '-'}</td>
      <td class="col-erstellt-von">${detail.sanitize(strategie.created_by_user?.name) || '-'}</td>
      <td>${detail.formatDate(strategie.created_at)}</td>
      <td>${detail.formatDate(strategie.updated_at)}</td>
      <td>
        ${actionBuilder.create('strategie', strategie.id)}
      </td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Teilbereich</th>
            <th>Beschreibung</th>
            <th class="col-erstellt-von">Erstellt von</th>
            <th>Erstellt am</th>
            <th>Aktualisiert am</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}
