// MarkeDetailRendererTables.js
// Tabellen-Renderer: Kampagnen, Auftraege, Ansprechpartner, Rechnungen, Briefings, Kooperationen, Strategien, Sourcing

import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderAuftragAmpel } from '../auftrag/logic/AuftragStatusUtils.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon, renderPdfLinks } from '../../core/icons/IconSystem.js';
import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';

export function renderKampagnen(detail) {
  if (!detail.kampagnen || detail.kampagnen.length === 0) {
    return renderEmptyState({
      icon: 'megaphone',
      title: 'Keine Kampagnen vorhanden',
      text: 'Es wurden noch keine Kampagnen für diese Marke erstellt.'
    });
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
    return renderEmptyState({
      icon: 'clipboard',
      title: 'Keine Aufträge vorhanden',
      text: 'Es wurden noch keine Aufträge für diese Marke erstellt.'
    });
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
    return renderEmptyState({
      icon: 'users',
      title: 'Keine Ansprechpartner vorhanden',
      text: 'Es wurden noch keine Ansprechpartner für diese Marke zugeordnet.'
    });
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
        ${ap.ist_verknuepft ? `<span class="tag tag--verknuepft" title="verknüpft">${icon('link')}</span>` : ''}
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
    return renderEmptyState({
      icon: 'invoice',
      title: 'Keine Rechnungen vorhanden',
      text: 'Für diese Marke wurden noch keine Rechnungen erfasst.'
    });
  }

  const rows = detail.rechnungen.map(r => `
    <tr>
      <td><a href="/rechnung/${r.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${detail.sanitize(r.rechnung_nr || '—')}</a></td>
      <td>${r.status || '-'}</td>
      <td>${detail.formatCurrency(r.nettobetrag)}</td>
      <td>${detail.formatCurrency(r.bruttobetrag)}</td>
      <td>${detail.formatDate(r.gestellt_am)}</td>
      <td>${renderPdfLinks(r.rechnung_pdfs, r.pdf_url)}</td>
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
    return renderEmptyState({
      icon: 'document',
      title: 'Keine Briefings vorhanden',
      text: 'Es wurden noch keine Briefings für diese Marke erstellt.'
    });
  }

  const rows = detail.briefings.map(briefing => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="briefing" data-id="${briefing.id}">
          ${detail.sanitize(briefing.aktivierung_name) || 'Unbekanntes Briefing'}
        </a>
      </td>
      <td>${briefing.bereich ? `<span class="tag tag--type">${detail.sanitize(BEREICH_LABELS[briefing.bereich] || briefing.bereich)}</span>` : '-'}</td>
      <td><span class="status-badge ${briefing.is_draft ? 'status-entwurf' : 'status-final'}">${briefing.is_draft ? 'Entwurf' : 'Final'}</span></td>
      <td>${detail.formatDate(briefing.content_deadline)}</td>
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
            <th>Aktivierung</th>
            <th>Bereich</th>
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
    return renderEmptyState({
      icon: 'handshake',
      title: 'Keine Kooperationen vorhanden',
      text: 'Für die Kampagnen dieser Marke wurden keine Kooperationen gefunden.'
    });
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
    return renderEmptyState({
      icon: 'clipboard',
      title: 'Keine Strategien vorhanden',
      text: 'Es wurden noch keine Strategien für diese Marke erstellt.'
    });
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
      <td class="col-actions">${actionBuilder.create('strategie', strategie.id)}</td>
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
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function renderSourcingListen(detail) {
  if (!detail.sourcingListen || detail.sourcingListen.length === 0) {
    return renderEmptyState({
      icon: 'sourcing',
      title: 'Keine Sourcing-Listen vorhanden',
      text: 'Es wurden noch keine Sourcing-Listen für diese Marke erstellt.'
    });
  }

  const rows = detail.sourcingListen.map(liste => `
    <tr>
      <td>
        <a href="#" class="table-link" data-table="sourcing" data-id="${liste.id}">
          ${detail.sanitize(liste.name) || 'Unbekannte Sourcing-Liste'}
        </a>
      </td>
      <td>${detail.formatDate(liste.created_at)}</td>
      <td class="col-actions">${actionBuilder.create('creator_auswahl', liste.id)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Erstellt am</th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
