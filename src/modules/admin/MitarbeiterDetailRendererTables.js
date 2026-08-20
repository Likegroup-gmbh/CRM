// MitarbeiterDetailRendererTables.js
// Tab-Tabellen: Kampagnen, Kooperationen, Briefings, Auftragsdetails, Unternehmen, Budget

import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderAuftragAmpel } from '../auftrag/logic/AuftragStatusUtils.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

export function renderKampagnenTable(detail) {
  const rows = (detail.assignments.kampagnen || []).map(k => `
    <tr>
      <td><a href="/kampagne/${k.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.id}')">${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k))}</a></td>
      <td class="u-text-right">
        <div class="actions-dropdown-container" data-entity-type="kampagne">
          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
            ${icon('dots-vertical-filled')}
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
              ${icon('eye-outline', { className: 'w-5 h-5' })}
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
  if (!rows) return renderEmptyState({ icon: 'megaphone', title: 'Keine Kampagnen zugewiesen' });
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
      <td><a href="/kooperation/${r.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/kooperation/${r.id}')">${window.validatorSystem.sanitizeHtml(r.name || r.id)}</a></td>
      <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(r.kampagne))}</td>
    </tr>
  `).join('');
  if (!rows) return renderEmptyState({ icon: 'handshake', title: 'Keine Kooperationen zugewiesen' });
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
      <td><a href="/briefing/${b.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/briefing/${b.id}')">${window.validatorSystem.sanitizeHtml(b.aktivierung_name || b.id)}</a></td>
      <td><span class="status-badge ${b.is_draft ? 'status-entwurf' : 'status-final'}">${b.is_draft ? 'Entwurf' : 'Final'}</span></td>
    </tr>
  `).join('');
  if (!rows) return renderEmptyState({ icon: 'document', title: 'Keine Briefings zugewiesen' });
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
        <a href="/auftragsdetails/${d.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/auftragsdetails/${d.id}')">
          ${window.validatorSystem.sanitizeHtml(d.auftrag?.auftragsname || 'Unbekannter Auftrag')}
        </a>
      </td>
      <td>${renderAuftragAmpel(d.auftrag?.status)}</td>
      <td>${window.validatorSystem.sanitizeHtml(d.kategorie || '-')}</td>
      <td>${window.validatorSystem.sanitizeHtml(d.beschreibung || '-')}</td>
      <td>${detail.formatDate(d.created_at)}</td>
    </tr>
  `).join('');

  if (!rows) return renderEmptyState({ icon: 'clipboard', title: 'Keine Auftragsdetails vorhanden' });

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
    return renderEmptyState({ icon: 'building', title: 'Keine Unternehmen zugeordnet' });
  }

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Firmenname</th>
            <th class="col-w180">Rolle</th>
            <th class="col-w120-center">Aktionen</th>
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
                <select class="form-select form-select--compact role-select" data-unternehmen-id="${u.id}">
                  <option value="management" ${u.role === 'management' ? 'selected' : ''}>Management</option>
                  <option value="lead_mitarbeiter" ${u.role === 'lead_mitarbeiter' ? 'selected' : ''}>Lead Mitarbeiter</option>
                  <option value="mitarbeiter" ${u.role === 'mitarbeiter' ? 'selected' : ''}>Mitarbeiter</option>
                </select>
              </td>
              <td class="u-text-center">
                <button class="mdc-btn mdc-btn--secondary btn-remove-unternehmen" data-id="${u.id}" data-name="${window.validatorSystem.sanitizeHtml(u.firmenname)}">
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
      ? invoices.map(r => `<div><a href="/rechnung/${r.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || r.id)}</a> — ${detail.formatCurrency(r.bruttobetrag)} <span class="status-badge status-${(r.status||'').toLowerCase().replace(/\s+/g,'-')}">${r.status || '-'}</span></div>`).join('')
      : '<span class="muted">Keine Rechnung</span>';
    const netto = Number(k.einkaufspreis_netto || 0);
    const zusatz = Number(k.einkaufspreis_zusatzkosten || 0);
    const gesamt = (k.einkaufspreis_gesamt != null) ? Number(k.einkaufspreis_gesamt) : (netto + zusatz);
    return `
      <tr>
        <td><a href="/kooperation/${k.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')">${window.validatorSystem.sanitizeHtml(k.name || k.id)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k.kampagne))}</td>
        <td class="u-text-right">${detail.formatCurrency(netto)}</td>
        <td class="u-text-right">${detail.formatCurrency(zusatz)}</td>
        <td class="u-text-right">${detail.formatCurrency(gesamt)}</td>
        <td>${invHtml}</td>
      </tr>
    `;
  }).join('');

  const totals = detail.budget.totals || { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 };
  const summary = `
    <div class="stats-cards-grid stats-cards-grid--3">
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.netto)}</div><div class="stat-label">Summe Netto (Koops)</div></div></div>
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.zusatz)}</div><div class="stat-label">Summe Zusatzkosten</div></div></div>
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.gesamt)}</div><div class="stat-label">Summe Gesamtkosten</div></div></div>
    </div>
    <div class="stats-cards-grid stats-cards-grid--2 u-mt-sm">
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.invoice_netto)}</div><div class="stat-label">Summe Rechnungen Netto</div></div></div>
      <div class="stat-card"><div class="stat-content"><div class="stat-value">${detail.formatCurrency(totals.invoice_brutto)}</div><div class="stat-label">Summe Rechnungen Brutto</div></div></div>
    </div>
  `;

  const table = koopRows
    ? `
      <div class="data-table-container u-mt-sm">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kooperation</th>
              <th>Kampagne</th>
              <th class="u-text-right">Netto</th>
              <th class="u-text-right">Zusatz</th>
              <th class="u-text-right">Gesamt</th>
              <th>Rechnungen</th>
            </tr>
          </thead>
          <tbody>${koopRows}</tbody>
        </table>
      </div>
    `
    : renderEmptyState({ icon: 'handshake', title: 'Keine Kooperationen zugewiesen' });

  return `${summary}${table}`;
}
