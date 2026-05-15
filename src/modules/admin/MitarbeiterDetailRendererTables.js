// MitarbeiterDetailRendererTables.js
// Tab-Tabellen: Kampagnen, Kooperationen, Briefings, Auftragsdetails, Unternehmen, Budget

import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderAuftragAmpel } from '../auftrag/logic/AuftragStatusUtils.js';

export function renderKampagnenTable(detail) {
  const rows = (detail.assignments.kampagnen || []).map(k => `
    <tr>
      <td><a href="/kampagne/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.id}')">${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k))}</a></td>
      <td style="text-align:right;">
        <div class="actions-dropdown-container" data-entity-type="kampagne">
          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
          <div class="actions-dropdown">
            <div class="action-submenu">
              <a href="#" class="action-item has-submenu" data-submenu="status">
                ${actionsDropdown.getHeroIcon('invoice')}
                <span>Status ändern</span>
              </a>
              <div class="submenu" data-submenu="status">
                ${ (detail.statusOptions || []).map(st => `
                  <a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${st.id}" data-status-name="${st.name.replace(/"/g,'\\"')}" data-id="${k.id}">${actionsDropdown.getStatusIcon(st.name)}<span>${st.name}</span>${''}</a>
                `).join('') }
              </div>
            </div>
            <a href="#" class="action-item" data-action="view" data-id="${k.id}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" /></svg>
              Details anzeigen
            </a>
            <a href="#" class="action-item action-danger" data-action="unassign-kampagne" data-id="${k.id}" data-mitarbeiter-id="${detail.userId}">
              <i class="icon-trash"></i>
              Zuweisung entfernen
            </a>
          </div>
        </div>
      </td>
    </tr>
  `).join('');
  if (!rows) return '<div class="empty-state"><p>Keine Kampagnen zugewiesen</p></div>';
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr><th>Kampagne</th><th>Aktionen</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderKooperationenTable(detail) {
  const rows = (detail.assignments.kooperationen || []).map(r => `
    <tr>
      <td><a href="/kooperation/${r.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${r.id}')">${window.validatorSystem.sanitizeHtml(r.name || r.id)}</a></td>
      <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(r.kampagne))}</td>
    </tr>
  `).join('');
  if (!rows) return '<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>';
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Kampagne</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderBriefingsTable(detail) {
  const rows = (detail.assignments.briefings || []).map(b => `
    <tr>
      <td><a href="/briefing/${b.id}" onclick="event.preventDefault(); window.navigateTo('/briefing/${b.id}')">${window.validatorSystem.sanitizeHtml(b.product_service_offer || b.id)}</a></td>
      <td><span class="status-badge status-${(b.status||'').toLowerCase().replace(/\s+/g,'-')}">${b.status || '-'}</span></td>
    </tr>
  `).join('');
  if (!rows) return '<div class="empty-state"><p>Keine Briefings zugewiesen</p></div>';
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr><th>Briefing</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderAuftragsdetailsTable(detail) {
  const rows = (detail.assignments.auftragsdetails || []).map(d => `
    <tr>
      <td>
        <a href="/auftragsdetails/${d.id}" onclick="event.preventDefault(); window.navigateTo('/auftragsdetails/${d.id}')">
          ${window.validatorSystem.sanitizeHtml(d.auftrag?.auftragsname || 'Unbekannter Auftrag')}
        </a>
      </td>
      <td>${renderAuftragAmpel(d.auftrag?.status)}</td>
      <td>${window.validatorSystem.sanitizeHtml(d.kategorie || '-')}</td>
      <td>${window.validatorSystem.sanitizeHtml(d.beschreibung || '-')}</td>
      <td>${detail.formatDate(d.created_at)}</td>
    </tr>
  `).join('');

  if (!rows) return '<div class="empty-state"><p>Keine Auftragsdetails vorhanden</p></div>';

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Auftrag</th>
            <th>Status</th>
            <th>Kategorie</th>
            <th>Beschreibung</th>
            <th>Erstellt am</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderUnternehmenTable(detail) {
  if (!detail.zugeordnet.unternehmen || detail.zugeordnet.unternehmen.length === 0) {
    return '<div class="empty-state"><p>Keine Unternehmen zugeordnet</p></div>';
  }

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Firmenname</th>
            <th style="width: 180px;">Rolle</th>
            <th style="width: 120px; text-align: center;">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${detail.zugeordnet.unternehmen.map(u => `
            <tr data-id="${u.id}">
              <td>
                <a href="/unternehmen/${u.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${u.id}')" class="table-link">
                  ${window.validatorSystem.sanitizeHtml(u.firmenname || u.id)}
                </a>
              </td>
              <td>
                <select class="form-select role-select" data-unternehmen-id="${u.id}" style="padding: 6px 10px; font-size: 13px;">
                  <option value="management" ${u.role === 'management' ? 'selected' : ''}>Management</option>
                  <option value="lead_mitarbeiter" ${u.role === 'lead_mitarbeiter' ? 'selected' : ''}>Lead Mitarbeiter</option>
                  <option value="mitarbeiter" ${u.role === 'mitarbeiter' ? 'selected' : ''}>Mitarbeiter</option>
                </select>
              </td>
              <td style="text-align: center;">
                <button class="secondary-btn btn-remove-unternehmen" data-id="${u.id}" data-name="${window.validatorSystem.sanitizeHtml(u.firmenname)}">
                  Entfernen
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

export function renderBudget(detail) {
  const koopRows = (detail.assignments.kooperationen || []).map(k => {
    const invoices = detail.budget.invoicesByKoop[k.id] || [];
    const invHtml = invoices.length
      ? invoices.map(r => `<div><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || r.id)}</a> — ${detail.formatCurrency(r.bruttobetrag)} <span class="status-badge status-${(r.status||'').toLowerCase().replace(/\s+/g,'-')}">${r.status || '-'}</span></div>`).join('')
      : '<span class="muted">Keine Rechnung</span>';
    const netto = Number(k.einkaufspreis_netto || 0);
    const zusatz = Number(k.einkaufspreis_zusatzkosten || 0);
    const gesamt = (k.einkaufspreis_gesamt != null) ? Number(k.einkaufspreis_gesamt) : (netto + zusatz);
    return `
      <tr>
        <td><a href="/kooperation/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')">${window.validatorSystem.sanitizeHtml(k.name || k.id)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k.kampagne))}</td>
        <td style="text-align:right;">${detail.formatCurrency(netto)}</td>
        <td style="text-align:right;">${detail.formatCurrency(zusatz)}</td>
        <td style="text-align:right;">${detail.formatCurrency(gesamt)}</td>
        <td>${invHtml}</td>
      </tr>
    `;
  }).join('');

  const totals = detail.budget.totals || { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 };
  const summary = `
    <div class="stats-cards-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.netto)}</div><div class="stat-label">Summe Netto (Koops)</div></div></div>
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.zusatz)}</div><div class="stat-label">Summe Zusatzkosten</div></div></div>
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.gesamt)}</div><div class="stat-label">Summe Gesamtkosten</div></div></div>
    </div>
    <div class="stats-cards-grid" style="grid-template-columns: repeat(2, 1fr); margin-top:12px;">
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.invoice_netto)}</div><div class="stat-label">Summe Rechnungen Netto</div></div></div>
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.invoice_brutto)}</div><div class="stat-label">Summe Rechnungen Brutto</div></div></div>
    </div>
  `;

  const table = koopRows
    ? `
      <div class="data-table-container" style="margin-top:12px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kooperation</th>
              <th>Kampagne</th>
              <th style="text-align:right;">Netto</th>
              <th style="text-align:right;">Zusatz</th>
              <th style="text-align:right;">Gesamt</th>
              <th>Rechnungen</th>
            </tr>
          </thead>
          <tbody>${koopRows}</tbody>
        </table>
      </div>
    `
    : '<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>';

  return `${summary}${table}`;
}
