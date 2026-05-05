// ContractListRenderers.js
// HTML-Rendering fuer die Contract-Listenseite

import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';

function escapeHtml(v) {
  if (v == null) return '';
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatCurrency(value) {
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

function statusSlug(text) {
  return (text || '').toLowerCase().replace(/\s+/g, '-');
}

function statusBadge(status) {
  if (!status) return '<span class="status-badge status-inactive">—</span>';
  return `<span class="status-badge status-${statusSlug(status)}">${escapeHtml(status)}</span>`;
}

function rechnungsstatusBadge(stats) {
  if (!stats || stats.total === 0) return '<span class="status-badge status-inactive">Keine</span>';
  if (stats.bezahlt === stats.total) return `<span class="status-badge status-erfolg">${stats.bezahlt}/${stats.total} bezahlt</span>`;
  if (stats.offen === stats.total) return `<span class="status-badge status-offen">${stats.total} offen</span>`;
  return `<span class="status-badge status-pending">${stats.bezahlt}/${stats.total} bezahlt</span>`;
}

export function renderPageHtml({ searchQuery }) {
  const isKunde = window.isKunde?.();

  return `
    <div class="table-filter-wrapper">
      <div class="filter-bar">
        <div class="filter-left">
          ${SearchInput.render('contracts', {
            placeholder: 'Contract suchen...',
            currentValue: searchQuery
          })}
        </div>
      </div>
      ${!isKunde ? `<div class="table-actions">
        <button id="btn-contract-new" class="primary-btn">Neuen Contract anlegen</button>
      </div>` : ''}
    </div>

    <div class="content-section">
      <div id="contracts-content-container">
        ${renderTableWrapper()}
      </div>
    </div>
  `;
}

function renderTableWrapper() {
  const isKunde = window.isKunde?.();
  const colCount = isKunde ? 6 : 7;

  return `
    <div class="data-table-container contracts-table-container">
      <table class="data-table data-table--nowrap data-table--contracts">
        <thead>
          <tr>
            <th class="col-name">Titel</th>
            <th class="col-unternehmen">Unternehmen</th>
            <th class="col-marke">Marke</th>
            <th class="col-status">Status</th>
            <th class="col-budget">Netto</th>
            <th class="col-rechnungsstatus">Rechnungsstatus</th>
            ${!isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody id="contracts-table-body">
          <tr><td colspan="${colCount}" class="loading-cell">Laden...</td></tr>
        </tbody>
      </table>
      <div id="pagination-contracts"></div>
    </div>
  `;
}

export function updateTable(contracts) {
  const tbody = document.getElementById('contracts-table-body');
  if (!tbody) return;

  const isKunde = window.isKunde?.();
  const colCount = isKunde ? 6 : 7;

  if (!contracts || contracts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colCount}" class="empty-cell">
          <div class="empty-state">
            <p>${isKunde
              ? 'Sie haben noch kein Contracting. Sprechen Sie uns an!'
              : 'Keine Contracts vorhanden.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contracts.map(row => {
    const titel = row.titel || row.auftragsname || '(Ohne Titel)';
    const firma = row.unternehmen?.firmenname || '—';
    const marke = row.marke?.markenname || '—';
    const stats = row.rechnungStats || {};

    return `
      <tr class="table-row-clickable" data-id="${row.id}">
        <td class="col-name">
          <a href="/contracts/${row.id}" class="table-link" data-table="contracts" data-id="${row.id}">
            ${escapeHtml(titel)}
          </a>
        </td>
        <td class="col-unternehmen">${escapeHtml(firma)}</td>
        <td class="col-marke">${escapeHtml(marke)}</td>
        <td class="col-status">${statusBadge(row.status)}</td>
        <td class="col-budget">${row.nettobetrag != null ? formatCurrency(row.nettobetrag) : '—'}</td>
        <td class="col-rechnungsstatus">${rechnungsstatusBadge(stats)}</td>
        ${!isKunde ? `<td class="col-actions">${actionBuilder.create('contract', row.id)}</td>` : ''}
      </tr>
    `;
  }).join('');
}
